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
| Primary install (today) | `npx -y github:sachio222/54ch10-mcp` |

## Install / run

Requires Node.js 18+.

### Primary (works today)

No public npmjs package yet. Install from the public GitHub repo:

```bash
npx -y github:sachio222/54ch10-mcp
```

Or as a git dependency:

```bash
npm install github:sachio222/54ch10-mcp
```

Claude Desktop / Cursor — see `CONFIG.example.json`:

```json
{
  "mcpServers": {
    "54ch10": {
      "command": "npx",
      "args": ["-y", "github:sachio222/54ch10-mcp"],
      "env": {
        "BRIEF_API_BASE": "https://54ch10.uk",
        "BRIEF_API_KEY": ""
      }
    }
  }
}
```

### GitHub Packages (not primary)

GitHub Packages npm only supports **scoped** packages (@`sachio222/...`). Consumers need `@sachio222:registry=https://npm.pkg.github.com` and auth. Not a drop-in for unscoped agent installs, so not primary.

### npmjs.org (not published)

`54ch10-mcp` is not on registry.npmjs.org yet (404). Do not rely on `npx 54ch10-mcp` until a future publish.

### From this directory (local)

1. `npm install` (see package.json).
2. `npm start` or `node src/index.js`

The process speaks MCP over **stdio**. Hosts spawn it; do not expect interactive terminal output.

| Env | Purpose |
|-----|-------|
| BRIEF_API_BASE | Override API base (default https://54ch10.uk) |
| BRIEF_API_KEY | Optional paid key. Empty — wrapper sends X-54ch10-Free: 1 |

Smoke: GET https://54ch10.uk/v1/brief/free?type=url&q=https://example.com

Optional: use the inspect script in package.json with the MCP Inspector.

## Tool: brief

| Arg | Type | Required | Description |
|-----|-----|--------|----------|
| type | address / token / url | yes | What to brief |
| q | string | yes | Address, token id/symbol, or URL _|

Returns the live JSON brief (score, band, flags, summary, sources, disclaimer, ‧).

## Auth / payments

1. **Free/demo** — leave BRIEF_API_KEY empty (wrapper uses X-54ch10-Free: 1, 20/UTC-day/IP).
2. **Stripe** — set BRIEF_API_KEY after Checkout claim.
3. **x402 (HTTP API)** — call https://54ch10.uk/v1/brief with USDC pay-per-brief ($0.01 Base/Solana). This stdio wrapper does not auto-pay; use x402 client libs against HTTP, or a Stripe key here.

Discovery: https://54ch10.uk/.well-known/x402

## Registry listing checklist

Local prep (this folder):

- [x] Live HTTPS tool target
- [x] package.json name 54ch10-mcp + mcpName = io.github.sachio222/54ch10-mcp
- [x] server.json matching mcpName (description ≥100 chars)
- [x] CONFIG.example.json + README (github: primary install)
- [x] Public GitHub repo https://github.com/sachio222/54ch10-mcp
- [ ] Public npmjs 54ch10-mcp@0.1.0 — not published yet
- [ ] Official MCP Registry — blocked until npmjs package exists (npm registryType = registry.npmjs.org only)
- [ ] After npmjs is public: mcp-publisher login github, then publish

Also: mcp.so / Smithery / awesome-mcp-servers PRs as sachio222 after the package is on npmjs.

**Do not** Discord/X auto-post.

## Disclaimer

Informational tooling only. Not financial, investment, legal, or tax advice. Full text: https://54ch10.uk/LEGAL_DISCLAIMQR.txt
