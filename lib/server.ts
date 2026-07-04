import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { metaFetch, normalizeAccountId } from "./meta-api.js";

const INSIGHT_LEVELS = ["account", "campaign", "adset", "ad"] as const;
const DATE_PRESETS = [
  "today",
  "yesterday",
  "last_7d",
  "last_14d",
  "last_30d",
  "last_90d",
  "this_month",
  "last_month",
  "this_year",
] as const;

const DEFAULT_INSIGHT_FIELDS = [
  "campaign_name",
  "adset_name",
  "ad_name",
  "spend",
  "impressions",
  "clicks",
  "ctr",
  "cpc",
  "cpm",
  "reach",
  "frequency",
  "actions",
  "action_values",
];

function toJsonContent(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
}

export function buildMcpServer(): McpServer {
  const server = new McpServer({ name: "meta-ads-mcp", version: "1.0.0" });

  server.registerTool(
    "list_ad_accounts",
    {
      description:
        "List every Meta ad account reachable with the configured access token, with id, name, currency, timezone, and status.",
      inputSchema: {},
    },
    async () => {
      const data = await metaFetch("/me/adaccounts", {
        fields: "id,name,account_status,currency,timezone_name,business_name",
        limit: "200",
      });
      return toJsonContent(data);
    }
  );

  server.registerTool(
    "get_campaigns",
    {
      description: "List campaigns for a given ad account, with budget, objective, and status.",
      inputSchema: {
        account_id: z.string().describe("Ad account ID, e.g. '1234567890' or 'act_1234567890'"),
        status: z.enum(["ACTIVE", "PAUSED", "ARCHIVED", "ALL"]).optional(),
        limit: z.number().int().positive().max(500).optional(),
      },
    },
    async ({ account_id, status, limit }) => {
      const acct = normalizeAccountId(account_id);
      const params: Record<string, string> = {
        fields: "id,name,status,objective,daily_budget,lifetime_budget,start_time,stop_time",
        limit: String(limit ?? 50),
      };
      if (status && status !== "ALL") {
        params.effective_status = JSON.stringify([status]);
      }
      const data = await metaFetch(`/${acct}/campaigns`, params);
      return toJsonContent(data);
    }
  );

  server.registerTool(
    "get_adsets",
    {
      description: "List ad sets for a given ad account, optionally filtered to one campaign.",
      inputSchema: {
        account_id: z.string(),
        campaign_id: z.string().optional(),
        limit: z.number().int().positive().max(500).optional(),
      },
    },
    async ({ account_id, campaign_id, limit }) => {
      const acct = normalizeAccountId(account_id);
      const params: Record<string, string> = {
        fields: "id,name,status,campaign_id,daily_budget,lifetime_budget,targeting,optimization_goal",
        limit: String(limit ?? 50),
      };
      if (campaign_id) params.filtering = JSON.stringify([
        { field: "campaign.id", operator: "EQUAL", value: campaign_id },
      ]);
      const data = await metaFetch(`/${acct}/adsets`, params);
      return toJsonContent(data);
    }
  );

  server.registerTool(
    "get_ads",
    {
      description: "List ads for a given ad account, optionally filtered to one ad set or campaign.",
      inputSchema: {
        account_id: z.string(),
        adset_id: z.string().optional(),
        campaign_id: z.string().optional(),
        limit: z.number().int().positive().max(500).optional(),
      },
    },
    async ({ account_id, adset_id, campaign_id, limit }) => {
      const acct = normalizeAccountId(account_id);
      const params: Record<string, string> = {
        fields: "id,name,status,adset_id,campaign_id,creative",
        limit: String(limit ?? 50),
      };
      const filters: Record<string, string>[] = [];
      if (adset_id) filters.push({ field: "adset.id", operator: "EQUAL", value: adset_id });
      if (campaign_id) filters.push({ field: "campaign.id", operator: "EQUAL", value: campaign_id });
      if (filters.length) params.filtering = JSON.stringify(filters);
      const data = await metaFetch(`/${acct}/ads`, params);
      return toJsonContent(data);
    }
  );

  server.registerTool(
    "get_insights",
    {
      description:
        "Get performance data (spend, impressions, clicks, CTR, CPC, CPM, reach, conversions/actions) for an ad account, at the account/campaign/adset/ad level, for a date range, with optional breakdowns (e.g. age, gender, country, publisher_platform, device_platform).",
      inputSchema: {
        account_id: z.string(),
        level: z.enum(INSIGHT_LEVELS).default("campaign"),
        date_preset: z.enum(DATE_PRESETS).optional().describe(
          "Used if since/until are not provided. Defaults to last_30d."
        ),
        since: z.string().optional().describe("YYYY-MM-DD, pairs with until"),
        until: z.string().optional().describe("YYYY-MM-DD, pairs with since"),
        breakdowns: z.array(z.string()).optional(),
        fields: z.array(z.string()).optional().describe("Overrides the default field set"),
        limit: z.number().int().positive().max(500).optional(),
      },
    },
    async ({ account_id, level, date_preset, since, until, breakdowns, fields, limit }) => {
      const acct = normalizeAccountId(account_id);
      const params: Record<string, string> = {
        level,
        fields: (fields && fields.length ? fields : DEFAULT_INSIGHT_FIELDS).join(","),
        limit: String(limit ?? 100),
      };
      if (since && until) {
        params.time_range = JSON.stringify({ since, until });
      } else {
        params.date_preset = date_preset ?? "last_30d";
      }
      if (breakdowns && breakdowns.length) {
        params.breakdowns = breakdowns.join(",");
      }
      const data = await metaFetch(`/${acct}/insights`, params);
      return toJsonContent(data);
    }
  );

  return server;
}
