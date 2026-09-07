# 54ch10 MCP — wrap before you click

**Job:** pre-interact URL risk brief for agents (`page_risk`, whois/dns/tls, SSRF-safe fetch). **Analytics-only** — not financial, legal, or investment advice. Not clearance.

```bash
npx -y github:sachio222/54ch10-mcp
```

- Standing order: https://54ch10.uk/wire.md
- Install map: https://54ch10.uk/docs/install-map
- Bulk UI: https://linksafu.com/bulk
- Smithery: https://smithery.ai/servers/brainpowerux/54ch10-mcp

Primary URL check: **`url.open`** → `GET /v1/open?q=` (score 0–100, **lower is better**). Paid via stack (`X-54ch10-Stack`, $1→80) or Bearer `54k_`. Free taste: empty `BRIEF_API_KEY` / `X-54ch10-Free` / `/v1/open/free`. Batch: **`url.open_batch`** → `POST /v1/open/batch` (paid-only, cap 25).

---

Thin Model Context Protocol wrapper around the **54ch10** live HTTPS API.

- Live API base: https://54ch10.uk
- URL open (primary): https://54ch10.uk/v1/open?q=...
- Address/token brief (still): https://54ch10.uk/v1/brief?type=address|token&q=...
- Toolkit: `/v1/whois`, `/v1/dns`, `/v1/tls`, `/v1/normalize-url`, hash, encode, fetch, paste
- Batch: `POST /v1/open/batch` `{"urls":[...]}` — paid-only, cap 25
- Stack: `GET|POST /v1/stack` — $1 → 80 credits, header `X-54ch10-Stack`
- Free/demo: header `X-54ch10-Free: 1` or `/v1/<tool>/free` siblings
- OpenAPI: https://54ch10.uk/openapi.json
- x402 discovery: https://54ch10.uk/.well-known/x402
- Brand: **54ch10**
- **Analytics-only** — informational heuristics, not financial, legal, or investment advice. Not clearance.

MCP tools (prefer dots): **url.open**, **url.open_batch**, **url.fetch**, **url.normalize**, **domain.whois**, **domain.dns**, **domain.tls**, **util.hash**, **util.encode**, **paste.write**, **paste.read**. Legacy flat aliases (`brief`, `whois`, …) still work.

| Field | Value |
|-------|-------|
| package name | `54ch10-mcp` |
| version | `0.3.3` |
| MCP registry name (`mcpName`) | `io.github.sachio222/54ch10-mcp` |
| Manifest | `server.json` / `manifest.json` |
| Primary install (today) | `npx -y github:sachio222/54ch10-mcp` |

## Jobs (HTTP to MCP)

Standing order: https://54ch10.uk/wire.md
Install map: https://54ch10.uk/docs/install-map
Bulk UI: https://linksafu.com/bulk

| Job | HTTP | MCP |
|---|---|---|
| Open URL | GET /v1/open?q= | url.open type=url |
| Address/token brief | GET /v1/brief | url.open type=address|token |
| Bulk open paid cap 25 | POST /v1/open/batch | url.open_batch |
| Stack 1 USD to 80 | GET or POST /v1/stack | BRIEF_API_KEY=stack id |
| Fetch markdown | GET /v1/fetch | url.fetch |
| Domain pack | whois+dns+tls | domain.* |


## Install / run

Requires Node.js 18+.

### Primary

```bash
npx -y github:sachio222/54ch10-mcp
```

See CONFIG.example.json for host config.

| Env | Purpose |
|-----|-------|
| BRIEF_API_BASE | API base override |
| BRIEF_API_KEY | stack id OR 54k key OR empty free |
| BRIEF_STACK_ID | optional stack id alias |

Smoke: https://54ch10.uk/v1/open/free?q=https://example.com

## Tools

| MCP tool | HTTP |
|---|---|
| url.open type=url | GET /v1/open?q= |
| url.open type=address|token | GET /v1/brief |
| url.open_batch | POST /v1/open/batch |
| url.fetch | GET /v1/fetch |
| url.normalize | GET /v1/normalize-url |
| domain.whois / dns / tls | GET /v1/whois|dns|tls |
| util.hash / util.encode | GET /v1/hash|encode |
| paste.write / paste.read | POST/GET /v1/paste |

Prompts: wrap_before_click, domain_hygiene, free_taste_demo.

url.open score 0-100 lower is better. HTTP 402 unpaid: use stack or 54k Bearer.

url.open_batch: paid-only, cap 25, concurrency ~3, inflight ~10. Bulk UI: https://linksafu.com/bulk

## Auth / payments

1. Free: empty BRIEF_API_KEY -> X-54ch10-Free
2. Stack: GET|POST /v1/stack ($1 -> 80). Put stack id in BRIEF_API_KEY -> X-54ch10-Stack
3. Bearer: BRIEF_API_KEY starting with 54k_ -> Authorization Bearer
4. x402 on HTTP API (stdio wrapper does not auto-pay)

Indicative: open 0.015, batch Nx0.015, fetch 0.005. Discovery: https://54ch10.uk/.well-known/x402

## Registry listing checklist

- [x] Live HTTPS; url.open -> /v1/open; open_batch; stack auth
- [x] package.json mcpName io.github.sachio222/54ch10-mcp
- [x] Public GitHub https://github.com/sachio222/54ch10-mcp
- [ ] Public npmjs / official MCP Registry (blocked until npmjs)

Do not Discord/X auto-post.

## Disclaimer

Informational tooling only. Not financial, investment, legal, or tax advice. Full text: https://54ch10.uk/LEGAL_DISCLAIMER.txt
