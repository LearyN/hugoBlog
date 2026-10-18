---
title: "Building a News Indexing Pipeline: Sitemap → URL Inspection → Indexing API"
date: 2026-10-18
draft: false
description: "A practical walkthrough of a five-minute-loop pipeline that finds unindexed news URLs via URL Inspection and pushes only those into the Indexing API — plus the six metrics worth tracking, and why 200 submissions a day is a ceiling, not a target."
tags: ["SEO", "Indexing API", "Search Console", "Python", "Automation"]
---

Your CMS publishes an article. Sitemap gets pinged. Then — nothing. Googlebot shows up four hours later, or the next morning, or the day after. For news content, "the day after" means the story is already dead.

So I built a small pipeline that closes that gap. It polls the news sitemaps every five minutes, asks Search Console whether each URL is *actually* indexed, and only pushes the ones that aren't into the Indexing API. Then it watches what happened and reports on it.

The whole thing is under 400 lines of Python. But the interesting part isn't the code — it's knowing which numbers to look at afterwards, because a pipeline you can't measure is just a cron job with delusions.

## TL;DR

```
pull sitemap → URL Inspection API (real index status) → Indexing API (URL_UPDATED) → measure
```

Measured over a five-day window on two country sites in three languages:

| Metric | Result |
|---|---|
| URLs tracked | 208 |
| Indexed | 202 (**97.1%**) |
| Submissions | 145 |
| Submission failures | 0 |
| Re-submissions needed | 0 |
| Median time to index | **2.63 hours** |
| P90 time to index | 17.87 hours |
| Fastest | 5 minutes |

That 97.1% is not a brag — it's partly the pipeline, and partly Google just being fast on news. Configuring the same setup for a site that publishes twice a week and gets nothing out of it is entirely possible.

## Prerequisites (the part that actually breaks)

Three things, and each one fails differently.

### 1. A service account with the right scopes

You need two APIs on one service account:

- **Search Console API** (`webmasters.readonly`) — for URL Inspection
- **Indexing API** (`indexing`) — for submissions

```python
from google.oauth2 import service_account
from googleapiclient.discovery import build

creds_wm  = service_account.Credentials.from_service_account_file(KEY, scopes=["https://www.googleapis.com/auth/webmasters.readonly"])
creds_idx = service_account.Credentials.from_service_account_file(KEY, scopes=["https://www.googleapis.com/auth/indexing"])

sc = build("searchconsole", "v1", credentials=creds_wm,  cache_discovery=False)
ix = build("indexing", "v3",      credentials=creds_idx, cache_discovery=False)
```

### 2. The Indexing API must be *enabled* in the Cloud project

Not just "the service account exists." Enable `indexing.googleapis.com` explicitly. If you skip this, you get a 403 whose message talks about the API never having been used in the project — which reads like a permissions error and sends you down a credentials rabbit hole for an hour.

### 3. The service account must be **Owner** in Search Console, not Full User

This one is the classic trap, and it's the one that cost me the most time.

`siteFullUser` is enough for the Search Console API. It is **not** enough for the Indexing API. The error is:

```
Permission denied. Failed to verify the URL ownership.
```

The fix is to go into Search Console → Settings → Users and permissions and promote the service account's email from *Full* to *Owner*. That's it. Same credentials, suddenly works.

> Sanity-check command: call `sites().list()` and look at `permissionLevel`. If it says `siteFullUser`, submissions will keep failing no matter how many times you re-read your code.

Also: adding the service account as a *delegated* user in your Workspace does nothing here. It has to be a property-level owner.

## The pipeline

Four stages, each independently debuggable. That separation matters more than it sounds — when something stops working you want to know *which* stage went dark without re-reading the whole file.

### Stage 1 — Pull the sitemap

News sitemaps are the right input: they're small, curated, and updated on publish.

```python
NS = {
    "sm":   "http://www.sitemaps.org/schemas/sitemap/0.9",
    "news": "http://www.google.com/schemas/sitemap-news/0.9",
}

def fetch_sitemap(url):
    r = requests.get(url, headers={"User-Agent": UA}, timeout=30)
    r.raise_for_status()
    root = ElementTree.fromstring(r.content)
    out = []
    for u in root.findall("sm:url", NS):
        loc = u.findtext("sm:loc", default="", namespaces=NS).strip()
        if not loc:
            continue
        pub  = u.findtext("news:news/news:publication_date", default="", namespaces=NS).strip()
        last = u.findtext("sm:lastmod", default="", namespaces=NS).strip()
        out.append({"url": loc, "pub_date": pub or last})
    return out
```

Merge multiple sitemaps (per language, per section) into one dict keyed by URL. Later entries overwrite earlier ones, which naturally keeps the newest `publication_date`.

### Stage 2 — Ask Search Console what's *really* true

This is the step most tutorials skip, and it's the most important one. The Indexing API doesn't tell you whether a URL got indexed. It only tells you the notification was accepted. Those are wildly different facts.

`urlInspection().index().inspect()` returns the real state:

```python
def inspect_url(sc, site, url):
    res = sc.urlInspection().index().inspect(
        body={"inspectionUrl": url, "siteUrl": site}
    ).execute()
    idx = (res.get("inspectionResult") or {}).get("indexStatusResult") or {}
    return (
        idx.get("verdict", "UNKNOWN"),           # PASS / NEUTRAL / FAIL
        idx.get("coverageState", ""),            # human-readable reason
        idx.get("lastCrawlTime", ""),
    )
```

`verdict == "PASS"` means indexed. Everything else — `Discovered - currently not indexed`, `Crawled - currently not indexed`, `URL is unknown to Google`, `NEUTRAL` — means not indexed, and each one means something different (see "what this can't fix" below).

**Note the quota:** the URL Inspection API is metered separately — roughly 2,000 queries per day per property, 600 per minute. That's why you cache aggressively and don't re-check URLs you already know are indexed.

### Stage 3 — Submit only what's missing

```python
def submit_url(ix, url):
    try:
        resp = ix.urlNotifications().publish(
            body={"url": url, "type": "URL_UPDATED"}
        ).execute()
        return True, resp.get("urlNotificationMetadata", {})
    except HttpError as e:
        return False, f"HTTP {e.resp.status}: {str(e)[:300]}"
```

`URL_UPDATED` for a new or changed page, `URL_DELETED` for removals. That's the whole API surface — two notification types, one endpoint.

### Stage 4 — Remember what you did

This is where most homegrown scripts become a problem instead of a solution. Three pieces of state per URL:

```json
{
  "last_checked":  "2026-10-15T09:12:04+08:00",
  "last_verdict":  "NEUTRAL",
  "coverage_state": "Discovered - currently not indexed",
  "submit_count": 1,
  "last_submit":  "2026-10-15T09:12:41+08:00",
  "first_seen":   "2026-10-15T08:40:00+08:00"
}
```

Plus an append-only JSONL log of every submission, used for daily quota accounting. Then enforce the three rules that keep you from being a nuisance:

| Rule | Value | Why |
|---|---|---|
| Max submits per URL | 3 | Prevents hammering the same URL forever |
| Min gap between retries | 48 hours | Google needs time to act |
| Daily submission budget | 180 | Official ceiling is 200; keep headroom |

The 180 cap is deliberate. If you routinely bump into 200 you're not doing SEO, you're doing denial of service on your own crawl budget.

## What to measure (this is the real content)

The pipeline's job is to submit. The reporting's job is to tell you whether submitting is doing anything. Six numbers, in descending order of how much I care about them.

### 1. Index coverage rate

`indexed / tracked`. Everything else is downstream of this.

Ours came out at **97.1%** (202/208). Industry-normal for a well-structured news site is more like 60–80%, so this is a genuinely healthy number — but read it as a *ceiling check*, not a success metric. If it drops below ~90%, something structural broke: canonical tags, sitemap validity, a robots change, or a templating deploy.

### 2. Submit success rate

`successful_submissions / attempted`. This is a **plumbing** metric, not a ranking metric. 145 for 145 with zero failures means credentials and quota are fine and you can stop looking at that part of the system.

If this drops, it's one of exactly three things: expired/rotated key, quota exhausted, or the owner-permission problem above. It will never degrade gradually. It's binary.

### 3. Submit → index conversion

Of the URLs you pushed, how many ended up indexed? Split the cohort in two:

- **Submitted and then indexed** — the pipeline is doing work
- **Never submitted but indexed anyway** — Google found it through the sitemap on its own

Ours: **63 URLs (30%) were never submitted and got indexed naturally.** That single number reframes the whole project. The Indexing API is not the mechanism by which content gets indexed. It's an accelerant for the subset that would otherwise linger. Confusing the two leads people to submit *everything*, which is exactly how you burn quota for zero marginal result.

### 4. Time-to-index distribution — not the average

Track submission timestamp, then measure when `verdict` flips to `PASS`. Report percentiles, never the mean.

| Percentile | Time |
|---|---|
| Fastest | 5 minutes |
| P10 | 20 minutes |
| P25 | 46 minutes |
| **Median** | **2.63 hours** |
| P75 | 7.15 hours |
| P90 | 17.87 hours |
| Mean | 5.65 hours |
| Max | 25.09 hours |

The mean (5.65h) is a lie told by a bimodal distribution. Here's the actual shape:

| Bucket | Share |
|---|---|
| ≤ 1 hour | 32% |
| 1–6 hours | 40% |
| 6–12 hours | 7% |
| 12–24 hours | 19% |
| 24–48 hours | 1.4% |

Two peaks. A fast peak inside an hour — those are the ones the Indexing API genuinely accelerated. And a slow peak at 12–24 hours, which is a **nightly batch window** on Google's side, not a failure. The worst thing you can do here is build an alert on "still not indexed after 4 hours" and then page yourself every evening.

**And the genuinely actionable finding:** time-to-index varied ~8× by language. The original-language pages landed in a **0.58 hour** median; the translated versions of the same stories took **4.67–4.84 hours**. Not a config issue, not a bug — Google applies more scrutiny to pages it reads as derivative translations, so it verifies originality before indexing.

That's a content-strategy answer, not an engineering one. Which means: if a translated locale is your priority market, the Indexing API is the wrong lever. Rewriting the translations so they read as native and adding internal links to give them their own weight in the site graph is the right lever.

### 5. Retry count and stuck URLs

Track how many URLs ever needed a second submission, and keep a permanent list of anything submitted but still not `PASS` after a few days.

Ours: **zero re-submissions.** Everything either indexed on the first push or was never going to. That's the healthy state, and it's a useful signal — if re-submits start climbing, either Google's behavior changed or your content quality dropped.

The stuck list is where the diagnosis lives. Six URLs sat unresolved, in three distinct states:

| Coverage state | What it means | What to do |
|---|---|---|
| `URL is unknown to Google` | Never discovered at all | Check sitemap inclusion, canonical, internal links |
| `Discovered - currently not indexed` | Known, queued, not fetched | Wait, or strengthen internal linking |
| `Crawled - currently not indexed` | **Fetched and rejected on quality** | Content work. Resubmitting does nothing. |

That last row is the one people refuse to accept. `Crawled - currently not indexed` is a *verdict on the page*. You can push it into the Indexing API ten times; Google has already read it and decided it isn't worth an index slot. The fix is thinner-content triage, duplicate detection, or internal-link support — not more API calls.

### 6. Quota consumption per day

`submissions_today / budget`. Boring, until the day it isn't. Log it every run and keep the number visible in the report. A pipeline that silently consumes 200/day forever is one that lost its dedupe logic somewhere around commit forty.

Bonus metric, if you run a publishing operation: **submissions per day vs. new articles per day**. Ours tracked almost exactly 1:1 with zero backlog. A persistent gap in either direction is a bug — either you're missing articles, or you're re-submitting.

## What the pipeline cannot do

Worth saying plainly, because most Indexing API write-ups oversell it:

- **It does not guarantee indexing.** Google's documentation scopes the API to `JobPosting` and `BroadcastEvent` markup. News pages are officially best-effort.
- **It does not fix content quality.** See the table above.
- **It does not replace the sitemap.** Sitemaps remain the coverage mechanism; the API just prompts an earlier crawl.
- **It does not work below the polling floor.** Our fastest index was 5 minutes — identical to our poll interval. Google processed it faster than we could check. Reducing the interval below the actual processing latency doesn't make indexing faster; it just burns inspection quota.

## Google just rewrote the quota docs (October 2026)

If you're building this now, there's a recent wrinkle worth knowing about. On **October 16, 2026**, Google quietly rewrote three Indexing API documentation pages — the [quickstart](https://developers.google.com/search/apis/indexing-api/v3/quickstart), the [usage guide](https://developers.google.com/search/apis/indexing-api/v3/using-api), and the [quota page](https://developers.google.com/search/apis/indexing-api/v3/quota-pricing). [Search Engine Roundtable covered it](https://www.seroundtable.com/google-updates-indexing-api-quota-information-42316.html), and Google's own changelog entry was minimal: they "updated the Indexing API quota page to reflect the current quota limits and process" and "removed an outdated form."

What actually disappeared:

- The description of an **"initial default quota for testing"** that required approval to exceed
- The explicit **"default 200 quota"** line on the quickstart page
- The instruction to **fill out a form to request quota beyond the default**
- The **sitemap recommendation** section, which used to advise using the API instead of sitemaps for short-lived pages

The quota page as it stands today lists the numbers without any of the approval framing:

| Quota | Value |
|---|---|
| Publish requests per day per project (`URL_UPDATED` + `URL_DELETED`) | **200** |
| `getMetadata` requests per minute per project | 180 |
| All endpoints, per minute per project | 380 |
| Price | Free |

Daily quota resets at **midnight Pacific Time**, and the reset can take up to 24 hours to take effect — which is why a script that assumes "new day, fresh 200" at 00:00 local time will occasionally get throttled.

The community response was immediate and skeptical. Alexander Chukovski [pointed out](https://x.com/alexchukovski/status/2111098596477010336) that a new service account still gets 200/day in practice, and that the approval form has simply moved into the Cloud Console rather than being abolished. Nick LeRoy [reported](https://x.com/NickLeRoy/status/2111116826012705196) that his test tool still validated the 200 publish status while `getMetadata` returned 404 — i.e. the notification was accepted but never reached the index queue.

The practical read: **the documented policy got looser, the enforced behavior didn't change.** Build against 200/day, assume it's an actual ceiling, and don't interpret the documentation cleanup as an invitation to scale up submissions.

## Please don't abuse it

The Indexing API is free, undocumented-as-rate-limited in spirit, and completely unattended. That combination is exactly the kind of thing that gets locked behind an approval process — which, notably, is what the old documentation had, and what the new documentation just removed.

So, three rules I'd hold anyone to:

**Don't submit URLs that aren't new or changed.** `URL_UPDATED` means *this content changed*. Using it as a "please crawl me" button on a 40,000-page archive is the single fastest way to ruin the signal for everyone, and to get your own project throttled.

**Don't submit what's already indexed.** The URL Inspection API exists precisely so you don't have to guess. Every unnecessary submission is a request someone else's legitimate content could have used.

**Don't resubmit your way around a quality problem.** If Google crawled the page and declined to index it, the answer is content, not another push. Re-pushing a rejected page is not persistence — it's noise.

The API works because it's a *signal*, not a channel. The moment it becomes a firehose, it stops being trusted, and the next documentation update won't be removing a form — it'll be adding one back.

---

*Built and measured over a five-day window on two country sites in three languages, 208 URLs tracked. Numbers above are from that window; your mileage will differ by content type, publishing cadence, and how much Google already trusts your domain.*
