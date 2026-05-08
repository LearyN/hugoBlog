---
title: "Let AI Directly Operate Your Google Ads and GSC"
date: 2026-05-08
draft: false
---

The idea is simple: connect your AI agent directly to Google Ads and Search Console via API, enabling fully automated data queries, analysis, and bulk operations.

Not the "screenshot it and ask GPT to guess" approach. The AI holds your credentials and calls the API directly — query anything, modify anything.

Total setup time: about 30 minutes. Here's the full walkthrough.

## What You Can Do After Setup

### Google Ads API

#### Data Queries
- Pull ad data across any time range and dimension (campaigns/ad groups/keywords/search terms/geo/device)
- Never manually export CSVs from the dashboard again

#### Bulk Operations
- Add 50 negative keywords, change bidding strategies, adjust budgets, create campaigns — all in one go
- What takes 30 minutes of clicking in the UI, the API does in one second

#### Diagnostics & Optimization
- AI analyzes complete data: detects self-competition, pinpoints budget waste, surfaces high-performing keywords
- Generates data-backed weekly reports and optimization recommendations

### GSC API

#### Search Performance
- Analyze organic traffic by keyword/page/country/device
- Find keywords ranking 5-15 to push to page one

#### Index Management
- Bulk submit URLs, manage Sitemaps, check indexing status

#### SEO + SEM Synergy
- Cross-analyze organic and paid search data to find overlaps and complementary opportunities

## API Access Levels (Important)

Google Ads API has three tiers that determine what you can do:

### Test Account — Default Starting Point
- Granted immediately, no review
- Can only access test accounts, cannot query real data
- Daily limit: 15,000 requests
- Use case: development and debugging

### Basic Access — The Choice for Most People
- Submit application, typically 2-5 business days
- Can access production accounts (real data)
- Daily limit: 15,000 requests (more than enough for AI assistant use — a full weekly report consumes about 20-50 requests)
- Read and write access

### Standard Access — Large SaaS / Agencies
- Review takes 7-14 days, requires OAuth compliance check
- No request limits
- Unnecessary for internal use

### Upgrade Path

Test → Basic: Google Ads Manager Account → Tools & Settings → API Center → Apply for Basic Access. Just describe your use case (e.g., "Internal tool for performance analysis and bid automation"), results in 2-5 days.

## Part 1: Google Ads API Setup

Auth mode: OAuth 2.0 user authorization. Four credentials needed:

```text
client_id        # OAuth Client ID
client_secret    # OAuth Client Secret
developer_token  # Developer Token
refresh_token    # User Authorization Token
```

### Step 1: Get a Developer Token

The Developer Token is your API entry pass, tied to an MCC (Manager Account).

1. Log into Google Ads MCC: https://ads.google.com
2. Tools & Settings → Setup → API Center
3. Apply for access → immediately receive a Test Account level token
4. Upgrade to Basic Access as needed

MCC is Google Ads' Manager Account for managing multiple sub-accounts. Even with just one ad account, you need to create an MCC first to apply for a Developer Token.

### Step 2: Create OAuth Client Credentials

Create OAuth credentials in Google Cloud Console:

1. Open https://console.cloud.google.com, create or select a project
2. Configure OAuth consent screen:
  - APIs & Services → OAuth consent screen
  - User Type: select External
  - Fill in app name + email, skip the rest
  - Add your Gmail under Test users
3. Create credentials:
  - APIs & Services → Credentials → + CREATE CREDENTIALS → OAuth client ID
  - Type: Web application
  - Authorized redirect URIs: add http://localhost
  - Save the Client ID and Client Secret
4. Enable the API:
  - APIs & Services → Library → search "Google Ads API" → Enable

⚠️ Redirect URI must be http://localhost. The legacy urn:ietf:wg:oauth:2.0:oob was deprecated by Google in 2022.

### Step 3: Get a Refresh Token

This is the core of the OAuth flow — authorizing your Google account for API access.

#### 3.1 Construct the Authorization URL

Replace YOUR_CLIENT_ID with the Client ID from Step 2:

```text
https://accounts.google.com/o/oauth2/v2/auth?client_id=YOUR_CLIENT_ID&redirect_uri=http://localhost&scope=https://www.googleapis.com/auth/adwords&response_type=code&access_type=offline&prompt=consent
```

#### 3.2 Browser Authorization

1. Paste the URL into your browser address bar, hit Enter
2. Log in with a Google account that has Google Ads access → click Allow
3. Redirects to http://localhost/?code=4/0AXXXX...&scope=...
4. The page won't load — that's expected. Copy the full URL from the address bar

#### 3.3 Exchange Code for Refresh Token

```python
import requests

response = requests.post("https://oauth2.googleapis.com/token", data={
    "code": "THE_CODE_FROM_URL",
    "client_id": "YOUR_CLIENT_ID",
    "client_secret": "YOUR_CLIENT_SECRET",
    "redirect_uri": "http://localhost",
    "grant_type": "authorization_code"
})

result = response.json()
print("Refresh Token:", result.get("refresh_token"))
```

If you already have an AI assistant running, just paste the full browser URL to it — it'll handle the token exchange automatically.

### Step 4: Write the Config File

Path: ~/.google-ads.yaml

```yaml
client_id: "YOUR_CLIENT_ID.apps.googleusercontent.com"
client_secret: "YOUR_CLIENT_SECRET"
customer_id: "MCC_ACCOUNT_ID"
developer_token: "DEVELOPER_TOKEN"
login_customer_id: "MCC_ACCOUNT_ID"
refresh_token: "REFRESH_TOKEN"
use_proto_plus: true
```

customer_id / login_customer_id = MCC's 10-digit ID (no dashes). When querying data, use the sub-account ID, not the MCC ID.

### Step 5: Verify

```python
from google.ads.googleads.client import GoogleAdsClient

client = GoogleAdsClient.load_from_storage("~/.google-ads.yaml")
service = client.get_service("GoogleAdsService")

query = """
    SELECT customer_client.id, customer_client.descriptive_name
    FROM customer_client
    WHERE customer_client.manager = FALSE
"""

response = service.search_stream(customer_id="YOUR_MCC_ID", query=query)
for batch in response:
    for row in batch.results:
        print(f"{row.customer_client.descriptive_name} (ID: {row.customer_client.id})")
```

If you see your sub-accounts listed, you're good.

### Common Errors

| Error | Cause | Fix |
|---|---|---|
| `invalid_grant: Token has been expired or revoked` | Refresh Token expired | Re-run Step 3 |
| `DEVELOPER_TOKEN_NOT_APPROVED` | Still at Test Account level | Apply for Basic Access |
| Query returns empty | Used MCC ID to query data | Use sub-account ID instead |
| `RESOURCE_EXHAUSTED` | Daily quota of 15,000 exhausted | Resets at Pacific midnight |

## Part 2: GSC API Setup

Auth mode: Service Account. Much simpler than Google Ads — no user interaction needed.

### Step 1: Create a Service Account

1. Google Cloud Console → IAM & Admin → Service Accounts
2. + CREATE SERVICE ACCOUNT
3. Fill in name (e.g., gsc-api) → Create → skip roles → Done

### Step 2: Download JSON Key

1. Click the SA you just created → Keys tab
2. Add Key → Create new key → JSON → Create
3. Browser downloads JSON file, save to a secure location (e.g., ~/.gsc/gsc-key.json)

The JSON looks something like this:

```json
{
  "type": "service_account",
  "project_id": "your-project-id",
  "private_key": "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n",
  "client_email": "gsc-api@your-project-id.iam.gserviceaccount.com"
}
```

⚠️ This file is effectively a password. Don't push to GitHub, don't share in group chats.

### Step 3: Enable Search Console API

APIs & Services → Library → search "Google Search Console API" → Enable

### Step 4: Authorize Service Account in GSC

This is the step people miss most! Creating an SA ≠ SA has access to your data.

1. Open https://search.google.com/search-console
2. Select site → Settings → Users and permissions → Add user
3. Email: enter the SA's client_email (the xxx@xxx.iam.gserviceaccount.com from the JSON)
4. Permission: Restricted (read-only) or Full
5. Must be done for each site individually

### Step 5: Verify

```python
from google.oauth2 import service_account
from googleapiclient.discovery import build

credentials = service_account.Credentials.from_service_account_file(
    '~/.gsc/gsc-key.json',
    scopes=['https://www.googleapis.com/auth/webmasters.readonly']
)

service = build('searchconsole', 'v1', credentials=credentials)
sites = service.sites().list().execute()

for site in sites.get('siteEntry', []):
    print(site['siteUrl'])
```

If sites show up, you're done.

### Common Errors

| Error | Cause | Fix |
|---|---|---|
| `403 Forbidden` | SA doesn't have site permission | Add SA email in GSC settings |
| Site format mismatch | `sc-domain:example.com` vs `https://example.com/` | Use the exact format shown in GSC |
| Data delayed 2-3 days | Normal Google behavior | Not a config issue |

## Real-World Examples

Query data: "Top 5 campaigns by spend in the last 7 days" → AI calls API → structured report in 10 seconds

Search term mining: "Find terms that spent money but got zero conversions" → AI queries search_term_view → outputs waste list → adds negative keywords after confirmation

SEO+SEM synergy: "How much keyword overlap between organic and paid?" → AI pulls GSC + Google Ads data simultaneously → cross-comparison

Automated weekly report: "Generate this week's report" → AI pulls multi-dimensional data → calculates WoW changes → diagnoses → generates full document

## Lessons Learned: The New Problem of Too-Easy Operations

After setting up the API, you'll hit a "sweet problem": operations become so easy that your optimization frequency might 3-5x overnight. Adjusting bids, adding negatives, tweaking budgets, switching strategies — what used to require logging into the dashboard now takes one sentence. Lower friction = way more changes.

The problem: retrospective review can't keep up.

You can't remember what you changed last week, what the data was before, or how things performed after. Google Ads' change history exists but isn't intuitive, and lacks the decision context from that moment.

My solution: make AI auto-output operation logs.

- Small optimizations (budget changes, negative keywords, audience tweaks) → Have OpenClaw send an operation brief via IM to the optimizer after each action. Includes: what changed, what it was before, why it changed. One message, takes seconds to scan.
- Large complex optimizations (new campaigns, ad group restructuring, bulk keyword migration) → Output as an online document. Complete with data comparisons, decision logic, expected outcomes, review checkpoints. Easy for the team to retrospect and archive.

This requires your OpenClaw to integrate with at least one online document platform. I chose Feishu (Lark) — its IM supports card-format messages with excellent table rendering for operation briefs, and its online docs work great for archiving and team collaboration.

You can also use Notion, Google Docs, Tencent Docs, or whatever fits your stack. The core principle: log every operation, auto-output, easy to trace back.

## Appendix: GSC Data Sampling on Large Sites

If you manage a massive website (millions of pages), you'll hit an annoying issue: GSC data is heavily sampled. Impressions, clicks, average position — what Google shows you might just be approximated values from sampling, especially for long-tail queries and low-traffic pages.

Solution: export GSC data to BigQuery.

Google officially supports GSC → BigQuery bulk data export. After export, you get complete, unsampled raw data. For day-to-day analysis, SEOgets works great for querying BigQuery data — it offers better analytical capabilities than the native GSC interface, with longer time ranges and finer-grained slicing.

SEOgets also supports MCP integration with OpenClaw, fitting perfectly into this workflow — AI queries complete unsampled GSC data directly. Not going deeper here, check these if interested:

- BigQuery export setup: https://seogets.com/blog/setting-up-big-query
- MCP integration: https://seogets.com/help/how-to-configure-mcp-in-claude-desktop-06s86

---

Last updated: 2026-05-08
