---
title: "The Zero-Click Flood: When Your Search Console Becomes Someone Else's Database"
tags: ["SEO", "GSC", "bots", "AI", "crawlers"]
date: 2026-09-14
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

## The fingerprints

By this point I had three data points that didn't belong together, and each one ruled something out.

**First: the queries didn't describe the page.** I fetched the actual page and searched its text for the exact phrases in its top-driving queries — anti-theft wheel nuts, teardown analysis, electric watch. *None of those words appear on the page.* Not once. So this wasn't keyword matching, and it wasn't a scraper following my links. It was semantic bleed: the search engine's retrieval scattering a flood of Chinese car questions across whichever thin page happens to sit closest in vector space. The page wasn't targeted. It was *adjacent*.

**Second: 98% of the queries were brand new.** Real long-tail search is stable. You'll see the same few hundred informational queries week after week, drifting slowly. A query corpus that turns over almost entirely in seven days isn't demand. It's *output*. Something is generating these questions, and generating new ones constantly.

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
