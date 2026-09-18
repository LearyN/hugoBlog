/**
 * Cloudflare Pages Function — /api/check
 *
 * 并发检测一批 URL 的响应码与响应头，逐跳记录重定向，检测死循环。
 * 运行在 Cloudflare 边缘（服务端发起请求），因此不受浏览器 CORS 限制，
 * 可以完整读取每一跳的响应头。
 *
 * 安全硬化：
 *   1. 域名白名单 —— 仅允许配置的域名及其子域，杜绝开放代理滥用
 *   2. SSRF 防护 —— 拒绝私有网段 / 回环 / 云元数据地址 / IP 字面量
 *   3. 重定向目标同样过白名单，防止借白名单域跳内网
 *   4. 单批上限 + 单 IP 限流
 *
 * 白名单配置：环境变量 ALLOWED_DOMAINS（逗号分隔），
 * 未配置时使用 DEFAULT_ALLOWED_DOMAINS。
 *
 * 请求体 (POST, application/json):
 *   {
 *     urls: string[],        // 必填，一批 URL（建议 <= 8）
 *     method: "GET"|"HEAD"|"POST"|"OPTIONS",
 *     ua: string,            // User-Agent
 *     headers: object,       // 额外请求头
 *     timeoutMs: number,     // 单跳超时，默认 15000
 *     maxHops: number,       // 最大重定向跳数，默认 8
 *   }
 */

const DEFAULT_ALLOWED_DOMAINS = ["bitauto.my", "bitauto.hk", "bitauto.com"];

const REDIRECT_CODES = new Set([301, 302, 303, 307, 308]);

const HARD_LIMITS = {
  maxUrlsPerRequest: 20,
  maxTimeoutMs: 30000,
  maxHops: 20,
  maxConcurrency: 12,
  rateLimitPerMinute: 60,
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "access-control-allow-origin": "*",
    },
  });
}

/* ---------------- 安全：域名白名单 & SSRF ---------------- */

function isPrivateOrReservedHost(hostname) {
  const h = String(hostname || "").toLowerCase().replace(/^\[|\]$/g, "");
  if (!h) return true;
  if (h === "localhost" || h.endsWith(".localhost") || h.endsWith(".internal") || h.endsWith(".local")) return true;

  // IPv4 字面量
  const m = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (m) {
    const a = Number(m[1]), b = Number(m[2]);
    if (a === 0 || a === 10 || a === 127) return true;
    if (a === 192 && b === 168) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 169 && b === 254) return true; // 云元数据 169.254.169.254
    if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
    return true; // 任何 IP 字面量一律拒绝（白名单是域名）
  }
  // IPv6 字面量
  if (h.includes(":")) return true;
  return false;
}

function makeHostGuard(allowedDomains) {
  const allowed = allowedDomains.map((d) => String(d).trim().toLowerCase()).filter(Boolean);
  return function guard(hostname) {
    const h = String(hostname || "").toLowerCase();
    if (!h) return "INVALID_HOST";
    if (isPrivateOrReservedHost(h)) return "BLOCKED_PRIVATE_ADDRESS";
    const ok = allowed.some((d) => h === d || h.endsWith("." + d));
    if (!ok) return "DOMAIN_NOT_ALLOWED";
    return null;
  };
}

/* ---------------- 限流（isolate 级滑动窗口，尽力而为） ---------------- */

const RL_STORE = new Map();

function rateLimitHit(key, limit, windowMs) {
  const now = Date.now();
  let arr = RL_STORE.get(key) || [];
  arr = arr.filter((t) => now - t < windowMs);
  if (arr.length >= limit) {
    RL_STORE.set(key, arr);
    return { ok: false, retryAfterMs: windowMs - (now - arr[0]) };
  }
  arr.push(now);
  RL_STORE.set(key, arr);
  if (RL_STORE.size > 5000) {
    for (const [k, v] of RL_STORE) {
      if (!v.length || now - v[v.length - 1] > windowMs) RL_STORE.delete(k);
      if (RL_STORE.size <= 4000) break;
    }
  }
  return { ok: true };
}

/* ---------------- 工具函数 ---------------- */

function normalizeUrl(raw) {
  let s = String(raw || "").trim();
  if (!s) return null;
  if (!/^https?:\/\//i.test(s)) s = "https://" + s;
  try {
    const u = new URL(s);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    return u.href;
  } catch {
    return null;
  }
}

function headersToObject(h) {
  const out = {};
  for (const [k, v] of h.entries()) out[k.toLowerCase()] = v;
  return out;
}

/* ---------------- 核心检测 ---------------- */

async function checkOne(target, opts) {
  const started = Date.now();
  const hops = [];
  const seen = new Set();
  let current = target;
  let loop = false;
  let tooMany = false;
  let error = null;
  let truncated = false;
  let blocked = false;
  let method = opts.method;

  for (let i = 0; i < opts.maxHops; i++) {
    if (seen.has(current)) {
      loop = true;
      break;
    }
    seen.add(current);

    // 白名单 / SSRF 守卫（每一跳都检查）
    let host;
    try {
      host = new URL(current).hostname;
    } catch {
      error = "INVALID_URL";
      break;
    }
    const guardMsg = opts.guard(host);
    if (guardMsg) {
      blocked = true;
      error = guardMsg;
      hops.push({
        index: i + 1,
        url: current,
        status: null,
        statusText: guardMsg,
        headers: {},
        timeMs: 0,
        blocked: true,
      });
      break;
    }

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs);
    const hopStart = Date.now();

    let resp;
    try {
      resp = await fetch(current, {
        method,
        redirect: "manual",
        headers: opts.headers,
        signal: ctrl.signal,
      });
    } catch (e) {
      clearTimeout(timer);
      const msg = String(e && e.message ? e.message : e);
      error = /abort/i.test(msg) ? `TIMEOUT (${opts.timeoutMs}ms)` : `FETCH_ERROR: ${msg}`;
      hops.push({
        index: i + 1,
        url: current,
        status: null,
        statusText: error,
        headers: {},
        timeMs: Date.now() - hopStart,
        error,
      });
      break;
    }
    clearTimeout(timer);

    const hopHeaders = headersToObject(resp.headers);
    const location = resp.headers.get("location");
    const hop = {
      index: i + 1,
      url: current,
      status: resp.status,
      statusText: resp.statusText || "",
      headers: hopHeaders,
      timeMs: Date.now() - hopStart,
    };
    if (opts.captureBody) {
      try {
        const t = await resp.clone().text();
        hop.bodySnippet = t.slice(0, 800);
      } catch {}
    }

    if (REDIRECT_CODES.has(resp.status) && location) {
      let next;
      try {
        next = new URL(location, current).href;
      } catch {
        next = null;
      }
      hop.location = location;
      hop.nextUrl = next;
      hops.push(hop);

      if (!next) {
        error = "INVALID_LOCATION_HEADER";
        break;
      }

      // 重定向目标也要过白名单
      let nextHost;
      try {
        nextHost = new URL(next).hostname;
      } catch {
        error = "INVALID_REDIRECT_TARGET";
        break;
      }
      const nextGuard = opts.guard(nextHost);
      if (nextGuard) {
        blocked = true;
        error = `REDIRECT_${nextGuard}`;
        hops.push({
          index: i + 2,
          url: next,
          status: null,
          statusText: `重定向目标被拦截 (${nextGuard})`,
          headers: {},
          timeMs: 0,
          blocked: true,
        });
        break;
      }

      if (seen.has(next)) {
        loop = true;
        break;
      }
      if (i + 1 >= opts.maxHops) {
        tooMany = true;
        truncated = true;
        break;
      }
      current = next;
      // 303 语义：非 GET/HEAD 改为 GET
      if (resp.status === 303 && method !== "GET" && method !== "HEAD") {
        method = "GET";
      }
      continue;
    }

    hops.push(hop);
    break;
  }

  const finalHop = hops[hops.length - 1] || null;
  const status = finalHop ? finalHop.status : null;
  const redirectCount = hops.filter((h) => REDIRECT_CODES.has(h.status)).length;

  return {
    url: target,
    finalUrl: finalHop ? finalHop.url : target,
    status,
    statusText: finalHop ? finalHop.statusText : "",
    redirectCount,
    hops,
    redirectLoop: loop,
    tooManyRedirects: tooMany,
    truncated,
    blocked,
    anomaly: loop || tooMany || blocked,
    error,
    timeMs: Date.now() - started,
    finalHeaders: finalHop ? finalHop.headers : {},
  };
}

async function runWithConcurrency(items, limit, worker) {
  const out = new Array(items.length);
  let idx = 0;
  const runners = new Array(Math.min(limit, items.length)).fill(0).map(async () => {
    while (true) {
      const i = idx++;
      if (i >= items.length) return;
      out[i] = await worker(items[i], i);
    }
  });
  await Promise.all(runners);
  return out;
}

/* ---------------- HTTP 入口 ---------------- */

function resolveAllowedDomains(env) {
  const raw = env && env.ALLOWED_DOMAINS;
  if (!raw) return DEFAULT_ALLOWED_DOMAINS.slice();
  const list = String(raw).split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
  return list.length ? list : DEFAULT_ALLOWED_DOMAINS.slice();
}

export async function onRequestPost(context) {
  const { request, env } = context;

  // 限流
  const ip = request.headers.get("cf-connecting-ip") || "unknown";
  const rl = rateLimitHit(`ip:${ip}`, HARD_LIMITS.rateLimitPerMinute, 60000);
  if (!rl.ok) {
    return json(
      {
        error: "RATE_LIMITED",
        message: `请求过于频繁，请 ${Math.ceil((rl.retryAfterMs || 1000) / 1000)}s 后重试`,
      },
      429
    );
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "invalid JSON body" }, 400);
  }

  const rawUrls = Array.isArray(body.urls) ? body.urls : [];
  if (!rawUrls.length) return json({ error: "urls is required" }, 400);
  if (rawUrls.length > HARD_LIMITS.maxUrlsPerRequest) {
    return json(
      { error: "TOO_MANY_URLS", message: `单次最多 ${HARD_LIMITS.maxUrlsPerRequest} 条，请分批发送` },
      400
    );
  }

  const allowedDomains = resolveAllowedDomains(env);
  const guard = makeHostGuard(allowedDomains);

  const method = String(body.method || "GET").toUpperCase();
  const ua = body.ua || "Mozilla/5.0 (compatible; LinkChecker/1.0)";
  const timeoutMs = Math.min(Math.max(Number(body.timeoutMs) || 15000, 1000), HARD_LIMITS.maxTimeoutMs);
  const maxHops = Math.min(Math.max(Number(body.maxHops) || 8, 1), HARD_LIMITS.maxHops);
  const concurrency = Math.min(Math.max(Number(body.concurrency) || 6, 1), HARD_LIMITS.maxConcurrency);
  const captureBody = !!body.captureBody;

  const extra = body.headers && typeof body.headers === "object" ? body.headers : {};
  const headers = {
    "user-agent": ua,
    accept: "*/*",
    "accept-language": "en-US,en;q=0.9",
    ...extra,
  };

  const started = Date.now();

  // 先做一次静态白名单过滤，不合规的直接返回，不发请求
  const prepared = rawUrls.map((raw) => {
    const norm = normalizeUrl(raw);
    if (!norm) {
      return {
        pre: { url: String(raw || ""), status: null, error: "INVALID_URL", hops: [], redirectCount: 0, anomaly: true, blocked: true },
        url: null,
      };
    }
    let host = "";
    try {
      host = new URL(norm).hostname;
    } catch {}
    const g = guard(host);
    if (g) {
      return {
        pre: { url: norm, status: null, error: g, hops: [], redirectCount: 0, anomaly: true, blocked: true },
        url: null,
      };
    }
    return { pre: null, url: norm };
  });

  const toCheck = prepared.filter((p) => p.url).map((p) => p.url);
  const checked = await runWithConcurrency(toCheck, concurrency, (u) =>
    checkOne(u, { method, headers, timeoutMs, maxHops, guard, captureBody })
  );

  // 合并结果，保持原始顺序
  let ci = 0;
  const results = prepared.map((p) => (p.pre ? p.pre : checked[ci++]));

  return json({
    results,
    batchMeta: {
      count: results.length,
      checked: toCheck.length,
      method,
      ua,
      allowedDomains,
      elapsedMs: Date.now() - started,
    },
  });
}

export async function onRequestGet(context) {
  const allowedDomains = resolveAllowedDomains(context.env);
  return json({
    ok: true,
    endpoint: "/api/check",
    allowedDomains,
    limits: HARD_LIMITS,
    usage: "POST { urls: string[], method, ua, headers, timeoutMs, maxHops }",
  });
}

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET,POST,OPTIONS",
      "access-control-allow-headers": "content-type",
    },
  });
}
