#!/usr/bin/env node
/**
 * 54ch10 MCP server — thin stdio wrapper around live HTTPS https://54ch10.uk
 * Tools: brief, whois, dns, tls, normalize-url.
 * Analytics-only tooling — not financial, legal, or investment advice.
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const VERSION = "0.2.0";
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

async function callApi(path, searchParams) {
  const url = new URL(path, API_BASE);
  for (const [k, v] of Object.entries(searchParams)) {
    if (v != null && v !== "") url.searchParams.set(k, String(v));
  }

  let res;
  try {
    res = await fetch(url, { headers: authHeaders() });
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
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = {
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
              body,
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
        text: JSON.stringify(body, null, 2),
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

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(
    `54ch10 MCP server ${VERSION} running on stdio → ${API_BASE} (brief, whois, dns, tls, normalize-url)`
  );
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
