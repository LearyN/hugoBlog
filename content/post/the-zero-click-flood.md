---
title: "The Zero-Click Flood: When Your Search Console Becomes Someone Else's Database"
tags: ["SEO", "GSC", "bots", "AI", "crawlers"]
date: 2026-09-14
lastmod: 2026-10-20
draft: false
---

A colleague pinged me the other day: *come look at the impressions, they're up again.*

Nine times out of ten, that's good news. This was the tenth.

I've spent enough time staring at search data to have a reflex now. When impressions jump, my first question isn't "what did we do right." It's "what did someone do *to* us." So I opened the reports, and within an hour the good news had curdled into one of the stranger things I've seen in my career.

Here's the investigation, cleaned of names and numbers that would identify the sites. The pattern is the point.

## The good news lasts about thirty seconds

Week over week, impressions were up 26.7%. Clicks were up 14.1%. And CTR — the ratio between them — was *down* 10%.

That's the first tell, and it's almost always the same tell: the numerator and the denominator are running different races. Real growth makes clicks and impressions climb together, or clicks jump first, because a thing that earns impressions and never earns clicks isn't reaching people. It's just being *shown*.

When impressions outrun clicks, either your rankings moved into positions people scroll past, or someone is generating impressions that were never going to convert. The second one leaves a fingerprint. So I went looking.

## One section was doing all the work

I broke the site down the way we always do — by template, by path, by section. Almost every section looked normal. One did not.

A single content section contributed **70% of the entire week's impression increase**. One section. And its CTR was 0.18% — roughly a fifth of the site average, in a section that otherwise gets clicked on the same as everything else.

That section was a long-tail encyclopedia of car models. Hundreds of thin, low-competition pages describing individual vehicles. The kind of content nobody optimizes because it's never been worth optimizing.

It was worth something to somebody.

## One page, 150,000 impressions, two clicks

Down another level. I pulled page-level data and sorted by impression growth.

One encyclopedia page — a single model from a Chinese car brand that has been effectively dead for years — was carrying roughly **150,000 impressions a week**. It was being clicked **twice**.

Two clicks. Out of a hundred and fifty thousand times it appeared in front of someone.

I went to the query level, and that's where the shape of the thing finally appeared. Driving that one page were **hundreds of near-identical Chinese questions** — the kind you'd type if you were trying to learn everything about a car that no longer exists. "Does the U5 have anti-theft wheel nuts." "How do I connect my phone to the infotainment." "Teardown analysis of the electronic system." "Does it have an electric watch."

Every single one of them: zero clicks. Every single week: a fresh batch.

Here's one of them, pulled from the engine's own report and filtered to a single country. Flat near zero for three months — then a wall.

![Search Console query history, filtered to one country: near-zero for three months, then a vertical spike beginning in late August](/images/zero-click-flood-u5-query-us.jpg)

*A single generated question — "how do I connect my phone to the infotainment" for a discontinued model — earning over ten thousand impressions in one country, almost all of them in a two-week window, and almost none of them clicked.*

## The fingerprints

By this point I had three data points that didn't belong together, and each one ruled something out.

**First: the queries didn't describe the page.** I fetched the actual page and searched its text for the exact phrases in its top-driving queries — anti-theft wheel nuts, teardown analysis, electric watch. *None of those words appear on the page.* Not once. So this wasn't keyword matching, and it wasn't a scraper following my links. It was semantic bleed: the search engine's retrieval scattering a flood of Chinese car questions across whichever thin page happens to sit closest in vector space. The page wasn't targeted. It was *adjacent*.

**Second: 98% of the queries were brand new.** Real long-tail search is stable. You'll see the same few hundred informational queries week after week, drifting slowly. A query corpus that turns over almost entirely in seven days isn't demand. It's *output*. Something is generating these questions, and generating new ones constantly.

> *Editor's note, 20 October 2026: this paragraph is wrong, and it is the reason the rest of this post reached the wrong conclusion. See the correction at the end.*

**Third: the questions weren't consumer questions.** Look closely and they stop reading like a shopper. They read like diligence. "The impact of the company's domestic troubles on its NASDAQ listing." "Ownership structure." "Reorganization in 2025." "Relationship with its major investor." Nobody asks that about a car they're thinking of buying. Somebody asks that to price a credit, or to populate a database, or to train a model.

And then I checked the sister site.

## The same flood, the same fingerprints

There's a second regional property under the same operation, and it had been lit up the exact same way over the exact same days. Same section — the thin encyclopedia. Same signature, almost to the decimal:

- Around **40% of impressions from a single country** — a country that sends essentially **zero clicks**. Its CTR was 0.038%. That's not low. That's *absent*.
- Three-quarters of impressions from desktop, when the real audience is overwhelmingly mobile.
- The same template of Chinese questions, week-fresh, zero-click.
- And here's the one that ended the argument: **the two sites shared a meaningful slice of the exact same queries.**

That last fact kills the most natural theory. Nobody runs a *targeted* campaign against two sister properties using one script of gibberish. A targeted attack is about you — your keywords, your pages, your rankings. This wasn't about anyone. Both sites were simply *in the way*.

## What's actually going on

Once I had the full picture, I ran through the possibilities the way you'd run a diagnostic.

**A targeted negative-SEO hit?** No. The queries were nonsense. Real negative SEO sculpts queries to look human, because the whole game is to poison your click signals. These were machine-generated garbage — "summer glass water composition," "Sharp's product areas" — questions built by gluing a keyword token onto a template. And it hit two properties at once. You don't attack like that.

**A rank tracker or SEO tool?** Closer, but no. Trackers poll the *same* keyword set every day. Trying to catch you ranking is the entire point. This corpus was 98% new every week. Nothing was being tracked.

> *Editor's note, 20 October 2026: this is the paragraph I would most like to take back. The premise is false and the conclusion is the exact opposite of the truth.*

**A search-engine bug, or a reporting change?** This one deserves respect, because it's always possible — and the timing was suspicious, right after a widely-discussed change to how one engine counts a whole category of impressions. But a reporting quirk doesn't produce *Chinese due-diligence questions about a bankrupt automaker*. Bugs don't have subject matter. This had subject matter.

Which leaves the answer that actually fits every observation: **someone is running a high-volume pipeline of generated questions at the search engine itself** — and my sites, with their thin, low-competition, easily-recalled encyclopedia pages, are simply where a fraction of those queries happen to land.

## Why this is a new species

Here's the part I keep coming back to, because it breaks every instinct I have.

This is **not click fraud.** There's no click. There's nothing to click. It's not scraping, either — it never touches your server. Your access logs are clean. Your analytics are clean. Your CDN is clean. Your bot mitigation saw nothing, because from its perspective nothing happened.

The only system that observed it is the search engine. And the only trace it left is an **impression count**.

The entire discipline of detecting bad traffic, built over twenty years, rests on *behavior*. Rotating IPs, headless browsers, impossible session geometry, traffic at 3am from cities that shouldn't care about you. This traffic has no suspicious behavior. Its behavior is *asking questions*. It looks exactly like a user right up until you notice the user never clicks, never returns, and never was a user.

And the metrics we built our reporting on — impressions, CTR, average position — are no longer only about us. They've quietly become a **shared surface**, one that records what everyone else did to the internet near you. Your impression count is now partly a measure of how many strangers' robots happened to glance at you.

## The thing that should worry you more than the noise

If someone is mass-probing a search engine with generated questions, the output is a map. A map of what the engine returns, for whatever they're asking about, at whatever scale they can afford.

That map is a product. It's training data, or a brand-visibility dashboard for companies trying to understand how AI answers questions about them, or a diligence feed that tracks an entire industry's collapse in near real time. All of them are legitimate businesses now. All of them need exactly this: millions of questions, thrown at the index, every day, and nobody cares in the slightest which websites get caught in the spray.

The economics are the tell. Running millions of queries a day through residential IPs costs real money. Nobody spends that to prank a mid-sized content site. Whatever wrote those Chinese questions is *selling the answers*, and my impression count is an exhaust fume.

So I don't think we were attacked. I think we were **passed through.**

## What I do now

The tactical fixes are simple and I'll take them: report on clicks, not impressions; segment out the polluted section so it stops distorting the trendline; set an alert for the moment a query shows thousands of impressions and zero clicks.

But the lesson is bigger than the fixes.

For years we've treated search data as a mirror — a way to see ourselves more clearly. It isn't. It's a busy intersection, and increasingly it records not what our audience did, but what other people's automation did *near us*. Impressions were the one number we thought we could trust, because you can't fake being shown.

Turns out you can. You just have to ask the right question, a few hundred thousand times, and let someone else's page be the answer.

The web spent a decade learning that content could be faked. Then that traffic could be faked. Now the data about us is being faked too — not by lying about what we did, but by drowning the record in things nobody did at all.

I used to open Search Console to see how we were doing.

Lately I open it to see who's been in the room.

They left the door open. They always do.

---

## Update — 20 October 2026

I published the piece above in the middle of the event, which is the worst vantage point you can have on anything. Five weeks later the data has finished arriving, and three things have changed: the query died, I got a full measurement of the whole cluster instead of one page, and a third party independently confirmed that the rankings were real.

### The full life of one query

I built the original post around a single generated question. Now I have its complete record — 18 July to 17 October, 92 days.

**18,959 impressions. Zero clicks. Average position 2.75.**

The shape is the interesting part, because it isn't a wall. It's a life cycle.

For the first month it was flat zero — not low, *zero*, every single day, from mid-July until 20 August, when two impressions appeared. Three more on the 23rd. Thirteen on the 24th. Then 268, then 540, then a plateau of around 750 a day that held through the end of August.

A second burst hit in mid-September and it was much taller: 1,600 impressions on the 14th, 3,059 on the 15th, 1,236 on the 16th.

And then it decayed. Not a cliff — a series of shelves. 317, 71, 25, 9, 7. Then a small second shelf of ~160 a day in late September, then 74, then 2, then nothing: two impressions on 10 October, two on the 14th, zero either side of them.

By 1 October the query was finished. Whatever was generating it had moved on, run out of budget, or lost interest. It did not come back.

![Search Console, three months, a single generated query: flat zero for a month, a scalloped rise to ~750 a day, a spike to 3,059, then decay through a series of shelves to nothing](/images/zero-click-flood-query-timeline.jpg)

*The whole life of one generated question, filtered to a single query across three months. Position sits between 2 and 5 the entire time. Clicks sit at zero the entire time.*

### The rank was real, and I can now prove it

My fourth hypothesis — that this might be a reporting change or an engine bug — was the one I treated with respect and then dismissed on a hunch. *Bugs don't have subject matter,* I wrote. That's rhetoric. It's not proof, and I knew it when I wrote it.

Here is proof.

A third-party rank tracker crawls the search results itself. It has no relationship with Search Console, no access to its counters, no way to inherit its mistakes. It reports this page at **rank 1** for this query.

Search Console, entirely separately, reports an average position of **2.7**.

Two systems that share nothing agree on where the page sits. So the ranking is not a bookkeeping artifact: the engine is genuinely returning that page, at the very top of the results, for a question about an electric watch from a car company that has never made a watch. The impressions are a record of real SERP states.

![SEMrush: one generated query at rank 1, 2.4K volume, KD 19, and a ranking history that begins abruptly in August 2026 and stops at the end of September](/images/zero-click-flood-semrush-rank.jpg)

*A third-party index, unprompted and unconnected to Search Console, puts the same page in the same place. The ranking history begins in August — it had never ranked for this phrase before, because this phrase did not exist before. Domain redacted.*

One detail in that panel is worth a second look, because the same tool that confirms the ranking is confidently wrong about everything else.

It estimates monthly search volume at **2,400**. Search Console recorded 18,959 impressions in three months — call it 6,300 a month, roughly two and a half times the estimate.

And it estimates **196 monthly visits from this keyword**. The actual figure across three months is zero.

That last number isn't a measurement. It's arithmetic: volume, multiplied by the click-through rate a rank-1 result normally earns. The tool has no way to model a query that ranks first and is never clicked, because that query cannot exist under any assumption its model is built on. So it multiplies out a plausible number and reports it as traffic.

Which means the estimator isn't merely noisy here — it is *structurally* blind. Every SEO tool in existence would report this keyword as a small win. Only the counter of impressions saw what it actually was.

But now look at the pair itself, because it should be impossible. **Position 2.7. Zero clicks. Nineteen thousand impressions.** A top-three ranking is the most clickable real estate on the internet. There is no honest query, no honest page, and no honest audience for which position 3 converts at exactly zero. Those two numbers cannot both be about a human being. Something is asking, at scale, from a browser that resolves pages and returns nothing.

That contradiction is now my favourite fingerprint. Not the volume — anyone can produce volume. The *pair*.

### It wasn't one page, or one query

I originally widened the investigation one page at a time, which was slow and made the event look smaller than it was. Widening to every query containing the brand name at once, across the full three months (18 July – 17 October):

- **143 queries. 1,192,604 impressions. 4 clicks.**
- **110** of those queries individually cleared a thousand impressions with zero clicks, and between them carried 1.16 million of those impressions.
- At its peak week the cluster was **18.7% of the entire site's impressions** — nearly one in five. The single query I wrote about was about 1.6% of it.
- Two pages absorbed all of it. One model page took roughly 15,950 impressions for that one query; the brand hub took about 3,000.
- **Geography:** 65.9% United States, 21.4% United Kingdom, 4.8% Netherlands, 3.5% Germany. Malaysia — the market the site actually serves, and 42.6% of its normal impressions — contributed essentially nothing.
- **Device:** roughly 1.19 million desktop impressions against **77** from mobile. The real audience here is overwhelmingly mobile, and the ratio isn't skewed here, it's inverted.
- **The sister site:** 30 of the 31 brand queries it logged in the same window also appear on this site — 36,512 impressions and zero clicks.

Thirty of thirty-one. Not a campaign aimed at anyone. A net cast wide enough that two neighbouring properties in the same square of vector space both got caught in it.

### And the site was fine the whole time

Which is the part I most needed and least expected.

The last clean week before the flood — 10 to 16 August: **784,361 impressions, 5,153 clicks.**

The first full week after it — 5 to 11 October: **888,917 impressions, 7,831 clicks.**

Impressions up 13.3%. Clicks up 52.0%.

Clicks grew nearly four times faster than impressions. That is precisely the relationship that was broken during the flood, and precisely the relationship that real growth produces. Nothing was stolen, nothing that mattered was inflated, and when the machine left it took only itself with it.

For six weeks, though, I was reading a trendline that was up to a fifth pollution, and drawing conclusions from it. That is the actual cost of this — not the impressions, the *reading*. I made real decisions about a real section of the site using a number that was, for a while, mostly about somebody else.

### One more thing worth writing down

The phrase has no referent. I checked. There is no electric watch. It was never manufactured, never announced, never even rumoured — the company in question went bankrupt making cars. The phrase was *assembled*: a brand token, a product noun, and an introduction suffix, bolted together from a template and thrown at the index to see what would stick.

It stuck to us, because we happened to be the cheapest thing sitting in that part of the map.

One point two million impressions. Four clicks. Whatever this was for, it was not for us, and we were never the point.

So the alert I set in September has been rewritten. It no longer watches impression volume — volume is too noisy to alert on. It watches the impossible pair: **a top-ten position, more than a thousand impressions, and a click-through rate under 0.1%.** Nothing legitimate produces that. Everything else is weather.

---

## Second update, same day — I had the mechanism upside down

Everything above assumes the flood was aimed at the web, and my site was in the way. I now think that's wrong in an instructive way. The flood was aimed at Google. My site was in the way of *that*.

The trigger was a conversation about the poisoned-SERP story: Google has spent the autumn degrading the results it serves to rank trackers, and the trackers have spent the autumn trying to look human enough to get through. If that trade is happening at scale, somebody's Search Console had to absorb the byproduct. This one did.

So I re-measured, properly this time, on the axis I should have used from the start: day by day, per query, across the full 92 days.

### The fingerprint I asserted does not survive measurement

I wrote that 98% of the queries were brand new every week, and that this proved the corpus was *output* rather than demand.

So I measured the same cluster daily instead of weekly.

There are **143 distinct queries in 92 days.** Not 143,000. Not 143 a week — 143, total, for the entire life of the event.

**86 of them appear on 37 to 40 of the 42 days** in the flood window. The median query was present on 38 of those 42 days, at a median of 285 impressions a day.

Week-over-week turnover, measured on the peak weeks: **0.0%, 0.8%, 1.5%, 1.5%, 1.5%, 0.0%.**

That is not a fresh corpus. That is a **fixed list being polled**. A list of 143 terms, refreshed daily, for a month, then abandoned.

Which is what a rank tracker does. It is not what a campaign of generated questions looks like — that would leave a different set of terms every week, and I said so myself. The evidence I used to rule out rank trackers is the strongest evidence *for* them, and I had it backwards.

One honest caveat on that number: the set was *growing* through August, from 11 queries in mid-July to 129 by late August, and turnover in those weeks was 10 to 38%. So the corpus was assembled, not switched on. But once assembled, at the peak, it held. A list being filled in, then polled. Not a river of fresh output.

### The two phases, and why the arrow points the other way

Nozzle publishes daily data on how many of the SERPs Google serves to trackers are poisoned — complete, normal-looking pages whose results have been swapped out. Baseline, 20 August to 9 September: **0.17%**. Then it climbs: 2.0% on 20 September, 11.6% by the 25th, **28.6% at the peak on 29 September**, easing to about 3% by mid-October.

Lay that against my cluster day by day, and something inverts.

**13 September** — requests to Google from trackers start failing at scale. My cluster: 46,251 impressions.
**14 September** — 77,761.
**15 September** — **116,071. The peak.**
**16 September** — 60,560, already falling.
**20 September** — poisoning appears for the first time. My cluster: 17,928.
**29 September** — poisoning at its worst, 28.6%. My cluster: 5,311.
**30 September** — 1,185.
**14 October** — 18.

My flood **peaked five days before the poisoning began**, and died as the poisoning spread. Across the 59 days where both series exist, the correlation between Google's poison rate and my impression count is **−0.44**. Mean daily cluster impressions before 20 September: 33,847. After: 5,092.

So the sequence is the reverse of what I assumed. Not: a flood of junk queries, which I then noticed. But: **Google starts blocking the trackers on 13 September. The trackers fight back by behaving more like humans — more retries, more proxies, more careful full-page fetches — and for one week their collection succeeds better than ever, and it lands on my pages. Then, from 20 September, Google stops blocking them and starts lying to them instead. The SERPs they collect are no longer the SERPs anyone else sees. My pages stop being where their queries land. The flood doesn't stop because the flood ended. It stops because the trackers were successfully blinded.**

I want to be straight about how strong that claim is, because the timing is compelling and the arithmetic is not quite as clean.

Poisoning ran at 8 to 15% of collected SERPs through the first half of October. If a tenth of this collector's polls came back without my page on them, I should have lost a tenth of my impressions, not 99.6% of them. So the collapse needs more than poisoning alone. Either this dataset rode the worst of the collection routes — Nozzle measured one route at 13 to 32% against another at 1 to 8% — or the keyword list was retired at the end of September and the poisoning merely finished it off, or both. From Search Console I cannot separate those. What I can say is that the collapse begins within days of the poisoning appearing, and the correlation across the whole window is negative.

### What the geography says, read correctly this time

The country split never made sense as an audience. It makes immediate sense as a collector.

My cluster: **65.9% United States, 21.4% United Kingdom, 4.8% Netherlands, 3.5% Germany, 2.0% Italy.** Malaysia — the market this site exists to serve, and 42.6% of its normal impressions — effectively zero.

I originally read that as proof the traffic wasn't real. It is. But a commercial collector doesn't poll one country: it polls wherever its customers sell, because that's the product. Eighty-nine countries appear in the cluster. And **1.19 million of its impressions are desktop against 77 from mobile** — which is not how a Southeast Asian car audience behaves, and exactly how a server rack behaves.

Then the sister site. Of the 31 brand queries it logged, **30 also appear here**, in the same weeks, with the same shape, 36,512 impressions and zero clicks. Not two sites being attacked. One list being polled against whatever it happened to hit in two neighbouring markets.

### The part that survives

Not all of the original holds up, so let me separate what does.

The queries really were assembled rather than asked. "爱驰电动手表介绍" — *Aiways electric watch introduction* — has no referent. There is no such watch. The company went bankrupt making cars. The phrase is a brand token, a product noun and an introduction suffix bolted together, which is what a keyword list looks like when it is generated to probe a brand rather than to find something.

And that is the sharpest thing in all of this: **a tool built to measure how a brand appears is generating keywords that describe a product which does not exist, and the answer it gets back is a page about a car.** The measurement apparatus is asking the internet nonsense on purpose, at industrial scale, and then selling what comes back.

The impression counts were real. That was always true and is still true. They were records of real SERP states — I proved that much with the rank tracker, and I'd like that argument back, because it now points at the tool rather than at a mystery.

And the conclusion I reached in September — that this wasn't an attack on me, that I was *passed through* — holds, with a correction to who was passing. Not anonymous AI scrapers harvesting training data. **Google and the tracking industry, in open conflict, with my pages as the surface where the conflict registered.**
