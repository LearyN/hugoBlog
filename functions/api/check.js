/**
 * Cloudflare Pages Function — /api/check
 *
 * 并发检测一批 URL 的响应码与响应头，逐跳记录重定向，检测死循环。
 * 运行在 Cloudflare 边缘（服务端发起请求），因此不受浏览器 CORS 限制，
 * 可以完整读取每一跳的响应头。
 *
 * 请求体 (POST, application/json):
 *   {
 *     urls: string[],        // 必填，一批 URL（建议 <= 8，受 Workers 子请求数限制）
 *     method: "GET"|"HEAD"|"POST",
 *     ua: string,            // User-Agent
 *     headers: object,       // 额外请求头
 *     timeoutMs: number,     // 单跳超时，默认 15000
 *     maxHops: number,       // 最大重定向跳数，默认 8
 *     loopThreshold: number, // 超过该跳数视为异常重定向，默认 5
 *   }
 *
 * 响应:
 *   { results: CheckResult[], batchMeta: {...} }
 */

const REDIRECT_CODES = new Set([301, 302, 303, 307, 308]);

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

async function checkOne(target, opts) {
  const started = Date.now();
  const hops = [];
  const seen = new Set();
  let current = target;
  let loop = false;
  let tooMany = false;
  let error = null;
  let truncated = false;

  for (let i = 0; i < opts.maxHops; i++) {
    if (seen.has(current)) {
      loop = true;
      break;
    }
    seen.add(current);

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs);
    const hopStart = Date.now();

    let resp;
    try {
      resp = await fetch(current, {
        method: opts.method,
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
      if (seen.has(next)) {
        loop = true;
        // 再记一跳“回到原地”，让用户看到闭环
        break;
      }
      if (i + 1 >= opts.maxHops) {
        tooMany = true;
        truncated = true;
        break;
      }
      current = next;
      // 303 语义：改为 GET；301/302 历史上也常被浏览器改成 GET，这里保守处理
      if (resp.status === 303 && opts.method !== "GET" && opts.method !== "HEAD") {
        opts = { ...opts, method: "GET" };
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
    anomaly: loop || tooMany,
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

export async function onRequestPost(context) {
  const { request } = context;
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "invalid JSON body" }, 400);
  }

  const rawUrls = Array.isArray(body.urls) ? body.urls : [];
  const urls = rawUrls.map(normalizeUrl);
  if (!urls.length) return json({ error: "urls is required" }, 400);

  const method = String(body.method || "GET").toUpperCase();
  const ua = body.ua || "Mozilla/5.0 (compatible; LinkChecker/1.0)";
  const timeoutMs = Math.min(Math.max(Number(body.timeoutMs) || 15000, 1000), 30000);
  const maxHops = Math.min(Math.max(Number(body.maxHops) || 8, 1), 20);
  const concurrency = Math.min(Math.max(Number(body.concurrency) || 6, 1), 12);

  const captureBody = !!body.captureBody;
  const extra = body.headers && typeof body.headers === "object" ? body.headers : {};
  const headers = {
    "user-agent": ua,
    accept: "*/*",
    "accept-language": "en-US,en;q=0.9",
    ...extra,
  };

  const started = Date.now();
  const results = await runWithConcurrency(urls, concurrency, (u) =>
    checkOne(u, { method, headers, timeoutMs, maxHops, captureBody })
  );

  return json({
    results,
    batchMeta: {
      count: urls.length,
      method,
      ua,
      elapsedMs: Date.now() - started,
    },
  });
}

export async function onRequestGet() {
  return json({
    ok: true,
    endpoint: "/api/check",
    usage: "POST { urls: string[], method, ua, headers, timeoutMs, maxHops, concurrency }",
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
