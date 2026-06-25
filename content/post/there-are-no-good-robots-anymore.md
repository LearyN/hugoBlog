---
title: "When the Crawlers Stop Playing Nice: Surviving Aggressive Bot Traffic in 2025"
date: 2026-04-11
draft: false
tags:
  - bots
  - SEO
  - Cloudflare
  - crawling
author: "Leary Liang"
keywords:
  - bot traffic
  - ASN
  - Cloudflare
  - crawling
  - SEO
---

### Background

I work on SEO and SEM for a large-scale content platform. In August 2025, a newly launched section of our site began experiencing something unusual-massive, abnormal crawling traffic.

This wasn't a small system. The section exposed **over 6 billion accessible URLs**, designed to scale far beyond typical workloads. But within two months, traffic surged past expected limits. By November, the system began to **crash frequently under extreme load**, and it became clear: something was very wrong.

---

### Phase 1: The First Signs of Collapse

At first, the issue looked like typical bot pressure-nothing unusual for a large site. But three patterns quickly emerged:

1. **Explosive traffic spikes within short time windows**
2. **Extremely distributed IP sources**, making IP-based blocking ineffective
3. **No backoff behavior**-bots continued crawling aggressively even when the server was under stress

This last point was especially alarming. Traditional search engine crawlers typically reduce activity when encountering errors or latency. These did not.

---

### Phase 2: Containment via ASN-Level Mitigation

By late December 2025, we implemented a decisive mitigation strategy using Cloudflare.

Instead of chasing individual IPs, we:

- Identified **Autonomous System Numbers (ASNs)** associated with abnormal behavior
- Applied **JavaScript challenges at the ASN level**
- Continuously expanded a manually curated ASN blocklist

This approach worked immediately.

By the end of Q1 2026:

- We had identified **30+ malicious or suspicious ASNs**
- These ASNs triggered **millions of JS challenges per day**
- **Pass rates were below 1%**, indicating overwhelmingly non-human traffic

The system stabilized.

---

### Phase 3: Understanding the Adversary

As the situation evolved, broader industry signals began to align with what we were observing.

Reports of a **global surge in automated traffic** started appearing, alongside discussions about AI-driven scraping.

- Cloudflare reported that automated traffic now accounts for a significant portion of internet requests
  https://radar.cloudflare.com/traffic/overview

At the same time, copyright enforcement activity was exploding:

- Google has been receiving **astronomical volumes of DMCA takedown requests**
  https://transparencyreport.google.com/copyright/overview

These signals led to two plausible hypotheses:

#### 1. LLM Data Collection Layers
Bots aggressively crawling the web to gather training data for large language models.

#### 2. Copyright Enforcement Crawlers
Industrial-scale scraping operations designed to detect potential copyright violations.

Both share a key trait:

> They have **no incentive to respect your infrastructure limits**.

The internet, for them, is simply raw material.

---

### Phase 4: The AS45899 Incident

Then came the most unsettling discovery.

One ASN-**AS45899**-stood out.

- It had previously been flagged for aggressive crawling
- It was placed under Cloudflare ASN-level JS challenge
- When restrictions were temporarily relaxed, **its request rate increased almost immediately**

This behavior was... different.

Most malicious crawlers are blunt instruments. This one appeared **adaptive**.

#### About AS45899
AS45899 is operated by VNPT Corp, a major Vietnamese telecommunications provider. It has been associated with various crawling activities, including regional search engines.

---

### Phase 5: A Disturbing Correlation

Further analysis revealed something unexpected.

Traffic from AS45899 showed **near-perfect behavioral overlap** with requests identified as coming from GoogleOther.

#### About GoogleOther
According to Google, *GoogleOther* is a crawler used for "internal purposes."
Unlike Googlebot, its exact role is not clearly documented.

But its behavior is notably different.

---

### The Overlap

Across multiple dimensions, the similarity was striking:

- Crawling paths
- Request frequency
- Growth and decline patterns
- Temporal synchronization

The only consistent difference:

- **GoogleOther uses HTTP/2**
- **AS45899 traffic uses HTTP/1.1**

Everything else aligned almost perfectly.

It raised an uncomfortable possibility:

> Were they part of the same system?

---

### Phase 6: When "Polite Crawlers" Change

Traditionally, search engine crawlers have followed implicit rules:

- Respect server load
- Back off when encountering errors
- Identify themselves honestly

Even imperfect ones-like Bingbot or crawlers derived from it-generally behave within acceptable bounds.

But what happens if that changes?

What if:

- Major players decide they **cannot afford to fall behind** in the data race
- Aggressive crawling becomes **strategically necessary**
- Politeness becomes optional

And worse:

- Identity becomes fluid
- Infrastructure becomes disposable
- Crawling becomes indistinguishable from attack traffic

---

### The New Reality: A Bot Arms Race

We are entering a phase where:

- Bots **rotate IPs across cloud providers**
- They **spoof user agents**
- They **adapt to defenses in real time**
- They operate like **guerrilla systems**-hit, rotate, disappear

This is no longer traditional crawling.

It is a **resource extraction war**.

---

### What We Learned

#### 1. IP-Based Defense Is Obsolete
Distributed infrastructure makes IP blocking ineffective.

#### 2. ASN-Level Control Is Essential
ASNs provide a more stable unit of control.

#### 3. Behavior > Identity
User agents can lie. Patterns don't.

#### 4. Expect Adaptation
Some actors are no longer static-they respond to your defenses.

---

### The Unanswered Question

How do we coexist with systems that:

- Don't identify themselves honestly
- Don't respect load constraints
- And don't stop

There is no clean answer.

Only trade-offs.

---

### Closing Thoughts

The internet used to operate on a fragile but real social contract.

Crawlers were expected to behave.

That contract is breaking.

And what replaces it may not be better.

---

If you operate a large-scale site, especially one with massive URL surfaces, assume this:

> You are already part of this conflict.

The only question is whether you've noticed yet.


---

### Traffic Cluster Analysis: AS7922 / 7018 / 62610 / 45899

Further analysis reveals a notable traffic cluster formed by four ASNs — **AS7922 (Comcast)**, **AS7018 (AT&T)**, **AS62610 (Zenlayer)**, and **AS45899 (VNPT)** — whose behavioral signatures align closely:

- **Synchronized growth and decline patterns** across all four ASNs over time
- **High concurrency characteristics** consistent with coordinated or script-level parallel crawling
- **Observable bandwidth contention** with Googlebot (AS15169), the site's largest legitimate crawler source, suggesting these clusters actively compete for the same scraping bandwidth

The chart below shows the last 7 days of HTTP request volume on fliphtml5.com, broken down by top ASNs:

![ASN traffic cluster: 7-day HTTP request volume by source ASN](/images/asn-traffic-cluster-7d.jpg)

This pattern suggests a non-trivial degree of behavioral coordination — whether intentional or emergent from shared infrastructure — and represents an ongoing operational challenge for capacity planning and crawler prioritization.

Below is a curated subset of ASNs that exhibited abnormal or aggressive crawling behavior in our environment.

| ASN | Owner | Use For | Country | Website |
|-----|------|--------|--------|--------|
| 18978 | Enzu Inc | Hosting / VPS | United States | enzu.com |
| 20473 | The Constant Company, LLC (Vultr) | Hosting / Cloud | Global | constant.com |
| 21859 | Zenlayer Inc | Hosting / Edge / Cloud | Global | zenlayer.com |
| 9808 | China Mobile | ISP / Mobile | China | 10086.cn |
| 55201 | SkyQuantum Internet Service | Hosting | United States | adsl.cat |
| 48095 | XT Global Networks Ltd | Hosting | Romania | xtglobal.vg |
| 137409 | GSL Networks Pty Ltd | Hosting / Security Network | Australia | globalsecurelayer.com |
| 45102 | Alibaba (US) Technology Co., Ltd | Cloud / Hosting | Global | alibabagroup.com |
| 206092 | Internet Utilities Europe and Asia Ltd | Hosting / VPN | UK / Europe | fns-holdings.com |
| 36352 | HostPapa | Hosting | US / Canada | colocrossing.com |
| 47890 | UNMANAGED LTD | Hosting / Dedicated Servers | UK | unmanaged.uk |
| 216071 | Servers Tech FZCO | Hosting | UAE / Europe | vdsina.com |
| 24940 | Hetzner Online GmbH | Hosting | Germany / Finland | hetzner.de |
| 210743 | babbar SEO tools | SEO tools | Europe | babbar.tech |
| 62966 | BrightEdge Technologies | SEO tools | United States | brightedge.com |
| 212238 | Datacamp UK Ltd | CDN / Hosting | UK / Europe | datacamp.co.uk |
| 13285 | TalkTalk Communications | VPN / Cloud | UK | pxc.co.uk |
| 48090 | TechOff SRV Limited | Hosting | UK | - |
| 16509 | Amazon.com, Inc. (AWS) | Cloud / Hosting | Global | amazon.com |
| 45899 | Coc Coc / VNPT | Search / Backbone | Vietnam | vnpt.vn |
| 7552 | Viettel Group | ISP / Backbone | Vietnam | viettel.com.vn |
| 7029 | Windstream Communications | ISP | United States | uniti.com |
| 7018 | AT&T Enterprises, LLC | ISP | United States | att.com |
| 136907 | Huawei Clouds | Hosting | Hong Kong | huaweicloud.com |
| 46851 | Turnitin LLC | AI Tools | Global | turnitin.com |
| 205659 | M247 Ltd | Cloud / Hosting | Lithuania | code200.global |
| 133944 | trafficforce, UAB | Cloud / Hosting | Lithuania | trafficforce.lt |
| 12993 | DELSKA Latvia | Hosting | Latvia | delska.com |
| 9009 | M247 Europe SRL | Hosting / VPN | Romania | m247global.com |
| 204646 | web2objects GmbH | CDN / Cloud | Germany | web2objects.de |
| 51167 | Contabo GmbH | Hosting / VPN | Germany | contabo.com |
| 132203 | Tencent Cloud | CDN / Hosting | Hong Kong | tencent.com |
| 8075 | Microsoft Corporation | Cloud / CDN | United States | microsoft.com |
| 150436 | BytePlus | CDN / Hosting | Singapore | byteplus.com |
| 328376 | ALFA O AND O VENTURES | ISP | Nigeria | aoonetworks.com |
| 401560 | OneCable Network LLC | Hosting | United States | onecablenetwork.com |
| 63199 | CDS Global Cloud | Hosting | United States | cdsglobalcloud.com |
| 201942 | Soltia Consulting SL | Hosting | Spain | soltia.es |
| 202636 | Invermae Solutions SL | Hosting | Spain | intermanaged.com |
| 55286 | B2 Net Solutions Inc. | Hosting | Canada | servermania.com |
| 20278 | Nexeon Technologies | Hosting | United States | nexeon.com |
| 32934 | Facebook, Inc. | Hosting | United States | facebook.com |
| 22773 | Cox Communications | ISP | United States | cox.com |
| 7922 | Comcast Cable Communications, LLC | ISP | United States | corporate.comcast.com |
| 62610 | Zenlayer INC | Hosting / Edge / Cloud | Global | zenlayer.com |
| 208677 | Cloud Technologies LLC t/a Cloud.ru | Cloud / Hosting | Russia | cloud.ru |

Additional context for **AS7922 (Comcast)**: As the largest residential ISP in the United States, Comcast's network now exhibits highly aggressive traffic behavior patterns. Unlike smaller ASNs where we can confidently apply broad mitigation measures, Comcast's sheer scale makes us hesitant to deploy large-scale challenges — we fear impacting legitimate user traffic and are somewhat "holding back" out of caution. This entry reflects observed patterns as of June 22, 2026.

> Note: Inclusion in this list does not imply malicious intent at the organization level.
> It reflects observed traffic patterns within a specific operational context.

---
