+++
title = "How I Built a Global CDN Drift Checker: Detecting Inconsistent File Sizes Across Regions"
date = 2026-09-03
description = "A practical walkthrough of building a self-hosted tool that probes a static resource from dozens of geographic regions to catch CDN cache-version drift — and what I learned about edge caches along the way."
tags = ["CDN", "Cloudflare", "DevOps", "Monitoring", "DIY"]
+++

A few days ago I ran into a puzzling problem: the same image URL returned **different file sizes** depending on where in the world it was requested. Some regions got a ~12 KB version, others got a ~43 KB one — a 3.4× difference. Same URL, same origin, wildly different bytes on the wire.

That's CDN **cache-version drift**: different edge nodes had cached different generations of the same asset, likely because the image-pipeline configuration changed at some point and not all edges had expired their old copies yet. To confirm it (and to keep diagnosing it going forward), I built a small self-hosted tool that probes any static resource from dozens of regions and reports the returned file size per region.

This post is a quick write-up of how it works — the architecture, the trade-offs, and the one Cloudflare limitation that shaped the design.

## What I wanted

A tool I could open in a browser, paste any image/asset URL, and get back a table like this:

```
Region        File size    Cache status
Thailand      12,616 B     HIT
Germany       42,970 B     HIT
Brazil        12,616 B     HIT
USA           42,970 B     HIT
...
```

Rows where the size differs from the "mainstream" version get highlighted, and a summary shows how many distinct sizes exist and their max/min ratio.

The hard part is the phrase *"from dozens of regions"*.

## Option 1 (rejected): a single Cloudflare Worker

The most obvious approach is a Cloudflare Worker: it runs on Cloudflare's edge and could `fetch()` the target URL from there. But there are two hard constraints:

1. **A Worker's outbound subrequest goes out from *its own* executing edge.** Cloudflare's free plan doesn't let you pin the subrequest to a specific colo/country (that's an enterprise feature called Regional Services).
2. So a single Worker could only ever show you **one region's view** — whichever edge happened to serve the request. That defeats the whole purpose.

I still deployed a tiny probe Worker during development — it was great for confirming the drift exists (it saw the two sizes on different invocations), but it could not deliver the "global table" I wanted.

## Option 2 (chosen): client-side static page + self-hosted aggregator

The architecture that actually worked:

```
Browser (static page)
   │  paste URL → click probe
   ▼
HTTP API (Cloudflare Tunnel) ──► self-hosted backend on a VM
                                        │
                                        ▼
                              global "free proxy pool"
                              (one proxy per country, in parallel)
                                        │
                                        ▼
                                     target CDN
```

### The backend

A small Flask service exposes one endpoint, `/probe?url=...`. When called, it:

1. Pulls a fresh list of anonymous HTTP proxies from public GitHub-maintained proxy lists (several thousand IPs across the world).
2. Samples a subset, groups them by their exit country (resolved via an IP-geolocation lookup).
3. **Probes the target URL in parallel** — one fast proxy per country — issuing a `HEAD` request through each.
4. Records the returned `Content-Length`, HTTP status, `Content-Type`, and any cache headers (`x-cache`, `cf-cache-status`, `age`).
5. Aggregates everything into a JSON response with a summary (distinct sizes, min/max, ratio).

Because each proxy tunnels the request out through a different country, the target CDN sees "a user from Germany", "a user from Brazil", etc., and returns the version cached at *that* regional edge. That's exactly the multi-region perspective I needed.

### The "exit nodes"

The free proxy pool is exactly what it sounds like: anonymous HTTP proxies opened by random people/bots across the planet, aggregated into public lists. They are **not** Cloudflare edge nodes — this is important. The trade-offs are real:

- ✅ Broad geographic coverage for free
- ⚠️ Unstable: maybe ~20% of them work at any moment
- ⚠️ Slow (plain HTTP, often far away)
- ⚠️ Don't send anything sensitive through them

To compensate, the backend uses **multiple proxies per country and takes the fastest successful one**, which keeps the typical run under ~20 seconds across 15–25 countries.

### Keeping it secure and stable

Two things prevent this from being a fragile, exposed mess:

- **Cloudflare Tunnel**: the Flask backend listens only on `localhost`. A `cloudflared` tunnel exposes it through a DNS name on my existing Cloudflare zone, terminated by Cloudflare's HTTPS edge. No raw public port on the VM, no leaked IP.
- **systemd services**: both the backend and the tunnel run as systemd units with `Restart=always`, so they survive reboots and crashes.

The static page is just HTML/JS served by my existing static hosting — no server-side rendering, no API keys in the browser.

## What I learned

- **Check the bytes, not just the status code.** Most uptime monitors tell you "it's 200". They won't tell you one edge serves a 12 KB version and another a 43 KB one. For a CDN-backed site with dynamic image processing, byte-size is a first-class health signal.
- **Cloudflare free-tier Workers can't fake geography.** Great for single-point probes; useless for multi-region comparison. Know the limitation before architecting around it.
- **Free proxies are a blunt instrument, but a useful one.** For occasional diagnostics they're perfectly adequate. If I ever need this to be production-grade, I'd swap the free pool for a paid residential-proxy API and gain stability and speed.

## Conclusion

Within a couple of hours I had a browser-based, self-hosted diagnosis tool that answers "does this asset differ across regions?" in ~20 seconds. It caught a real 3.4× cache drift on our own CDN, which was the whole point.

If you manage a CDN-backed site with any kind of on-the-fly image processing, I'd suggest adding a byte-size check across regions to your toolkit — it will surprise you how often two "identical" URLs aren't identical at all.
