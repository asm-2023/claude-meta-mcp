const GRAPH_VERSION = "v21.0";
const BASE = `https://graph.facebook.com/${GRAPH_VERSION}`;

/**
 * Calls the Meta Graph API with the configured long-lived access token.
 * Throws with the Graph API's own error payload if the call fails, so
 * failures are easy to diagnose (expired token, missing permission, etc.).
 */
export async function metaFetch(
  path: string,
  params: Record<string, string> = {}
): Promise<unknown> {
  const token = process.env.META_ACCESS_TOKEN;
  if (!token) {
    throw new Error(
      "META_ACCESS_TOKEN is not set. Add it as an environment variable in your Vercel project."
    );
  }

  const url = new URL(BASE + path);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  url.searchParams.set("access_token", token);

  const resp = await fetch(url.toString());
  const json = await resp.json();

  if (!resp.ok) {
    const message =
      (json as any)?.error?.message ?? `Meta API request failed (${resp.status})`;
    throw new Error(`Meta API error: ${message}`);
  }

  return json;
}

/** Normalizes an account id so callers can pass either "123" or "act_123". */
export function normalizeAccountId(accountId: string): string {
  return accountId.startsWith("act_") ? accountId : `act_${accountId}`;
}
