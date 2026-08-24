# 54ch10 MCP server

Thin Model Context Protocol wrapper around the **54ch10 Brief API**.

- Live API: https://54ch10.uk/v1/brief?type=address|token|url&q=...
- Free/demo: header `X-54ch10-Free: 1` or https://54ch10.uk/v1/brief/free
- OpenAPI: https://54ch10.uk/openapi.json
- x402 discovery: https://54ch10.uk/.well-known/x402
- Brand: **54ch10**
- **Analytics-only** — informational heuristics, not financial, legal, or investment advice. Not clearance.

Exposes one tool: **brief**.

| Field | Value |
|-------|-------|
| package name | `54ch10-mcp` |
| MCP registry name (`mcpName`) | `io.github.sachio222/54ch10-mcp` |
| Manifest | `server.json` |

## Install / run

Requires Node.js 18+.

### After the package is on the public registry

Use npx with package `54ch10-mcp` (see CONFIG.example.json).

### From this directory (local)

1. Install package dependencies (see package.json).
2. Start with the start script, or: node src/index.js

The process speaks MCP over **stdio**. Hosts spawn it; do not expect interactive terminal output.

| Env | Purpose |
|-----|---------|
| BRIEF_API_BASE | Override API base (default https://54ch10.uk) |
| BRIEF_API_KEY | Optional paid key. Empty → wrapper sends X-54ch10-Free: 1 |

Smoke: GET https://54ch10.uk/v1/brief/free?type=url&q=https://example.com

Optional: use the inspect script in package.json with the MCP Inspector.

## Tool: brief

| Arg | Type | Required | Description |
|-----|------|----------|-------------|
| type | address / token / url | yes | What to brief |
| q | string | yes | Address, token id/symbol, or URL |

Returns the live JSON brief (score, band, flags, summary, sources, disclaimer, …).

## Auth / payments

1. **Free/demo** — leave BRIEF_API_KEY empty (wrapper uses X-54ch10-Free: 1, 20/UTC-day/IP).
2. **Stripe** — set BRIEF_API_KEY after Checkout claim.
3. **x402 (HTTP API)** — call https://54ch10.uk/v1/brief with USDC pay-per-brief ($0.01 Base/Solana). This stdio wrapper does not auto-pay; use x402 client libs against HTTP, or a Stripe key here.

Discovery: https://54ch10.uk/.well-known/x402

## Registry listing checklist

Local prep (this folder):

- [x] Live HTTPS tool target
- [x] package.json name 54ch10-mcp + mcpName = io.github.sachio222/54ch10-mcp
- [x] server.json matching mcpName
- [x] CONFIG.example.json + README
- [x] Pack dry-run verification (see gtm/listings-log.md)
- [ ] Public GitHub repo sachio222/54ch10-mcp for io.github.sachio222 namespace
- [ ] Public JS-registry auth on this box — GAP in listings-log (do not invent secrets)
- [ ] After package 0.1.0 is public: mcp-publisher login github, then publish

See gtm/listings-log.md for exact next steps once auth exists.

Also: mcp.so / Smithery / awesome-mcp-servers PRs as sachio222 after the package is live.

**Do not** Discord/X auto-post.

## Disclaimer

Informational tooling only. Not financial, investment, legal, or tax advice. Full text: https://54ch10.uk/LEGAL_DISCLAIMER.txt
