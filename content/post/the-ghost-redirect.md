---
title: "The Ghost Redirect: When a Third of Your Pages 301 to Themselves"
tags: ["SEO", "CDN", "Debugging", "HTTP", "CloudFront"]
date: 2026-09-18
draft: false
---

A colleague handed me a file with a few hundred URLs and a simple ask: *check these, tell me if anything's broken.*

That's usually a fifteen-minute job. Paste into a script, fire off some requests, eyeball the status codes, done. Instead it turned into one of the more interesting HTTP bugs I've run into — a redirect that points at itself, hidden behind a request header, baked into a CDN cache, and invisible to the people it was breaking.

Here's what happened, and how the checking tool I built for the job ended up finding it.

## The task, and why it's harder than it looks

A few hundred URLs, mostly content pages on a site I help look after. I needed three things per URL:

1. The **response code**
2. The **response headers**
3. If it redirected, **every hop** of the redirect chain

Items 1 and 3 sound trivial. They aren't, and the reason is worth spelling out, because it shaped the whole tool.

**You can't do this from the browser.** A page running JavaScript can `fetch()` another URL, but the browser will not let it read the response headers of a cross-origin response unless that origin explicitly opts in with CORS headers. The whole point was to read headers, so a pure front-end tool was dead on arrival. I needed something server-side that made the requests and handed the results back.

**You can't just "follow redirects" either.** `curl -L` and most HTTP libraries will happily chase a redirect chain to its end and show you only the final response. That hides the thing I actually wanted to see: the intermediate hops, each with its own status code and headers. So the tool had to set `redirect: manual`, catch each `3xx`, read the `Location` header itself, and issue the next request by hand — recording status and headers at every step.

That manual hop-by-hop approach has a nice side effect: you can *see* a loop. If you're following redirects automatically, an infinite loop just shows up as a timeout or a `too many redirects` error. If you're walking the chain yourself, you can keep a set of the URLs you've already visited and notice the moment a chain returns somewhere it's already been.

That last part is what turned a routine link check into a bug hunt.

## Building the checker

The design that fell out of those constraints:

- **Server-side, concurrent.** A small service that takes a batch of URLs, checks them in parallel, and returns structured results.
- **Manual redirect walking**, capped at a configurable hop limit, with a visited-set to detect loops.
- **Full header capture at every hop**, not just the final response.
- **Switchable request profiles** — user agent and method — because different clients get treated differently by servers, and I wanted to be able to test that hypothesis the moment it came up. (Spoiler: it came up.)

The output was a table: URL, final status, hop count, and an expandable per-hop view showing each step's status code and headers. Loops and over-limit chains got flagged in red.

Then I pointed it at the list, and about a tenth of the pages lit up.

## "Dead loop" on pages that looked fine

The tool flagged a pile of URLs as redirect loops. I opened one in a browser: it loaded fine. Opened it with `curl`: 200 OK. Opened it through the tool: **301, pointing to itself.**

```
HTTP/2 301
Location: /the/same/path/     ← the exact URL I requested
```

Not a redirect to a canonical version, not a redirect to a different locale — a redirect to *itself*. Follow it and you land in the same place, which issues the same redirect, forever. In a real browser this is `ERR_TOO_MANY_REDIRECTS`. A blank error page.

But here's the thing that made me suspicious rather than alarmed: **it wasn't reproducible.** Same URL, moments apart, one check returned 200 and the next returned 301. A browser saw a working page. A script saw a broken one.

That kind of disagreement between "what the user sees" and "what a bot sees" is usually where the interesting bugs live. So I stopped trusting any single observation and started running controlled experiments.

## The header that flips the switch

I stripped the request down to bare bones and added headers back one at a time.

The trigger was `Accept-Encoding`.

| Request header | Result |
|---|---|
| `Accept-Encoding: identity` | 200 OK |
| `Accept-Encoding: deflate` | 200 OK |
| `Accept-Encoding: br` | 200 OK |
| `Accept-Encoding: gzip` | **301, self-referential** |
| `Accept-Encoding: gzip, deflate, br` | **301, self-referential** |

`gzip` — the one encoding essentially every browser sends by default, and that Googlebot sends too.

So the picture sharpened considerably. My tool was sending a browser-like `Accept-Encoding` and getting a loop. A plain `curl` with no `Accept-Encoding` got a clean 200. That's why the browser "worked" in my manual test — and why a real browser, which absolutely does send `gzip`, would *not*.

The bug was real. My manual check had been the misleading one.

## The second experiment: bypass the cache

Next question: is the origin broken, or is something in front of it?

Easy test — defeat any caching by making every request unique:

```
GET /the/path/          → 301 (self-referential)
GET /the/path/?x=12345  → 200 OK
```

Same path, same headers, same moment. The only difference is a query string that guarantees a cache miss.

The origin is fine. Something is caching the broken 301 and serving it back.

## The smoking gun: one missing word in a header

If a CDN is caching responses, it decides what counts as "the same request" using the `Vary` header. `Vary` tells the cache which request headers affect the response, and therefore which requests can share a cached copy.

I compared the `Vary` header on a broken page against a healthy one:

```
Broken (301):  Vary: Origin
Healthy (200): Vary: Accept-Encoding, Origin
```

There it is.

The healthy responses correctly declare that they vary by `Accept-Encoding` — which makes sense, because a gzipped response and an uncompressed response are different bodies and must not be served interchangeably.

The broken 301 is missing `Accept-Encoding` from its `Vary`. So from the cache's point of view, that 301 is the *same response for every encoding*. Once it's cached, it gets handed to everyone — including the browser-style requests that should have received a normal 200.

The mechanism, assembled:

1. At some point, the origin emitted a self-referential 301 for one encoding variant — a bug in itself, but a survivable one.
2. The CDN cached that 301.
3. Because the cached response's `Vary` omitted `Accept-Encoding`, the cache treated it as valid for **all** encoding variants.
4. Every subsequent request — `gzip`, `br`, `identity`, browser, bot — got the poisoned 301.
5. Users got `ERR_TOO_MANY_REDIRECTS`. Googlebot got a redirect loop and couldn't index the page.

A single missing token in a response header, upstream of a cache, turned a transient glitch into a persistent outage.

## The scale of it

Across the batch, the affected set was large — and, tellingly, *unstable*. Repeated runs over the same list returned different counts: a big number, then a smaller one, then smaller again, before settling.

That instability is itself diagnostic. If the bug were a static misconfiguration, the affected set would be constant. A shifting set means bad responses are being **written into the cache over time and expiring out** — the poisoned entries are a moving target, so the pages that are broken right now aren't necessarily the ones that were broken an hour ago.

Which explains why this had gone unnoticed. If you spot-check a handful of pages and they happen to be on the healthy side of the cache at that moment, everything looks fine. You have to check *all* of them, *with realistic request headers*, to see it.

Both real browsers and Googlebot were affected identically — because both send `gzip`. This wasn't a bot-specific quirk. Real people were hitting error pages; search engines were failing to index. The traffic data would eventually have shown it, as pages silently dropped out of the index.

## What I'd take from this

A few things I've filed away.

**Test with the headers real clients send.** The single most useful move in this whole investigation was making my requests look like a browser's. A stripped-down request is a great *control* — it tells you what the origin does in isolation — but it's a terrible way to answer "what do users experience." The bug lived precisely in the gap between the two.

**Follow redirects by hand when you're hunting loops.** Automatic following hides the chain and turns a loop into a generic error. Walking the hops yourself gives you the full picture and makes loops obvious instead of merely fatal.

**"Intermittent" usually means state.** When something works and then doesn't, without a deploy in between, there's almost always a cache, a session, or a race involved. The randomness isn't random; it's a key you haven't identified yet.

**Compare a broken case to a healthy one.** I didn't reason my way to the `Vary` header from first principles. I diffed a broken response against a working one and the answer was sitting in the difference. When two things behave differently, the explanation is usually in what's different about them.

**A missing word in a header can be an outage.** `Vary: Origin` versus `Vary: Accept-Encoding, Origin` looks like noise until you realize the second one is what stops a cache from handing the wrong response to the wrong client. The smallest, least glamorous part of the stack was the part that mattered.

The tool itself was maybe an afternoon of work. The bug it found had been quietly breaking pages for who knows how long — and would have stayed invisible to any check that didn't look at every URL, with the right headers, all the way down the redirect chain.

Sometimes the boring tool is the one that pays for itself.
