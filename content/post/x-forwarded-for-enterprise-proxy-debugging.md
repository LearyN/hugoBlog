---
title: "One Comma, One 500: Debugging X-Forwarded-For in the Wild"
tags: ["HTTP", "Debugging", "Security", "Networking", "Proxies"]
date: 2026-10-01
draft: false
---

A colleague messaged me, mid-morning, from the other side of the world: *the site is down.*

Not "slow." Not "weird." Down. Pages returning a wall of 500s for everyone in that office. And only that office. Midtown couldn't reproduce it. The monitoring dashboard was green. The CDN was green. The uptime check that pings the homepage from three continents was green.

And here's the part that made me sit up: **when I looked at the CDN logs, the failing requests weren't there at all.** The origin gateway logs had them. So the traffic was failing somewhere that was *behind* the edge but *in front of* the application — and it was doing it without ever showing up in the place I'd instinctively look first.

The cause, when I found it, was one character. A comma.

This is the story of `X-Forwarded-For` — a header that has no owner, no formal spec until 2014, no enforcement, and a habit of breaking real production sites in ways that hide from everyone except the people it breaks.

## The bug that only one office can see

The reports were consistent: the site worked fine everywhere *except* from inside one corporate network. Users there got `500 Internal Server Error` on the page itself. Not a timeout, not a certificate warning — an error page served by the infrastructure.

The first instinct when "only some people" see a problem is *client-side*: browser, DNS, cache, an extension, a corrupt profile. The second instinct is *geo*. Both were wrong here.

What broke my assumption was the log split:

| Layer | Saw the request? |
|---|---|
| CDN edge | ❌ no record |
| Origin gateway | ✅ yes, `status 500` |

The CDN didn't serve the error — it didn't even log the request as a request it could fail. The 500 was produced by the origin gateway, and it was produced *without* the gateway ever forwarding anything upstream. The gateway had rejected the request before it went anywhere.

That's a telling fingerprint. When a reverse proxy returns `500` with no `upstream` involvement, it's not the app. It's the proxy itself, choking on something in the request. The error page even told me which software: the default OpenResty/APISIX error page, not our application's.

So the question became: what in the request is different for these users, and only these users?

## Reproduce it, or it isn't real

Uptime monitoring had passed. The reason is obvious in hindsight: the checker sends a *clean* request. Whatever was special about the office traffic wasn't present in a plain `curl` from a datacenter.

I started a matrix. Same target, same URL, one variable at a time — method, user agent, protocol, and every header I could think of that a network appliance might touch:

```
X-Forwarded-For
X-Real-IP
X-Forwarded-Proto
Accept
Accept-Encoding
Via
```

Single values first. Then for each, a variant containing a comma. The comma mattered because a comma turns a header value into a *list*, and lists are where parsers go to die.

The result was almost insultingly clean:

| Test | Result |
|---|---|
| `X-Forwarded-For: 1.1.1.1` (single value) | `200` ✅ |
| `X-Forwarded-For: 1.1.1.1,2.2.2.2` (list) | **`500`** 🔴 |
| `X-Forwarded-For: ,1.1.1.1` (leading comma) | **`500`** 🔴 |
| `X-Forwarded-For: 1.1.1.1,` (trailing comma) | **`500`** 🔴 |
| `X-Real-IP: 1.1.1.1,2.2.2.2` (list) | **`500`** 🔴 |
| Any *other* header, with commas | `200` ✅ |

Minimum reproduction, two seconds to run:

```bash
curl -sk -o /dev/null -w '%{http_code}\n' \
  -H 'X-Forwarded-For: 1.1.1.1,2.2.2.2' \
  https://example.com/
# → 500
```

One variable. The comma in a forwarded-for header. Everything else is noise.

I also confirmed the bug survived the CDN: the error came back with `x-cache: Error from cloudfront` and `server: APISIX/3.9.1`. Earlier I'd assumed the CDN would *normalize* a forwarded header before it reached the origin. It doesn't. It passed the client's value straight through.

## What X-Forwarded-For actually is

Here's the part that deserves a moment, because everything downstream follows from it.

When a request travels through a proxy, the origin sees the *proxy's* IP, not the user's. `X-Forwarded-For` exists to recover the user's address. The convention, everywhere:

> Each proxy that handles the request **appends** the address it received the connection from, separated by a comma. The **left-most** entry is the original client, per convention.

So a request that crossed one proxy and one load balancer arrives looking like:

```
X-Forwarded-For: 203.0.113.7, 198.51.100.4, 192.0.2.9
```

Nothing about that is malformed. It is **exactly what the protocol says should happen.** A multi-value `X-Forwarded-For` is not corruption; it is the normal state of any request that passed through more than one intermediary.

That's the whole trap. The header was working correctly. Our gateway was reading it incorrectly — it took the entire comma-separated string and handed it to an IP parser as if it were a *single address*. The parser hit the comma, threw, the upstream-selection step failed, and the gateway generated a 500 without ever trying to route the request.

The origin logs made the failure visible after the fact:

| Log field | Value | Meaning |
|---|---|---|
| `status` | `500` | the symptom |
| `upstreamhost` | `""` | no backend was ever selected |
| `upstream_*_time` | empty | the request was never forwarded |
| `number` | `9` | nine retries, all failed the same way |
| `user_agent` | normal Chrome | these are *real humans*, not bots |

It bears repeating: **the users did nothing wrong, and their network did nothing wrong.** A standards-compliant enterprise security appliance appended its own hop. A standards-non-compliant parser then choked on a value it should have split.

## The header that has no owner

`X-Forwarded-For` was never standardized until it was (as `Forwarded`, in [RFC 7239](https://datatracker.ietf.org/doc/html/rfc7239), which nobody adopted). In practice it is a de-facto convention implemented independently by dozens of products, each with its own idea of *append*, *replace*, *preserve*, and *parse*.

That means a request crossing a modern enterprise network can be rewritten at **five or more** layers before it reaches you:

| Layer | Examples | What it typically does to XFF |
|---|---|---|
| Client privacy tooling | VPNs, browser extensions | Injects a synthetic value (spoofing) |
| Enterprise secure web gateway | Zscaler, Netskope, Palo Alto, Forcepoint, Blue Coat | **Appends the client's address** on egress; may also *preserve* the client's original value |
| CDN / edge | Cloudflare, CloudFront, Akamai | Usually sets its own single-IP header (`CF-Connecting-IP`, `True-Client-IP`); behavior on the legacy XFF header varies |
| Load balancer | AWS ALB, GCP LB | Configurable: append / preserve / **remove** |
| Reverse proxy / API gateway | nginx, Envoy, APISIX, Kong | Parses XFF to derive the "real" client IP |

The one you hit will change the shape of the value:

- **Appending** produces the multi-value list (`a, b, c`).
- **Preserving** can duplicate: the client's spoofed value rides along next to the proxy's real one.
- **Port-suffixed** values (`203.0.113.7:54321`) are a real default — Azure Application Gateway inserts the source **port** too, which trips naive IP parsers.
- **RFC 7239 `Forwarded`** uses `for=` with possible quotes, IPv6 in brackets, and an obfuscated `_hidden` identifier — a whole other parsing surface.
- **IPv6** entries contain colons and sometimes brackets or ports, which is its own class of bug in anything that splits naively.
- **Duplicate headers** — two separate `X-Forwarded-For` lines in one request — occur in the wild and get joined or dropped unpredictably.

### The one that caught us: the enterprise gateway

The network in question routed all outbound traffic through a cloud security gateway. The classic of this genre is **Zscaler**, which documents that it *inserts an `X-Forwarded-For` header by default for all HTTP traffic*, and (in proxy-chaining deployments) carries any pre-existing value separately under `Z-Forwarded-For`. Its whole point is to tell the destination who the real user was.

So the appliance did precisely the right thing for its own mission — and produced a perfectly valid multi-hop header that the destination couldn't parse. Other agents in this space (Netskope, Prisma Access, Forcepoint) play in the same field with their own insertion rules, and several expose knobs to *disable* or *chain* XFF insertion. That knob is worth knowing when your site breaks for exactly one customer.

## Why it breaks, and where

The failure modes rhyme. They're all variations of "trusting a header you don't control":

1. **Parse-to-500.** The whole value is treated as a single IP; a list throws. This was ours. The worst version of it, because it takes the whole site down for those users.
2. **The wrong end of the list.** Taking the left-most entry trusts the *client-supplied* value — spoofable by anyone. Taking the right-most without verifying the hop chain is no better if you don't know your own topology. Correctness depends on knowing which hops are *yours*.
3. **Rate-limit bypass.** If your limiter keys on XFF and you trust the left-most value, an attacker sets a fresh fake IP per request and gets an unlimited bucket. This is a well-documented vulnerability class; there's a [long list of real CVEs and advisories](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/X-Forwarded-For) against exactly this.
4. **Access-control bypass.** Same logic, worse consequences: an IP allowlist fed by spoofable XFF is decoration.
5. **Log and analytics pollution.** Security logs, GA, and abuse detection all key on the client IP. Poison the input, poison the record.

The [MDN reference](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/X-Forwarded-For) is blunt about the rule and worth quoting:

> Any security-related use of X-Forwarded-For (such as for rate limiting or IP-based access control) must only use IP addresses added by a **trusted proxy**.

That's the crux. The header is only as trustworthy as the last hop you control. Everything else is user input.

## The debugging playbook

The reason this cost hours instead of minutes is that the signal was split across layers, and the obvious place to look (the CDN) had nothing. Here's the order I'd work in next time.

**1. Confirm which layer emitted the error.** Don't assume the app. Match the error page to the software that serves it, and check whether the CDN logged the request at all. CDN-silent + origin-logged = the failure is at or just behind the edge, not in your application.

**2. Read the log *shape*, not just the status.** An empty `upstream` field and empty upstream timings mean the gateway failed *before routing*. That single observation eliminates the entire application tier from suspicion.

**3. Build the header matrix.** One variable at a time; run the single-value and comma-value pair for every header a network appliance might touch. A stable 100% reproduction with exactly one changed variable *is* the root cause — you don't need to see inside the appliance.

**4. Separate CDN from origin.** If you can, hit the origin directly (by IP, with a Host header) and repeat the matrix both ways. If it fails both ways, the edge isn't causing it — the origin is failing to parse.

**5. Identify the mutating hop.** Stand up a request-echo endpoint (`httpbin`-style, or a one-line server that returns the headers it received) and have someone on the affected network hit it. Compare what *arrives* against what a clean client sends. The delta is your suspect. The office's egress IP and any TLS-interception certificate will often name the product outright.

**6. Correlate with the affected users' egress.** Look up the source IP in your own logs and background-check it. Cloud security gateways have recognizable ranges and ASNs. That's how you go from "some users" to "these users, behind this appliance."

**7. Only then, change something.** The fix is rarely "make the users change." It's "make the gateway parse correctly," and now you can prove it.

## Hardening: the server side

The bug was ours, not theirs. Here's what actually fixes it and keeps it fixed.

**Parse defensively — never hand a raw header to an IP parser.**

```python
def real_client_ip(xff: str | None, remote_addr: str, trusted: set[str]) -> str:
    if not xff:
        return remote_addr
    # Split, trim, drop empties and junk. Never pass the raw string through.
    chain = [p.strip() for p in xff.split(",") if p.strip()]
    # Walk from the right; stop at the first hop we don't control.
    for candidate in reversed(chain):
        if candidate not in trusted:
            return candidate
    return chain[0] if chain else remote_addr
```

**Anchor trust to CIDRs you own.** Only honor XFF entries beyond your last trusted hop. nginx's realip module does this natively — with two caveats that bite people:

```nginx
# Only these upstreams may set the client IP.
set_real_ip_from 10.0.0.0/8;
set_real_ip_from 203.0.113.0/24;

real_ip_header X-Forwarded-For;  # exact capitalization matters
real_ip_recursive on;            # walk the chain, else first value wins
```

The case of the header name is not cosmetic: `X-Forwarded-For` triggers the recursive walk; the lowercase variant silently does not. And `real_ip_recursive on` without a correct `set_real_ip_from` is worse than useless — it'll happily believe a client-supplied address.

**Prefer a single-IP header where the provider offers one.** `CF-Connecting-IP`, `True-Client-IP`, or `X-Real-IP` set authoritatively by your own edge is far less ambiguous than a list.

**Lock the origin so XFF can't be forged by direct hits.** If the world can reach your origin IP, an attacker bypasses the CDN and sets any XFF they like. Cloudflare Authenticated Origin Pulls, a shared secret header at the edge, or an allowlist that only accepts the CDN's ranges closes this. (This was the actual value in one of my earlier investigations — the "bypass the CDN" thread — even though it turned out not to be *this* bug.)

**Make the gateway fail safe, not fail 500.** A parse error in an IP-selection plugin should fall back to the connection's peer address and log loudly — never refuse to route the request. Our incident was fundamentally a "validator that throws on valid input" bug.

**Key rate limits and ACLs on something you control** — a trusted-anchored IP, a session, an account — not on a client-supplied header.

## Hardening: the enterprise side

If your site is the one that breaks for a customer, the conversation to have is with *their* network team, and it goes better when you can name the mechanism.

- Cloud security gateways (Zscaler and peers) **insert or append XFF by default**. Several expose settings to disable insertion, to carry the original value separately (e.g. `Z-Forwarded-For`), or to control proxy-chaining behavior. Point them at it.
- Understand that their appliance is **behaving correctly.** The deliverable is a bug report against *your* parser, plus a temporary workaround on their side if you need one today.
- The durable fix belongs to the service: parse the chain. Any gateway that 500s on a valid multi-hop header will eventually 500 for a *different* customer with a *different* appliance.

## What I'd do differently

Two things, honestly.

First, I initially chased the wrong thread. The header *looked* like the story — and it turned out to be — but I spent time on a "bypass the CDN" angle before a colleague pulled me back to the actual reported symptom: *these specific users, this specific office, right now.* Start from the symptom you were handed, not the one that's most interesting to investigate.

Second, I guessed at what the CDN would do with a forwarded header instead of testing it. I said, with confidence, that the edge would normalize it. It didn't. The matrix I ran afterward proved it. **Don't reason about what an intermediary does. Send a request and look.**

A header with no owner, appended by every layer that touches it, parsed by nobody with a shared standard — one comma, one 500, and a lesson in trusting input you never saw arrive.

---

*The site, the office, and the vendor have been anonymized; the reproduction, the log fields, and the failure mode are exactly as observed. If you've hit a variant of this — port-suffixed XFF from Azure, `Forwarded` RFC 7239 on an Envoy ingress, duplicate headers from some appliance I haven't met yet — I'd like to hear it.*
