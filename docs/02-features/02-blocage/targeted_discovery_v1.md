# Targeted discovery (v1) — Étape 4

Hot-lead discovery for the cheap-agent scanner. **No open-web / Playwright crawl.**

Related: [cheap_agent_scanner_mvp.md](./cheap_agent_scanner_mvp.md), [signed_dynamic_adult_list_v1.md](./signed_dynamic_adult_list_v1.md).

## Supported path = fixtures only

Default / CI / smoke uses **offline fixtures** (PeerTube graph JSON + HTML ad/CDN pivots).  
This avoids Cloudflare blocks, long follower graphs, and aborted live jobs (SIGTERM).

## What it does

1. **PeerTube graph (fixtures)** — `following` / `followers` / `config` under `scripts/eval/fixtures/discovery/`
2. **Ad/CDN pivots** — scan known HTML for fingerprints already in `page-analyzer` (`magsrv`, ExoClick family, porn CDNs)
3. **Review outputs** — JSON + CSV; optional unsigned sign-payload (**not** auto-prod)

## Live API (optional / manual only)

`--live` can call `/api/v1/server/following` etc. against a seed host.  
**Not** part of automation or default smoke. Use only when you intentionally want a manual fetch (and prefer `--max-probe 5`). Pigav and many adult instances are Cloudflare-gated from datacenter IPs.

## Safe gates

- Safe / demo hosts → `deny_safe_corpus` / `deny_peertube_sfw`
- `*.example` fixture placeholders → never emitted into sign payload domains
- No signing/promote without human review + `eval:page-analyzer` / `eval:adult-blocking`

## Run

```bash
# Default offline smoke (supported)
pnpm --filter @clarity/extension discover:adult-leads
pnpm --filter @clarity/extension discover:adult-leads -- --emit-sign-payload

# After review, sign manually (Étape 3):
pnpm --filter @clarity/extension sign:adult-list -- --sign --in apps/extension/scripts/eval/out/discovery/sign-payload.candidates.json

# Manual live only (optional — not CI):
# pnpm --filter @clarity/extension discover:adult-leads -- --live --seeds peertube.cpy.re --max-probe 5
```

Outputs:

| Path | Role |
|------|------|
| `scripts/eval/out/discovery/discovery-report.json` | Full report (gitignored) |
| `scripts/eval/out/discovery/discovery-candidates.csv` | Spreadsheet review |
| `~/.clarity/discovery-candidates.json` | Local copy for desktop/native workflows |

## Later steps

- **Étape 5** — [cheap_llm_judge_review_v1.md](./cheap_llm_judge_review_v1.md) (shipped)
- **Étape 6** — [targeted_collector_playwright_v1.md](./targeted_collector_playwright_v1.md) (bounded collector + optional Playwright)
