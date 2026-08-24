#!/usr/bin/env node
/**
 * 54ch10 Brief API — thin MCP server wrapper.
 * Calls live HTTPS https://54ch10.uk/v1/brief (not a local stub).
 * Analytics-only tooling — not financial, legal, or investment advice.
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const API_BASE = process.env.BRIEF_API_BASE || "https://54ch10.uk";
const API_KEY = process.env.BRIEF_API_KEY || "";

const DISCLAIMER =
  "54ch10 analytics-only: informational heuristics, not financial/legal/investment advice or clearance.";

const server = new McpServer({
  name: "54ch10",
  version: "0.1.0",
});

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
  async ({ type, q }) => {
    const url = new URL("/v1/brief", API_BASE);
    url.searchParams.set("type", type);
    url.searchParams.set("q", q);

    const headers = {
      Accept: "application/json",
      "User-Agent": "54ch10-mcp/0.1.0",
    };
    if (API_KEY) {
      headers.Authorization = `Bearer ${API_KEY}`;
    } else {
      // Canonical /v1/brief is x402-gated; free/demo via header (20/UTC-day/IP).
      headers["X-54ch10-Free"] = "1";
    }

    let res;
    try {
      res = await fetch(url, { headers });
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
      body = { ok: false, error: "non_json", status: res.status, raw: text.slice(0, 500) };
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
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("54ch10 MCP server running on stdio → " + API_BASE);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
