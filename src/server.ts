import { Server } from "ws";
import { Server as McpServer, Tool } from "@modelcontextprotocol/sdk/server/index.js";
import { WebSocketServerAdapter } from "@modelcontextprotocol/sdk/transport/websocket/server.js";
import { googleSearch } from "./google.js";
import { postToN8n } from "./n8n.js";
import fetch from "cross-fetch";
import { htmlToText } from "html-to-text";

const PORT = Number(process.env.PORT || 3333);
const FETCH_MAX_BYTES = Number(process.env.FETCH_MAX_BYTES || 1048576);

function tool<T extends Tool>(t: T) { return t; }

const tools: Tool[] = [
  tool({
    name: "google_search",
    description: "Search the web via Google Programmable Search (JSON API). Returns up to 10 results per call.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search query (supports operators like site:, filetype:, etc.)" },
        num: { type: "number", minimum: 1, maximum: 10, default: 5 },
        start: { type: "number", minimum: 1, description: "1-indexed start index for pagination" },
        safe: { type: "string", enum: ["off", "active", "high"], default: "active" },
        searchType: { type: "string", enum: ["image"], description: "Set to 'image' to return images" }
      },
      required: ["query"]
    },
    async *execute({ query, num, start, safe, searchType }) {
      const { items, nextStart } = await googleSearch(String(query), {
        num: num ? Number(num) : 5,
        start: start ? Number(start) : undefined,
        safe: (safe as any) ?? "active",
        searchType: searchType as any
      });
      const payload = {
        event: "google_search",
        timestamp: new Date().toISOString(),
        query,
        params: { num, start, safe, searchType },
        results: items
      };
      await postToN8n(payload);
      return { content: [{ type: "text", text: JSON.stringify({ results: items, nextStart }, null, 2) }] };
    }
  }),

  tool({
    name: "fetch_url",
    description: "Fetch a URL and return best-effort plain text (truncated to FETCH_MAX_BYTES).",
    inputSchema: {
      type: "object",
      properties: {
        url: { type: "string" }
      },
      required: ["url"]
    },
    async *execute({ url }) {
      const res = await fetch(String(url));
      const buf = Buffer.from(await res.arrayBuffer());
      const truncated = buf.subarray(0, FETCH_MAX_BYTES);
      const text = truncated.toString("utf8");
      const plain = htmlToText(text, { wordwrap: 0, selectors: [{ selector: "script,style", format: "skip" }] });
      await postToN8n({ event: "fetch_url", timestamp: new Date().toISOString(), url, bytes: truncated.length });
      return { content: [{ type: "text", text: plain }] };
    }
  })
];

async function main() {
  if (process.argv.includes("--healthcheck")) {
    process.exit(0);
    return;
  }

  const wss = new Server({ port: PORT });
  const adapter = new WebSocketServerAdapter({ wss });
  const mcp = new McpServer({ name: "mcp-google-search", version: "1.0.0" }, { capabilities: { tools: {} } });
  for (const t of tools) mcp.tool("register", t);
  mcp.transport(adapter);
  await mcp.start();
  console.log(`[MCP] WebSocket listening on ws://0.0.0.0:${PORT}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
