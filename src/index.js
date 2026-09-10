#!/usr/bin/env node
/**
 * 54ch10 MCP server — thin stdio wrapper around live HTTPS https://54ch10.uk
 * Analytics-only tooling — not financial, legal, or investment advice.
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const VERSION = "0.3.3";
const API_BASE = process.env.BRIEF_API_BASE || "https://54ch10.uk";
/** One env accepts either a stack id OR a Bearer 54k_ key. Optional BRIEF_STACK_ID alias. */
const API_KEY = process.env.BRIEF_API_KEY || process.env.BRIEF_STACK_ID || "";

const DISCLAIMER =
  "54ch10 analytics-only: informational heuristics, not financial/legal/investment advice or clearance.";

const READONLY_EXTERNAL = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: true,
};

const READONLY_LOCAL = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
};

const WRITE_EXTERNAL = {
  readOnlyHint: false,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: true,
};

const PAID_BATCH = {
  readOnlyHint: false,
  destructiveHint: false,
  idempotentHint: false,
  openWorldHint: true,
};

const INSTRUCTIONS = `54ch10 wrap-before-click MCP. Standing order: https://54ch10.uk/wire.md

Routing:
1. Before the agent clicks or trusts a URL → call url.open (type=url). Maps to GET /v1/open?q= (page_risk / whois / page). Score 0–100, lower is better. HTTP 402 when unpaid — prefer X-54ch10-Stack (set BRIEF_API_KEY to a stack id) or Bearer 54k_.
2. Many URLs → url.open_batch (POST /v1/open/batch, paid-only, cap 25).
3. Need page body as markdown/text → url.fetch (SSRF-safe, 200KB cap).
4. Domain hygiene after url.open → domain.whois, then domain.dns, then domain.tls.
5. Canonicalize a messy URL → url.normalize.
6. address/token briefs → url.open with type=address|token → GET /v1/brief.
7. Utilities → util.hash / util.encode; ephemeral handoff → paste.write / paste.read.

Auth via BRIEF_API_KEY (one env): stack id → X-54ch10-Stack; 54k_… → Bearer; empty → X-54ch10-Free (or /v1/open/free). Stack: GET|POST /v1/stack ($1 → 80 credits). Bulk UI: https://linksafu.com/bulk. Analytics-only — not clearance.`;

const server = new McpServer(
  {
    name: "54ch10",
    version: VERSION,
  },
  { instructions: INSTRUCTIONS }
);

/**
 * BRIEF_API_KEY (or BRIEF_STACK_ID) accepts either:
 * - stack id (not starting with 54k_) → X-54ch10-Stack
 * - Bearer key starting with 54k_ → Authorization: Bearer
 * - empty → X-54ch10-Free
 */
function authHeaders(opts = {}) {
  const headers = {
    Accept: "application/json",
    "User-Agent": `54ch10-mcp/${VERSION}`,
  };
  if (!API_KEY) {
    if (!opts.paidOnly) {
      headers["X-54ch10-Free"] = "1";
    }
  } else if (API_KEY.startsWith("54k_")) {
    headers.Authorization = `Bearer ${API_KEY}`;
  } else {
    headers["X-54ch10-Stack"] = API_KEY;
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
    const headers = authHeaders(opts);
    if (body) headers["Content-Type"] = "application/json";
    res = await fetch(url, { method, headers, body });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            { ok: false, error: "network_error", message: msg, disclaimer: DISCLAIMER },
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
    parsed = { ok: false, error: "non_json", status: res.status, raw: text.slice(0, 500) };
  }

  if (!res.ok) {
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            { ok: false, status: res.status, body: parsed, disclaimer: DISCLAIMER },
            null,
            2
          ),
        },
      ],
      isError: true,
    };
  }

  return {
    content: [{ type: "text", text: JSON.stringify(parsed, null, 2) }],
  };
}

/** type=url → GET /v1/open?q=; address|token → GET /v1/brief?type=&q= */
function openOrBrief({ type, q }) {
  if (type === "url") {
    return callApi("/v1/open", { q });
  }
  return callApi("/v1/brief", { type, q });
}

server.registerTool(
  "url.open",
  {
    title: "Open URL / risk brief",
    description:
      "Maps to GET /v1/open for URL checks (page_risk, whois, page). Score 0–100, lower is better. HTTP 402 when unpaid — prefer X-54ch10-Stack or Bearer 54k_ via BRIEF_API_KEY. For type=url calls /v1/open?q=; for address|token keeps GET /v1/brief?type=&q=. Call first for wrap-before-click; then domain.whois / domain.dns / domain.tls. Analytics-only.",
    inputSchema: {
      type: z
        .enum(["address", "token", "url"])
        .describe(
          "What to brief. Prefer url (primary → GET /v1/open). address / token → GET /v1/brief. Example: url for https://example.com."
        ),
      q: z
        .string()
        .min(1)
        .max(2048)
        .describe(
          "Value to open/brief. Example URL: https://example.com/login. For type=url this is the q= query on /v1/open."
        ),
    },
    annotations: READONLY_EXTERNAL,
  },
  openOrBrief
);

server.registerTool(
  "url.open_batch",
  {
    title: "Bulk open URLs (paid)",
    description:
      "POST /v1/open/batch with JSON {urls:[...]}. Paid-only (stack X-54ch10-Stack or Bearer 54k_); no free path — HTTP 402 without credits. Cap 25 URLs per request. Server concurrency ~3; global inflight ~10. Prefer for allowlists; human bulk UI: https://linksafu.com/bulk. Each URL gets the same page_risk brief as GET /v1/open. Analytics-only.",
    inputSchema: {
      urls: z
        .array(z.string().min(1).max(4096))
        .min(1)
        .max(25)
        .describe("HTTP(S) URLs to open (1–25). Example: ['https://example.com','https://example.org']."),
    },
    annotations: PAID_BATCH,
  },
  async ({ urls }) => callApi("/v1/open/batch", { urls }, { method: "POST", paidOnly: true })
);

server.registerTool(
  "url.fetch",
  {
    title: "Page extraction (paid)",
    description:
      "Page extraction / public URL to markdown. GET https://54ch10.uk/v1/fetch?url= at $0.005. SSRF-safe; returns status, contentType, markdown|text (200KB cap). Use after url.open when you need page body, not just risk signals. Analytics-only.",
    inputSchema: {
      url: z
        .string()
        .url()
        .describe("Public http(s) URL to fetch. Example: 'https://example.com/about'."),
      format: z
        .enum(["markdown", "text"])
        .default("markdown")
        .describe("Output format. Prefer 'markdown' for agent reading; 'text' for plain."),
    },
    annotations: READONLY_EXTERNAL,
  },
  async ({ url, format }) => callApi("/v1/fetch", { url, format })
);

server.registerTool(
  "url.normalize",
  {
    title: "Normalize URL",
    description:
      "GET /v1/normalize-url — canonicalize a URL (scheme/host lowercased, fragment stripped, query sorted) before comparing or opening. Call before url.open when the URL is messy or duplicated. Analytics-only.",
    inputSchema: {
      q: z
        .string()
        .min(1)
        .max(4096)
        .describe("URL to normalize. Example: 'HTTPS://Example.com/a?b=1#x'."),
    },
    annotations: READONLY_EXTERNAL,
  },
  async ({ q }) => callApi("/v1/normalize-url", { q })
);

server.registerTool(
  "domain.whois",
  {
    title: "Domain WHOIS/RDAP",
    description:
      "GET /v1/whois — look up domain WHOIS/RDAP (registration, registrar, age_days, status, nameservers). Call after url.open when you need registration age / registrar signals. Analytics-only — not clearance.",
    inputSchema: {
      domain: z
        .string()
        .min(1)
        .max(253)
        .describe("Domain name without path. Example: 'example.com'."),
    },
    annotations: READONLY_EXTERNAL,
  },
  async ({ domain }) => callApi("/v1/whois", { domain })
);

server.registerTool(
  "domain.dns",
  {
    title: "Domain DNS",
    description:
      "GET /v1/dns — summarize DNS A/AAAA/MX/NS for a domain with fraud-signal style flags. Call with domain.whois / domain.tls for full domain hygiene after url.open. Analytics-only.",
    inputSchema: {
      domain: z
        .string()
        .min(1)
        .max(253)
        .describe("Domain name without path. Example: 'example.com'."),
    },
    annotations: READONLY_EXTERNAL,
  },
  async ({ domain }) => callApi("/v1/dns", { domain })
);

server.registerTool(
  "domain.tls",
  {
    title: "Domain TLS/CT",
    description:
      "GET /v1/tls — summarize TLS/CT (issuer, validity, HTTPS reachability) via crt.sh + probe. Call after url.open / domain.dns when certificate age or issuer matters. Analytics-only.",
    inputSchema: {
      domain: z
        .string()
        .min(1)
        .max(253)
        .describe("Domain name without path. Example: 'example.com'."),
    },
    annotations: READONLY_EXTERNAL,
  },
  async ({ domain }) => callApi("/v1/tls", { domain })
);

server.registerTool(
  "util.hash",
  {
    title: "Hash text",
    description:
      "GET /v1/hash — hash UTF-8 text (sha256|sha1|md5) to hex + base64. Utility for fingerprints — not crypto advice. Analytics-only utility.",
    inputSchema: {
      algo: z
        .enum(["sha256", "sha1", "md5"])
        .default("sha256")
        .describe("Hash algorithm. Default sha256. Example: 'sha256'."),
      q: z
        .string()
        .min(0)
        .max(65536)
        .describe("Text to hash. Example: 'hello'."),
    },
    annotations: READONLY_LOCAL,
  },
  async ({ algo, q }) => callApi("/v1/hash", { algo, q })
);

server.registerTool(
  "util.encode",
  {
    title: "Encode text",
    description:
      "GET /v1/encode — encode text as base64, hex, or url-encoding. Utility for safe transport of strings between tools.",
    inputSchema: {
      format: z
        .enum(["base64", "hex", "url"])
        .default("base64")
        .describe("Encoding format. Default base64. Example: 'base64'."),
      q: z
        .string()
        .min(0)
        .max(65536)
        .describe("Text to encode. Example: 'hello world'."),
    },
    annotations: READONLY_LOCAL,
  },
  async ({ format, q }) => callApi("/v1/encode", { format, q })
);

server.registerTool(
  "paste.write",
  {
    title: "Write ephemeral paste",
    description:
      "POST /v1/paste — store a short ephemeral paste (KV TTL default 1h, max 24h) and return an id. Agent handoff only — not a vault. Pair with paste.read.",
    inputSchema: {
      content: z
        .string()
        .min(1)
        .max(64000)
        .describe("Plaintext payload to store temporarily. Example: a short JSON handoff blob."),
      ttl_seconds: z
        .number()
        .int()
        .min(60)
        .max(86400)
        .optional()
        .describe("TTL in seconds (60–86400). Default 3600. Example: 3600."),
    },
    annotations: WRITE_EXTERNAL,
  },
  async ({ content, ttl_seconds }) => {
    const payload = { content };
    if (ttl_seconds != null) payload.ttl_seconds = ttl_seconds;
    return callApi("/v1/paste", payload, { method: "POST" });
  }
);

server.registerTool(
  "paste.read",
  {
    title: "Read ephemeral paste",
    description:
      "GET /v1/paste — retrieve an ephemeral paste by id from paste.write before TTL expiry. Agent handoff only — not a vault.",
    inputSchema: {
      id: z
        .string()
        .min(8)
        .max(32)
        .describe("Paste id returned by paste.write. Example: 'a1b2c3d4e5f6'."),
    },
    annotations: READONLY_EXTERNAL,
  },
  async ({ id }) => callApi("/v1/paste", { id })
);

server.registerPrompt(
  "wrap_before_click",
  {
    title: "Wrap before click",
    description:
      "Pre-interact workflow via GET /v1/open (url.open type=url), then domain whois/dns/tls, optionally fetch page body. Prefer stack (X-54ch10-Stack) or Bearer 54k_ for paid. Use before trusting or clicking a link.",
    argsSchema: {
      url: z
        .string()
        .describe("URL the agent is about to open. Example: 'https://example.com/claim'."),
    },
  },
  async ({ url }) => ({
    messages: [
      {
        role: "user",
        content: {
          type: "text",
          text:
            `Before interacting with ${url}:\n` +
            `1) Call url.open with type=url and q=${url} (maps to GET /v1/open?q=; score 0–100 lower is better; HTTP 402 unpaid — use BRIEF_API_KEY as stack id or 54k_ Bearer).\n` +
            `2) Extract host and call domain.whois, domain.dns, domain.tls.\n` +
            `3) If you need page body, call url.fetch.\n` +
            `4) For many URLs use url.open_batch (POST /v1/open/batch, paid, cap 25) or https://linksafu.com/bulk.\n` +
            `5) Summarize risk; do not treat this as clearance. Standing order: https://54ch10.uk/wire.md`,
        },
      },
    ],
  })
);

server.registerPrompt(
  "domain_hygiene",
  {
    title: "Domain hygiene pack",
    description:
      "Run whois + dns + tls for a domain after a URL open (/v1/open). Analytics-only domain hygiene.",
    argsSchema: {
      domain: z.string().describe("Domain without path. Example: 'example.com'."),
    },
  },
  async ({ domain }) => ({
    messages: [
      {
        role: "user",
        content: {
          type: "text",
          text: `Run domain hygiene for ${domain}: call domain.whois, domain.dns, and domain.tls. Report age, registrar, DNS flags, and TLS issuer/validity. Analytics-only.`,
        },
      },
    ],
  })
);

server.registerPrompt(
  "free_taste_demo",
  {
    title: "Free taste demo",
    description:
      "Walk through the free demo scam-signals page, then wrap-before-click with url.open (/v1/open) / domain.*. Mentions stack purchase path.",
    argsSchema: {
      note: z
        .string()
        .optional()
        .describe("Optional note for the agent. Example: 'show the free path'."),
    },
  },
  async ({ note }) => ({
    messages: [
      {
        role: "user",
        content: {
          type: "text",
          text:
            "Free taste path:\n" +
            "1) Open https://54ch10.uk/demo/scam-signals for the demo signals page.\n" +
            "2) Call url.open with type=url and q=https://54ch10.uk/demo/scam-signals (GET /v1/open?q=).\n" +
            "3) Optionally domain.whois / domain.dns / domain.tls on the host.\n" +
            "4) Empty BRIEF_API_KEY uses free/demo (X-54ch10-Free / /v1/open/free). After free quota, GET /v1/stack ($1→80) and set BRIEF_API_KEY to the stack id (X-54ch10-Stack) or a 54k_ Bearer key.\n" +
            "5) Analytics-only — not clearance." +
            (note ? `\nNote: ${note}` : ""),
        },
      },
    ],
  })
);


/* Legacy aliases — old flat tool ids still work after dot rename */
server.registerTool(
  "brief",
  {
    title: "Legacy: brief → url.open",
    description:
      "Legacy alias for url.open. Prefer url.open. type=url → GET /v1/open; address|token → GET /v1/brief. Score lower is better. HTTP 402 unpaid — stack or Bearer 54k_.",
    inputSchema: {
      type: z
        .enum(["address", "token", "url"])
        .describe("What to brief. Prefer 'url' → /v1/open."),
      q: z.string().min(1).max(2048).describe("Value to brief/open."),
    },
    annotations: READONLY_EXTERNAL,
  },
  openOrBrief
);
server.registerTool(
  "whois",
  {
    title: "Legacy: whois → domain.whois",
    description: "Legacy alias for domain.whois (GET /v1/whois). Prefer domain.whois.",
    inputSchema: {
      domain: z.string().min(1).max(253).describe("Domain name. Example: 'example.com'."),
    },
    annotations: READONLY_EXTERNAL,
  },
  async ({ domain }) => callApi("/v1/whois", { domain })
);
server.registerTool(
  "dns",
  {
    title: "Legacy: dns → domain.dns",
    description: "Legacy alias for domain.dns (GET /v1/dns). Prefer domain.dns.",
    inputSchema: {
      domain: z.string().min(1).max(253).describe("Domain name. Example: 'example.com'."),
    },
    annotations: READONLY_EXTERNAL,
  },
  async ({ domain }) => callApi("/v1/dns", { domain })
);
server.registerTool(
  "tls",
  {
    title: "Legacy: tls → domain.tls",
    description: "Legacy alias for domain.tls (GET /v1/tls). Prefer domain.tls.",
    inputSchema: {
      domain: z.string().min(1).max(253).describe("Domain name. Example: 'example.com'."),
    },
    annotations: READONLY_EXTERNAL,
  },
  async ({ domain }) => callApi("/v1/tls", { domain })
);
server.registerTool(
  "normalize-url",
  {
    title: "Legacy: normalize-url → url.normalize",
    description: "Legacy alias for url.normalize (GET /v1/normalize-url). Prefer url.normalize.",
    inputSchema: {
      q: z.string().min(1).max(4096).describe("URL to normalize."),
    },
    annotations: READONLY_EXTERNAL,
  },
  async ({ q }) => callApi("/v1/normalize-url", { q })
);
server.registerTool(
  "fetch",
  {
    title: "Legacy: fetch → url.fetch",
    description: "Legacy alias for url.fetch. Page extraction: GET https://54ch10.uk/v1/fetch?url= at $0.005. Prefer url.fetch.",
    inputSchema: {
      url: z.string().url().describe("Public http(s) URL."),
      format: z.enum(["markdown", "text"]).default("markdown").describe("Output format."),
    },
    annotations: READONLY_EXTERNAL,
  },
  async ({ url, format }) => callApi("/v1/fetch", { url, format })
);
server.registerTool(
  "hash",
  {
    title: "Legacy: hash → util.hash",
    description: "Legacy alias for util.hash (GET /v1/hash). Prefer util.hash.",
    inputSchema: {
      algo: z.enum(["sha256", "sha1", "md5"]).default("sha256").describe("Hash algorithm."),
      q: z.string().min(0).max(65536).describe("Text to hash."),
    },
    annotations: READONLY_LOCAL,
  },
  async ({ algo, q }) => callApi("/v1/hash", { algo, q })
);
server.registerTool(
  "encode",
  {
    title: "Legacy: encode → util.encode",
    description: "Legacy alias for util.encode (GET /v1/encode). Prefer util.encode.",
    inputSchema: {
      format: z.enum(["base64", "hex", "url"]).default("base64").describe("Encoding format."),
      q: z.string().min(0).max(65536).describe("Text to encode."),
    },
    annotations: READONLY_LOCAL,
  },
  async ({ format, q }) => callApi("/v1/encode", { format, q })
);
server.registerTool(
  "paste_write",
  {
    title: "Legacy: paste_write → paste.write",
    description: "Legacy alias for paste.write (POST /v1/paste). Prefer paste.write.",
    inputSchema: {
      content: z.string().min(1).max(64000).describe("Plaintext payload."),
      ttl_seconds: z.number().int().min(60).max(86400).optional().describe("TTL seconds."),
    },
    annotations: WRITE_EXTERNAL,
  },
  async ({ content, ttl_seconds }) => {
    const payload = { content };
    if (ttl_seconds != null) payload.ttl_seconds = ttl_seconds;
    return callApi("/v1/paste", payload, { method: "POST" });
  }
);
server.registerTool(
  "paste_read",
  {
    title: "Legacy: paste_read → paste.read",
    description: "Legacy alias for paste.read (GET /v1/paste). Prefer paste.read.",
    inputSchema: {
      id: z.string().min(8).max(32).describe("Paste id from paste.write / paste_write."),
    },
    annotations: READONLY_EXTERNAL,
  },
  async ({ id }) => callApi("/v1/paste", { id })
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(
    `54ch10 MCP server ${VERSION} running on stdio → ${API_BASE} (url.open→/v1/open, url.open_batch, url.*/domain.*/util.*/paste.* + legacy)`
  );
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
