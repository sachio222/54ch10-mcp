#!/usr/bin/env node
/**
 * 54ch10 MCP server — thin stdio wrapper around live HTTPS https://54ch10.uk
 * Tools: brief, whois, dns, tls, normalize-url, hash, encode, fetch, paste.
 * Analytics-only tooling — not financial, legal, or investment advice.
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const VERSION = "0.3.0";
const API_BASE = process.env.BRIEF_API_BASE || "https://54ch10.uk";
const API_KEY = process.env.BRIEF_API_KEY || "";

const DISCLAIMER =
  "54ch10 analytics-only: informational heuristics, not financial/legal/investment advice or clearance.";

const server = new McpServer({
  name: "54ch10",
  version: VERSION,
});

function authHeaders() {
  const headers = {
    Accept: "application/json",
    "User-Agent": `54ch10-mcp/${VERSION}`,
  };
  if (API_KEY) {
    headers.Authorization = `Bearer ${API_KEY}`;
  } else {
    // Canonical paths are x402-gated; free/demo via header (20/UTC-day/IP).
    headers["X-54ch10-Free"] = "1";
  }
  return headers;
}

async function callApi(path, searchParams, opts = {}) {
  const url = new URL(path, API_BASE);
  const method = (opts.method || "GET").toUpperCase();
  let body;
  if (method === "GET") {
    for (const [k, v] of Object.entries(searchParams || {})) {
      if (v != null && v !== "") url.searchParams.set(k, String(v));
    }
  } else {
    body = JSON.stringify(searchParams || {});
  }

  let res;
  try {
    const headers = authHeaders();
    if (body) headers["Content-Type"] = "application/json";
    res = await fetch(url, { method, headers, body });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              ok: false,
              error: "network_error",
              message: msg,
              disclaimer: DISCLAIMER,
            },
            null,
            2
          ),
        },
      ],
      isError: true,
    };
  }

  const text = await res.text();
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = {
      ok: false,
      error: "non_json",
      status: res.status,
      raw: text.slice(0, 500),
    };
  }

  if (!res.ok) {
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              ok: false,
              status: res.status,
              body: parsed,
              disclaimer: DISCLAIMER,
            },
            null,
            2
          ),
        },
      ],
      isError: true,
    };
  }

  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(parsed, null, 2),
      },
    ],
  };
}

server.tool(
  "brief",
  "Pre-interact risk brief for an EVM address, token, or URL via the 54ch10 Brief API. Returns score (0–100, higher = more concerning), band, flags, summary, and sources. Analytics-only — not clearance or financial advice.",
  {
    type: z
      .enum(["address", "token", "url"])
      .describe("What to brief: EVM address, token id/symbol, or URL"),
    q: z
      .string()
      .min(1)
      .max(2048)
      .describe("Address, token id/symbol, or URL to brief"),
  },
  async ({ type, q }) => callApi("/v1/brief", { type, q })
);

server.tool(
  "whois",
  "WHOIS/RDAP domain lookup via 54ch10: registration, registrar, age_days, status, nameservers. Analytics-only fraud-signal helper — not clearance.",
  {
    domain: z
      .string()
      .min(1)
      .max(253)
      .describe("Domain name (e.g. example.com)"),
  },
  async ({ domain }) => callApi("/v1/whois", { domain })
);

server.tool(
  "dns",
  "DNS A/AAAA/MX/NS summary via 54ch10 (Cloudflare DoH) with fraud-signal style flags. Analytics-only — not clearance.",
  {
    domain: z
      .string()
      .min(1)
      .max(253)
      .describe("Domain name (e.g. example.com)"),
  },
  async ({ domain }) => callApi("/v1/dns", { domain })
);

server.tool(
  "tls",
  "TLS/CT certificate summary via 54ch10 (crt.sh + HTTPS reachability): issuer, validity window, flags. Analytics-only — not clearance.",
  {
    domain: z
      .string()
      .min(1)
      .max(253)
      .describe("Domain name (e.g. example.com)"),
  },
  async ({ domain }) => callApi("/v1/tls", { domain })
);

server.tool(
  "normalize-url",
  "Canonicalize a URL via 54ch10 (scheme/host lowercased, fragment stripped, query sorted). Analytics-only.",
  {
    q: z
      .string()
      .min(1)
      .max(4096)
      .describe("URL to normalize/canonicalize"),
  },
  async ({ q }) => callApi("/v1/normalize-url", { q })
);


server.tool(
  "hash",
  "Hash UTF-8 text via 54ch10 (sha256|sha1|md5) → hex + base64. Utility — not crypto advice.",
  {
    algo: z.enum(["sha256", "sha1", "md5"]).default("sha256").describe("Hash algorithm"),
    q: z.string().min(0).max(65536).describe("Text to hash"),
  },
  async ({ algo, q }) => callApi("/v1/hash", { algo, q })
);

server.tool(
  "encode",
  "Encode text via 54ch10 (base64|hex|url). Utility.",
  {
    format: z.enum(["base64", "hex", "url"]).default("base64").describe("Encoding format"),
    q: z.string().min(0).max(65536).describe("Text to encode"),
  },
  async ({ format, q }) => callApi("/v1/encode", { format, q })
);

server.tool(
  "fetch",
  "Fetch a public URL via 54ch10 (SSRF-safe). Returns status, contentType, markdown|text. Cap 200KB. Analytics-only.",
  {
    url: z.string().url().describe("Public http(s) URL"),
    format: z.enum(["markdown", "text"]).default("markdown").describe("Output format"),
  },
  async ({ url, format }) => callApi("/v1/fetch", { url, format })
);

server.tool(
  "paste_write",
  "Store a short ephemeral paste via 54ch10 (KV TTL default 1h, max 24h). NOT a vault — agent handoff only.",
  {
    content: z.string().min(1).max(64000).describe("Plaintext payload"),
    ttl_seconds: z.number().int().min(60).max(86400).optional().describe("TTL seconds (default 3600)"),
  },
  async ({ content, ttl_seconds }) => {
    const payload = { content };
    if (ttl_seconds != null) payload.ttl_seconds = ttl_seconds;
    return callApi("/v1/paste", payload, { method: "POST" });
  }
);

server.tool(
  "paste_read",
  "Retrieve an ephemeral 54ch10 paste by id (TTL-bound). NOT a vault.",
  {
    id: z.string().min(8).max(32).describe("Paste id from paste_write"),
  },
  async ({ id }) => callApi("/v1/paste", { id })
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(
    `54ch10 MCP server ${VERSION} running on stdio → ${API_BASE} (brief, whois, dns, tls, normalize-url, hash, encode, fetch, paste)`
  );
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
