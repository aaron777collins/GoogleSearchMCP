# Repository: mcp-google-search

A minimal **Model Context Protocol (MCP) server** that provides Google web search tools and optional webhook callbacks to **n8n**. Ships with Docker + docker-compose for easy hosting.

> ✅ Why a *server*, not a client? In MCP, *servers* expose tools and resources; *clients* (like Claude Desktop, server-side LLM apps, etc.) connect to them. This project gives you a server that any MCP client can use.

---

## File Tree
```
.
├─ Dockerfile
├─ docker-compose.yml
├─ .env.example
├─ package.json
├─ tsconfig.json
├─ README.md
└─ src/
   ├─ server.ts
   ├─ google.ts
   ├─ n8n.ts
   └─ types.ts
```

---

## README.md
```md
# MCP Google Search Server

An MCP server exposing Google search as tools that MCP clients can call. Optional n8n webhook integration logs each query and result set.

## Features
- `google_search`: Programmable Search (JSON API) results (title, link, snippet, metadata)
- `fetch_url`: Fetch a URL and return plain text (best-effort extraction)
- Optional n8n webhook on each search or fetch
- WebSocket transport (easy to connect from remote clients)

## Requirements
- Node.js 20+
- A Google Programmable Search Engine (PSE) **cx**
- A Google API **key** with Custom Search JSON API enabled

## Quick Start (Docker)
1. Copy `.env.example` to `.env` and fill values:
   ```bash
   cp .env.example .env
   ```
2. Start services:
   ```bash
   docker compose up -d --build
   ```
3. The MCP WebSocket server listens on `ws://localhost:3333` (or your container host).

### Environment Variables
- `GOOGLE_API_KEY` – Google API key
- `GOOGLE_CX` – Programmable Search Engine cx id
- `PORT` – WebSocket server port (default 3333)
- `N8N_WEBHOOK_URL` – optional, e.g. `https://n8n.example.com/webhook/xyz` (will POST logs)
- `FETCH_MAX_BYTES` – max bytes to fetch for `fetch_url` (default 1048576)

## Connect from Claude Desktop (example)
Add to your Claude config (e.g., `claude_desktop_config.json`):
```json
{
  "mcpServers": {
    "google-search": {
      "command": "node",
      "args": ["/app/dist/server.js"],
      "transport": {
        "type": "websocket",
        "url": "ws://localhost:3333"
      }
    }
  }
}
```
> Adjust the path/URL for your setup. If running outside Docker, point to your host.

## n8n Integration
Set `N8N_WEBHOOK_URL` and the server will POST events like:
```json
{
  "event": "google_search",
  "timestamp": "2025-09-20T12:34:56.789Z",
  "query": "site:openai.com mcp",
  "params": {"num": 5},
  "results": [
    {"title": "...", "link": "https://...", "snippet": "...", "source": "google"}
  ]
}
```
You can then branch/transform in n8n (store to DB, send Slack, etc.).

## Development
```bash
pnpm i # or npm i / yarn
pnpm dev
```

## Production
```bash
pnpm build && pnpm start
```

## Security Notes
- Rate-limit with Docker/network policy or place behind a reverse proxy.
- Keep your API key secret. Consider restricting it to your IPs.
- Set a tight `GOOGLE_CX` scope to avoid unwanted results.

```

---

## .env.example
```bash
GOOGLE_API_KEY=replace_me
GOOGLE_CX=replace_me
PORT=3333
# Optional
N8N_WEBHOOK_URL=https://n8n.example.com/webhook/your-token
FETCH_MAX_BYTES=1048576
```

---

## docker-compose.yml
```yaml
version: "3.9"
services:
  mcp-google:
    build: .
    container_name: mcp-google
    env_file:
      - .env
    ports:
      - "3333:3333"
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "node", "/app/dist/server.js", "--healthcheck"]
      interval: 30s
      timeout: 5s
      retries: 3
```

---

## Dockerfile
```dockerfile
# syntax=docker/dockerfile:1
FROM node:20-alpine as base
WORKDIR /app
COPY package.json pnpm-lock.yaml* yarn.lock* package-lock.json* ./

# Use pnpm if present, else npm
RUN if [ -f pnpm-lock.yaml ]; then npm i -g pnpm@9; fi \
 && if [ -f pnpm-lock.yaml ]; then pnpm i --frozen-lockfile; \
    elif [ -f yarn.lock ]; then yarn install --frozen-lockfile; \
    else npm ci; fi

COPY tsconfig.json ./
COPY src ./src

RUN if [ -f pnpm-lock.yaml ]; then pnpm build; \
    elif [ -f yarn.lock ]; then yarn build; \
    else npm run build; fi

EXPOSE 3333
CMD ["node", "dist/server.js"]
```

---

## package.json
```json
{
  "name": "mcp-google-search",
  "version": "1.0.0",
  "type": "module",
  "private": true,
  "scripts": {
    "dev": "tsx watch src/server.ts",
    "build": "tsc -p .",
    "start": "node dist/server.js"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^0.2.0",
    "cross-fetch": "^4.0.0",
    "fast-xml-parser": "^4.4.0",
    "html-to-text": "^9.0.5",
    "ws": "^8.18.0"
  },
  "devDependencies": {
    "tsx": "^4.17.0",
    "typescript": "^5.6.3"
  }
}
```

---

## tsconfig.json
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "moduleResolution": "bundler",
    "outDir": "dist",
    "rootDir": "src",
    "esModuleInterop": true,
    "skipLibCheck": true,
    "strict": true
  },
  "include": ["src/**/*"]
}
```

---

## src/types.ts
```ts
export type GoogleResult = {
  title: string;
  link: string;
  snippet?: string;
  displayLink?: string;
  mime?: string;
  image?: {
    contextLink?: string;
    height?: number;
    width?: number;
    byteSize?: number;
    thumbnailLink?: string;
  };
};

export type WebhookPayload = {
  event: string;
  timestamp: string;
  [k: string]: any;
};
```

---

## src/n8n.ts
```ts
import fetch from "cross-fetch";
import type { WebhookPayload } from "./types.js";

const url = process.env.N8N_WEBHOOK_URL;

export async function postToN8n(payload: WebhookPayload) {
  if (!url) return;
  try {
    await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload)
    });
  } catch (err) {
    console.error("[n8n] webhook failed:", err);
  }
}
```

---

## src/google.ts
```ts
import fetch from "cross-fetch";
import type { GoogleResult } from "./types.js";

const API = "https://www.googleapis.com/customsearch/v1";
const key = process.env.GOOGLE_API_KEY || "";
const cx = process.env.GOOGLE_CX || "";

export async function googleSearch(query: string, opts?: {
  num?: number; // 1..10 per page (API limit)
  start?: number; // 1-indexed start
  safe?: "off" | "active" | "high";
  searchType?: "image" | undefined;
}) {
  if (!key || !cx) throw new Error("Missing GOOGLE_API_KEY or GOOGLE_CX");
  const params = new URLSearchParams({ key, cx, q: query });
  if (opts?.num) params.set("num", String(Math.min(Math.max(opts.num, 1), 10)));
  if (opts?.start) params.set("start", String(Math.max(opts.start, 1)));
  if (opts?.safe) params.set("safe", opts.safe);
  if (opts?.searchType) params.set("searchType", opts.searchType);

  const res = await fetch(`${API}?${params.toString()}`);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Google API error ${res.status}: ${text}`);
  }
  const data = await res.json();
  const items: GoogleResult[] = (data.items || []).map((it: any) => ({
    title: it.title,
    link: it.link,
    snippet: it.snippet,
    displayLink: it.displayLink,
    mime: it.mime,
    image: it.image
  }));
  const nextStart: number | undefined = data.queries?.nextPage?.[0]?.startIndex;
  return { items, nextStart, raw: data } as const;
}
```

---

## src/server.ts
```ts
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
