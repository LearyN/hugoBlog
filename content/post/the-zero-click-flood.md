---
title: "The Zero-Click Flood: How a Rank Tracker Learned to Look Human, and Started Writing Itself Into Your Search Console"
tags: ["SEO", "GSC", "bots", "AI", "crawlers"]
date: 2026-10-20
lastmod: 2026-10-20
draft: false
---

Between 18 July and 17 October — 92 days — one query earned 18,959 impressions on one of my pages and zero clicks. Average position: 2.75.

The query was 爱驰电动手表介绍 — "Aiways electric watch introduction." Aiways made cars. It went bankrupt making cars. It has never made a watch, never announced one, never even rumoured one. There is no such product. The phrase is a brand token, a product noun and an introduction suffix bolted together and thrown at an index to see what would stick.

It stuck to me, because I happened to be the cheapest page sitting in that part of vector space.

Here is the whole thing in order, because the order is the argument — and because I got the arrow backwards the first time I wrote it up.

My conclusion, up front: this was a rank tracker performing a more human-like kind of SERP fetch, and that fetch was booked as an impression every single time. The signature is narrow enough to name: United States at the top of the country split, multilingual query lists in languages the site doesn't serve, one long-tail non-query generating enormous impression volume, position in the top three, and no clicks to speak of. Every fingerprint in the data points at one vendor's infrastructure. If the shoe fits, SEMrush.

## 18 July – 19 August: nothing at all

Zero impressions on that query. Not low — zero, every single day, for a month. It did not exist yet, in any meaningful sense.

## 10 – 16 August: the last clean week

Site level, before any of this started: **784,361 impressions, 5,153 clicks.** Hold on to those two numbers. They are the control, and everything below stands or falls on them.

## 20 August – early September: the ramp

Two impressions on 20 August. Three on the 23rd. Thirteen on the 24th. Then 268, then 540, then a plateau of around 750 a day for the rest of August.

The list behind that query was being assembled on the same schedule: 11 queries in mid-July, 129 by late August. Week-over-week turnover ran 10–38% during those weeks, because it was still being filled in.

Sometime in the first days of September a colleague pinged me: *come look at the impressions, they're up again.* Week over week: impressions **+26.7%**, clicks **+14.1%**, CTR **−10%**.

That gap is always the tell. Real growth moves clicks and impressions together, or clicks first. When impressions outrun clicks, either you dropped into positions people scroll past, or something is being shown that was never going to be clicked.

By section: one content section — a long-tail encyclopedia of car models, hundreds of thin pages nobody optimizes — carried **70% of the week's impression increase**, at a CTR of **0.18%**.

By page: one encyclopedia page for a model from a Chinese brand that has been effectively dead for years took roughly **150,000 impressions in that week and two clicks.**

By query: hundreds of near-identical Chinese questions. "Does the U5 have anti-theft wheel nuts." "How do I connect my phone to the infotainment." "Teardown analysis of the electronic system." Every one of them zero clicks.

I fetched the page and searched its text for those exact phrases. None of them appear. Not once. The page wasn't targeted by keyword. It was *adjacent* — the retrieval was scattering a fixed set of questions across whatever thin page sat closest in vector space.

![Search Console query history, filtered to one country: near-zero for three months, then a vertical spike beginning in late August](/images/zero-click-flood-u5-query-us.jpg)

Then I checked the sister site. Same days, same section, same signature: it logged 31 brand queries in the window and **30 of them also appear on my site**, in the same weeks, for 36,512 impressions and zero clicks.

Nobody aims a campaign at two neighbouring properties in two markets with one script of gibberish. That ruled out an attack. It didn't yet tell me what it was.

## 13 – 16 September: the peak, and why it peaked

Cluster impressions: 46,251 on the 13th → 77,761 on the 14th → **116,071 on the 15th** → 60,560 on the 16th.

What changed on the 13th is the whole story. Google began refusing rank-tracker requests at scale. The trackers did the only thing they can do: they made their requests look human. Real browsers instead of HTTP clients, full page rendering instead of headers, residential egress instead of datacentre ranges, plausible pacing, retries.

It worked. For about a week their collection succeeded better than it ever had — and every one of those human-looking fetches got booked as an impression in somebody's Search Console.

## 14 September: I published the wrong answer

I wrote the first version of this in the middle of the event, which is the worst vantage point on anything. I argued it was an anonymous pipeline of generated questions fired at the search engine, and that my site was simply in the way of it. Both halves were wrong, and the data below is what corrected them.

I also claimed the query list turned over 98% every week, which proved it was output rather than demand. That was an artifact of measuring on weekly slices. Measured daily across the full window: 143 distinct queries total, not 143,000. 86 of them appear on 37 to 40 of the 42 days of the flood; the median query is present on 38 of 42 days. Turnover at the peak weeks: 0.0%, 0.8%, 1.5%, 1.5%, 1.5%, 0.0%.

That is not a river of generated questions. That is a **fixed list being polled.**

And a fixed list polled daily is the definition of a rank tracker. The evidence I used to rule one out was the strongest evidence for one, and I had it backwards.

## 20 September: Google stopped blocking and started lying

The share of SERPs served to trackers that were poisoned — complete, normal-looking pages with the results swapped out — went from a baseline of 0.17% to 2.0% on 20 September, 11.6% by the 25th, 28.6% at the peak on the 29th, back to about 3% by mid-October.

My cluster on the same days: 17,928 on the 20th. 5,311 on the 29th. 1,185 on the 30th.

The flood didn't stop. It lost its eyes. Once the SERPs the tracker received were no longer the SERPs anyone else saw, my pages stopped being where its questions landed.

One honest caveat: poisoning at 8–15% through early October cannot by itself explain a 99.6% collapse. The list was probably also retired at the end of September. From Search Console I can't separate those two. What I can say is that the collapse starts within days of the poisoning appearing, and across the 59 days where both series exist the correlation is **−0.44** — mean daily impressions of 33,847 before 20 September, 5,092 after.

## 1 – 17 October: shelves, not a cliff

317, 71, 25, 9, 7. A small second shelf of ~160 a day in late September. Then 74. Then 2. Then zero — two impressions on 10 October, two on the 14th, nothing either side.

Whatever was asking had moved on, run out of budget, or lost interest. It did not come back.

## 5 – 11 October: the site was fine the whole time

First full week after: **888,917 impressions, 7,831 clicks.** Against the clean week: impressions **+13.3%**, clicks **+52.0%**.

Clicks grew nearly four times faster than impressions — precisely the relationship the flood had broken, and precisely the one real growth produces. Nothing was stolen. When the machine left it took only itself.

## The whole event, measured once

Over 18 July – 17 October: **143 queries, 1,192,604 impressions, 4 clicks.** 110 of those queries individually cleared a thousand impressions with zero clicks and carried 1.16 million of them. At its peak week the cluster was 18.7% of the whole site's impressions — nearly one in five — while the single query I had been staring at was 1.6% of the cluster. Two pages absorbed all of that one query's volume: a model page at roughly 15,950 impressions and the brand hub at about 3,000.

Geography: 65.9% United States, 21.4% United Kingdom, 4.8% Netherlands, 3.5% Germany, 2.0% Italy — 89 countries in total. Malaysia, the market this site exists to serve and 42.6% of its normal impressions, contributed essentially nothing.

Device: **1.19 million desktop impressions against 77 from mobile.** Not skewed. Inverted.

## What the fingerprints add up to

Every fingerprint points the same way:

- **A fixed list, polled daily.** 143 terms, held stable for a month, refreshed every day, then abandoned. Turnover near zero at the peak. That is a monitored keyword set, not demand.
- **Multilingual, in the wrong languages.** Chinese brand-diligence questions — "the impact of the company's domestic troubles on its NASDAQ listing," "ownership structure," "reorganization in 2025" — landing on a Malaysian English-language car site. Nobody's audience does that. A vendor's brand-tracking keyword list does that, because the product is coverage in every market the vendor sells into.
- **US-weighted, 89 countries, desktop-only.** 65.9% United States; 1.19 million desktop impressions against 77 mobile. The profile of a server rack, not a reader.
- **Position 2.7, zero clicks.** A tracker opens the SERP and reads it. A rendered result and a rank are the deliverable; a click is not required, and a click would in fact be a mistake.
- **A non-query that a machine wrote.** "Aiways electric watch introduction." No such watch ever existed. That is a keyword-generation template probing a brand, not a person looking for something.
- **Two sites in the same neighbourhood sharing 30 of 31 queries.** One list, polled against whatever it happened to hit in two adjacent markets.
- **It collapses as Google starts poisoning tracker SERPs.** Cause and effect pointing the right way, for once.

I can't open anyone's logs, so this is signature-matching from the outside. But on every axis I can measure, the infrastructure that fits is SEMrush: it sells brand and rank tracking across many markets, it has every commercial reason to iterate on looking human enough to keep collecting, and when Google began serving it poisoned SERPs, my traffic disappeared with it.

If there's a better candidate, this is the place to argue it. But I'd start with the vendor whose entire business is asking search engines questions nobody asked.

And here's the part that makes it a new species rather than noise. To Search Console, a request that renders a page at position 2.7 and never clicks is indistinguishable from a person who looked and left. GSC has no column for "this was a measurement, not an audience." So it books an impression, every time, forever.

The tracker gets its rank data. Your report gets a phantom.

The estimators are blind to it too. A third-party index confirms the page at rank 1 for that query — GSC says 2.7, so the ranking was real, not a counting artifact. The same tool estimates 2,400 monthly searches and 196 monthly visits. Reality: about 6,300 impressions a month, zero clicks. It multiplied volume by a normal rank-1 CTR, because a query that ranks first and is never clicked cannot exist in its model.

## What this means for your reports

Not "someone attacked me." Not anonymous AI scrapers either. A measurement vendor taught its fetcher to look enough like a person to be counted as one — and it's being counted on your pages.

Which means your impression number is no longer only about you. It's partly a log of what other people's robots did near you — and it's up to a fifth of some sites' totals at peak.

What I do now:

- Report on clicks. Impressions are weather.
- Segment the thin, low-competition sections out of trendlines so they can't distort them.
- Alert on the impossible pair: **top-ten position, over a thousand impressions, CTR under 0.1%.** Nothing legitimate produces that.
- Stop reading a jump in impressions as good news before checking who's in the room.
