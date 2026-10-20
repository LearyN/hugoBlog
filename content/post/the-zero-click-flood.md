---
title: "The Zero-Click Flood: How to Tell If a Rank Tracker Is Polluting Your Search Console"
tags: ["SEO", "GSC", "bots", "AI", "crawlers"]
date: 2026-10-20
lastmod: 2026-10-20
draft: false
---

Something happened to a lot of Search Console reports this autumn, and it had nothing to do with anything those sites did. It was a side effect of a fight between Google and the tools that scrape its search results. A rank tracker changed how it fetched search pages, and every one of those fetches got counted as an impression on somebody's site.

This post is short. It describes what happened, in order, and then shows you how to check whether it happened to you.

## First, why a rank tracker shows up in your impressions at all

Rank trackers — SEMrush, Ahrefs, and their peers — don't get your rankings from Google. Google doesn't hand them out. So a tracker has to fetch the search results page itself, over and over, and read where your page sits.

From your site's point of view, one of those fetches looks a lot like a real visit: a browser opened a results page, and your page was on it. Search Console counts that as an impression. The tracker never clicks — a click isn't what it came for. It came for the rank.

Normally this is invisible. A handful of polls a day, buried in the noise. This autumn it stopped being invisible.

## What happened, in order

- For years, trackers fetched search results with simple, cheap HTTP requests. Fast and easy, but also easy for Google to spot and serve junk to.

- Around mid-September, Google began refusing those requests at scale. The trackers did the only thing they could: they made their fetches look human. Real browsers instead of bare HTTP clients, full page rendering instead of headers, residential IPs instead of datacenter ranges, human-like pacing and retries.

- It worked. For about a week the trackers collected better than they ever had — and every one of those human-looking fetches was booked as an impression in someone's Search Console. Not a click. An impression.

- Then Google stopped blocking and started lying. Instead of refusing the trackers, it served them complete, normal-looking result pages with the results swapped out. Over late September the share of tracker-facing pages that were poisoned climbed from a fraction of a percent toward a third, then settled back.

- Once the trackers were being fed fake results, the pages they had been inflating stopped appearing where the tracker's queries landed. The flood died — not because it ended, but because the tracker had been blinded.

Net effect for the sites in the middle: several weeks of inflated impressions, from a machine that was never their audience.

## Check your own GSC: find the queries that impressed and never got clicked

You can run this in about ten minutes. Four steps.

**1. Sort your queries by impressions and look for the impossible pair.**
Search Console → Performance → Search results. Set the date range to the suspicious window. Sort queries by impressions, descending. Look for queries with a real volume of impressions — hundreds, thousands — and a click count of 0, or near 0.

Real queries ranking well get clicked. A query with a top position and no clicks is not an audience. That pair is the thing you're hunting.

**2. Open those queries and read two columns: position and country.**
Two tells follow you around:
- **Position:** top 3, and often position 1, with zero clicks. Top-three real estate is the most clickable space on the results page. Nothing honest converts at exactly zero.
- **Country:** a country sitting at the top of the split that sends you essentially no clicks. In this event that country was the United States — on sites that serve entirely different markets.

**3. Check whether the query even matches your page.**
Take a few of the suspicious queries. Open the page Search Console says they landed on. Search that page's text for the exact words. If they appear nowhere — not once — the page wasn't targeted at that query. It was just the nearest page in the index to a question a machine wrote. That is a strong sign you are looking at a tracking query, not demand.

**4. Look the query up in SEMrush — against your own project.**
This is the cross-check that confirms it.

In SEMrush, open the organic rankings for your own project or domain, and look up those suspicious queries.

If those same odd, non-human long-tail phrases appear in SEMrush's report on your own site — and if they start showing up right around the time your Search Console impressions spiked — then the tool is polling those phrases against your domain. That is the point. SEMrush is tracking that keyword, and that tracking is exactly why the fetch that produced your "impression" happened.

One warning while you're in there: ignore SEMrush's traffic estimate for those keywords. That number is modeled, not measured — the tool multiplies estimated volume by the click-through rate a result normally earns. A query that ranks first and is never clicked cannot exist in that model, so the estimate will confidently report traffic that never happened. Don't read the volume or the estimated visits. Read the keyword list and the dates.

## The whole signature, in one place

If you see all of the following, you are not looking at an attack, and you are not looking at AI scrapers harvesting content. You are looking at a measurement vendor that taught its fetcher to look human enough to be counted as one — and it is being counted on your pages.

- United States at the top of the country split.
- Multilingual queries, in languages your site does not serve.
- One long, non-human long-tail query throwing off an enormous impression volume.
- Position in the top three, with little or no clicks.
- The same query showing up in your own SEMrush project around the same dates.

## What to do about it

- **Report on clicks.** Impressions are weather.
- **Segment the thin, low-competition sections** out of your trendlines so pollution can't distort them.
- **Alert on the impossible pair:** top-ten position, over a thousand impressions, and a CTR under 0.1%. Nothing legitimate produces that.
- **When impressions jump, ask who's in the room** before you call it good news.

Your impression count is no longer only about you. Part of it is a log of what other people's robots did near you. Knowing that is the difference between reading your report and reading a stranger's.
