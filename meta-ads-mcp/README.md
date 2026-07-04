# Meta Ads MCP Server

A remote MCP server that wraps the Meta Marketing API so Claude can pull data
from all of your Meta ad accounts: accounts, campaigns, ad sets, ads, and
performance insights (spend, impressions, clicks, CTR/CPC/CPM, reach,
conversions, with optional breakdowns and date ranges).

## Tools exposed

- `list_ad_accounts` — every ad account reachable with your token
- `get_campaigns(account_id, status?, limit?)`
- `get_adsets(account_id, campaign_id?, limit?)`
- `get_ads(account_id, adset_id?, campaign_id?, limit?)`
- `get_insights(account_id, level?, date_preset? | since+until, breakdowns?, fields?, limit?)`

## 1. Get a Meta access token with access to all your ad accounts

1. Go to [developers.facebook.com](https://developers.facebook.com) and create an app
   (type: **Business**).
2. Add the **Marketing API** product to the app.
3. In [Meta Business Settings](https://business.facebook.com/settings) →
   **Users → System Users**, create a system user (role: Admin, or Employee
   with the right permission).
4. Under **Assign Assets**, assign every ad account you want Claude to see to
   that system user.
5. Generate a token for the system user with the `ads_read` permission
   (add `ads_management` too if you later want write access, e.g. pausing
   campaigns). Choose a token with no expiry, or a long-lived one, and set a
   calendar reminder to rotate it if it does expire.

This gives you one token that covers every ad account, rather than one login
per account.

## 2. Deploy to Vercel

```bash
cd meta-ads-mcp
npm install
vercel deploy --prod
```

Then in the Vercel project settings, add two environment variables (Project
Settings → Environment Variables), and redeploy so they take effect:

| Variable            | Value                                                  |
|----------------------|--------------------------------------------------------|
| `META_ACCESS_TOKEN`  | the system user token from step 1                      |
| `MCP_SECRET_TOKEN`   | a random string you generate, e.g. `openssl rand -hex 24` |

## 3. Add it to Claude as a custom connector

In Claude, go to **Customize → Connectors → Add custom connector**, and enter
this URL (no OAuth fields needed):

```
https://<your-project>.vercel.app/api/mcp?token=<MCP_SECRET_TOKEN>
```

Using the exact `MCP_SECRET_TOKEN` value from step 2. This URL is effectively
a bearer credential, so treat it as a secret — don't post it or check it into
git.

Note: the token is passed as a `?token=` query parameter rather than a
bracketed dynamic path segment. This is deliberate — folder names with
square brackets (e.g. `[token]`) can get mangled by drag-and-drop uploads or
some zip tools, so a query string is more robust if you're not deploying via
`git push` or the Vercel CLI.

Enable the connector for a conversation via the "+" button → Connectors, then
ask Claude something like: *"List my Meta ad accounts"* or *"Show me spend
and ROAS by campaign for account X over the last 30 days."*

## Notes / next steps

- **Security model**: this uses a shared-secret URL rather than full OAuth,
  which is the simplest option for a single-user setup. If you ever want to
  let teammates connect with their own Meta permissions instead of a shared
  system-user token, that would need a real OAuth layer in front of Meta's
  Marketing API — a bigger build, happy to do that if it becomes useful.
- **Rate limits**: the Marketing API has its own rate limits per app/ad
  account; if you're pulling insights across many accounts at once you may
  want to add caching or request the accounts one at a time.
- **Extending**: to add write actions (e.g. pause a campaign, adjust a
  budget), add a new `server.registerTool(...)` block in `lib/server.ts`
  calling the relevant Graph API POST endpoint — same pattern as the read
  tools here.
