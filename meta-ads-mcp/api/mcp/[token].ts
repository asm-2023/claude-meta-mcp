import type { VercelRequest, VercelResponse } from "@vercel/node";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { buildMcpServer } from "../../lib/server.js";

export const config = {
  api: {
    bodyParser: true,
  },
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const expected = process.env.MCP_SECRET_TOKEN;
  const provided = req.query.token;

  if (!expected || provided !== expected) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  const server = buildMcpServer();
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });

  res.on("close", () => {
    transport.close();
    server.close();
  });

  await server.connect(transport);
  await transport.handleRequest(req as any, res as any, req.body);
}
