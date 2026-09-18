---
title: "The Ghost Redirect: When a Third of Your Pages 301 to Themselves"
tags: ["SEO", "CDN", "Debugging", "HTTP", "Concurrency"]
date: 2026-09-18
draft: false
---

A colleague handed me a file with a few hundred URLs and a simple ask: *check these, tell me if anything's broken.*

That's usually a fifteen-minute job. Paste into a script, fire off some requests, eyeball the status codes, done. Instead it turned into one of the more interesting HTTP bugs I've run into — a redirect that points at itself, invisible to the people it was breaking, and one I initially got *wrong*.

Because here's the thing about this one: my first conclusion was plausible, well-evidenced, and incorrect. What follows is both the investigation and the correction.

## The task, and why it's harder than it looks

A few hundred URLs, mostly content pages on a site I help look after. I needed three things per URL:

1. The **response code**
2. The **response headers**
3. If it redirected, **every hop** of the redirect chain

Items 1 and 3 sound trivial. They aren't, and the reason shaped the whole tool.

**You can't do this from the browser.** A page running JavaScript can `fetch()` another URL, but the browser won't let it read the response headers of a cross-origin response unless that origin opts in with CORS headers. The whole point was to read headers, so a pure front-end tool was dead on arrival. I needed something server-side that made the requests and handed the results back.

**You can't just "follow redirects" either.** `curl -L` and most HTTP libraries will chase a redirect chain to its end and show you only the final response. That hides the thing I actually wanted: the intermediate hops, each with its own status code and headers. So the tool had to set `redirect: manual`, catch each `3xx`, read the `Location` header itself, and issue the next request by hand — recording status and headers at every step.

That manual hop-by-hop approach has a side effect that turned out to be the whole ballgame: you can *see* a loop. Follow redirects automatically and an infinite loop just shows up as a timeout. Walk the chain yourself, keep a set of URLs you've already visited, and you notice the exact moment a chain returns somewhere it's already been.

## Building the checker

The design that fell out of those constraints:

- **Server-side, concurrent.** A small service that takes a batch of URLs, checks them in parallel, and returns structured results.
- **Manual redirect walking**, capped at a configurable hop limit, with a visited-set to detect loops.
- **Full header capture at every hop**, not just the final response.
- **Switchable request profiles** — user agent, method, and arbitrary headers — because different clients get treated differently, and I wanted to test that hypothesis the moment it came up.

The output was a table: URL, final status, hop count, and an expandable per-hop view showing each step's status code and headers. Loops got flagged in red.

Then I pointed it at the list, and about a tenth of the pages lit up.

## "Dead loop" on pages that looked fine

The tool flagged a pile of URLs as redirect loops. I opened one in a browser: it loaded fine. Opened it with `curl`: 200 OK. Opened it through the tool: **301, pointing to itself.**

```
HTTP/2 301
Location: /the/same/path/     ← the exact URL I requested
```

Not a redirect to a canonical version, not a redirect to a different locale — a redirect to *itself*. Follow it and you land in the same place, which issues the same redirect, forever. In a real browser this is `ERR_TOO_MANY_REDIRECTS`. A blank error page.

But it **wasn't reproducible.** Same URL, moments apart, one check returned 200 and the next returned 301. A browser saw a working page. A script saw a broken one.

That disagreement between "what the user sees" and "what a bot sees" is usually where the interesting bugs live. So I stopped trusting any single observation and started running controlled experiments.

## The first suspect: a request header

I stripped the request to bare bones and added headers back one at a time.

The trigger appeared to be `Accept-Encoding`.

| Request header | Result |
|---|---|
| `Accept-Encoding: identity` | 200 OK |
| `Accept-Encoding: deflate` | 200 OK |
| `Accept-Encoding: br` | 200 OK |
| `Accept-Encoding: gzip` | **301, self-referential** |
| `Accept-Encoding: gzip, deflate, br` | **301, self-referential** |

`gzip` — the encoding essentially every browser sends by default, and that Googlebot sends too.

That explained the disagreement perfectly. My tool sent a browser-like `Accept-Encoding` and got a loop. A plain `curl` with no `Accept-Encoding` got a clean 200. A real browser, which *does* send `gzip`, would hit the broken path.

Clean, causal, reproducible. I wrote it up and moved on.

I was wrong.

## The second experiment: bypass the cache

One more check before calling it: is the origin broken, or is something in front of it?

Defeat any caching by making every request unique:

```
GET /the/path/          → 301 (self-referential)
GET /the/path/?x=12345  → 200 OK
```

Same path, same headers, same moment. Only difference: a query string that guarantees a cache miss.

So the origin is fine, and something is caching the broken 301. That led me to the header that looked like the smoking gun.

## The smoking gun (or so I thought)

A cache decides what counts as "the same request" using the `Vary` header, which lists the request headers that affect the response.

I diffed a broken page against a healthy one:

```
Broken (301):  Vary: Origin
Healthy (200): Vary: Accept-Encoding, Origin
```

The healthy responses correctly declare they vary by `Accept-Encoding` — a gzipped body and an uncompressed body must not be served interchangeably. The broken 301 is missing `Accept-Encoding` from its `Vary`. So from the cache's point of view that 301 is *the same response for every encoding* — and once cached, it gets handed to everyone.

That story hangs together: origin glitches once → CDN caches the bad 301 → because `Vary` is incomplete, the poison spreads to all encodings → users get error pages.

I published it.

## But the evidence didn't fit

The nagging problem was the cache-bypass test. If the CDN were the mechanism, then bypassing the cache should *always* give me a clean 200.

It didn't. With a unique query string — a guaranteed cache miss, straight to the origin — I was still getting self-referential 301s. Roughly a third of the time, in fact.

The cache couldn't be the cause if the bad response came back with the cache completely out of the picture. The `Vary` header explained why the *damage spread* — it didn't explain why the 301 existed in the first place.

So I threw out the header variable entirely and went looking for the real one.

## The 2×2 experiment

If it wasn't the encoding, what was different between the requests that failed and the ones that didn't? The obvious remaining variable was **how I was sending them**: concurrently, to a batch of different URLs.

So I built a controlled experiment with two factors, interleaved so that any drift over time would land evenly on all four cells:

- **Factor A — pacing:** slow serial (0.8s between requests) vs. fast (20 in parallel)
- **Factor B — targets:** the same URL repeated vs. 20 *different* URLs

| | Same URL | **Different URLs** |
|---|---|---|
| **Slow serial** | 0% | 0% |
| **Fast parallel** | 0% | **~30%** |

Only one cell lights up. And it needs *both* factors: concurrency alone doesn't do it (same URL, parallel → 0%), and multiple URLs alone doesn't do it (different URLs, slow → 0%).

The `Accept-Encoding` result had been a red herring. Under high concurrency, `gzip` and `identity` produced *identical* failure rates (~40% each). What I'd actually been seeing earlier was that, at *low* concurrency, browser-style requests happened to land on cache entries that were already poisoned — so it *looked* like the header mattered. The header was a passenger, not the driver.

I mapped the threshold:

| Concurrency | Failure rate |
|---|---|
| 1 | 0% |
| 3 | 0% |
| 6 | ~4% |
| 12 | ~21% |
| 24 | ~25% |

Somewhere around six simultaneous requests to distinct paths, it starts. Above that, it climbs fast.

And it only affected **deeper paths** — three-level URLs — while top-level pages and two-level pages stayed at zero.

## Two different CDNs, same symptom

Here's where it got decisive. A second site, a sibling of the first, ran on a **completely different CDN vendor** — different edge network, different caching software, different everything except the origin behind it.

Same bug. Same self-referential 301. Same concurrency trigger, same threshold, same deep-path-only pattern.

That's the experiment you can't argue with. Two independent CDN vendors don't share a caching bug. The only thing they had in common was the application behind them.

The CDN wasn't the disease. It was an amplifier.

## Whose redirect is it, anyway?

There was one more thing to nail down: *which layer* was emitting the 301. A request passes through several — the edge, the gateway, the application — and any of them could, in principle, redirect.

Fortunately, different layers sign their work differently. I started capturing the raw redirect and looking at two fingerprints: the shape of the `Location` header, and the response body.

| Source | `Location` | Body |
|---|---|---|
| Gateway-level rule | **absolute** (`https://host/path/`) | generic proxy error page |
| Application framework | **relative** (`/path/`) | framework's default redirect template |

Every single self-referential 301 I captured — dozens across both sites — had a **relative** `Location` and the application framework's default redirect body. Zero had the gateway's signature.

So the redirect came from the application, not the edge and not the gateway. Combined with everything else, the picture closed: the app was receiving requests whose trailing slash had been stripped somewhere upstream, deciding the path needed a slash appended, and redirecting to the "corrected" URL — which was byte-for-byte the URL the client had originally requested. From the outside: a redirect to itself.

## Where the investigation stops

We know a lot now, and I want to be honest about the edge of it.

**What's established:** the defect lives in the origin application. It fires when multiple *distinct* paths are requested concurrently, above a threshold of roughly six. It only affects deeper paths. It produces a self-referential redirect. The CDN then caches that bad redirect, and because the redirect's `Vary` header omits `Accept-Encoding`, the poison spreads to every client. Two different CDNs, same origin, same bug — the origin is the common factor.

**What's still open:** *why* the trailing slash goes missing under concurrency. The evidence points at something between the edge and the application — a normalization step, a routing cache, a per-worker state difference — but pinning it down needs logs from inside the origin that we don't have access to.

That's the honest boundary. We found the disease and the transmission mechanism. The exact internal trigger is a job for whoever owns that application.

## What I'd take from this

**My first answer was wrong, and the tell was that it didn't survive its own test.** The `Vary` header explained the *spread* of the damage, not its *origin*. I'd been satisfied with "this explains the symptom" when I should have asked "does this explain *all* the evidence?" One experiment — the cache bypass — quietly contradicted my conclusion, and I nearly filed it under "nuance" instead of "my theory is broken."

**Isolate your variables, then isolate them again.** I thought I'd found the variable with `Accept-Encoding`. But I'd only varied one thing at a time while another variable — concurrency — was changing underneath me. The 2×2 design, where I crossed both factors deliberately, is what exposed the impostor.

**A control that contradicts you is a gift.** The plain-`curl` request that returned 200 wasn't a curiosity to explain away. It was the control showing me the difference that mattered.

**Two independent systems failing identically points at what they share.** The cross-CDN comparison was the strongest single piece of evidence in the whole investigation, and it cost almost nothing to get.

**Know your layers' fingerprints.** Capturing the raw redirect and reading its signature — relative vs. absolute `Location`, framework template vs. proxy error page — turned "some server did this" into "this specific layer did this." Cheap to do, decisive to have.

**"Intermittent" usually means state, and state usually means concurrency.** When something works and then doesn't, without a deploy in between, look for a cache, a session, or a race. This one was a race — and it only showed up when enough requests hit enough different paths at once.

**A missing word in a header can still be an outage.** The `Vary` finding was real; it just wasn't the cause. `Vary: Origin` versus `Vary: Accept-Encoding, Origin` looks like noise until you realize the second is what stops a cache from handing the wrong response to the wrong client. It was the amplifier, not the source — and both matter.

The tool itself was an afternoon of work. The bug it found had been quietly breaking pages for who knows how long — invisible to any check that didn't look at every URL, walk every hop, and try it under load.

Sometimes the boring tool is the one that pays for itself. And sometimes the interesting part isn't the bug — it's catching yourself getting it wrong.
