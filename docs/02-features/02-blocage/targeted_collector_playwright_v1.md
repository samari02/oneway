# Targeted collector + optional Playwright (v1) — Étape 6

FR / EN — bounded, **manual-first** collector that feeds the immune loop
(eval → judge → review → signed list). **Not** an open-web crawl 24/7.

Related: [cheap_agent_scanner_mvp.md](./cheap_agent_scanner_mvp.md),
[targeted_discovery_v1.md](./targeted_discovery_v1.md),
[cheap_llm_judge_review_v1.md](./cheap_llm_judge_review_v1.md).

## FR — Quoi / pourquoi

Collector ciblé qui ramène **des hôtes suspects variés** (cap ~50–100 / run)
dans la boucle déjà livrée. Priorité offline (fixtures). Playwright et live
réseau = flags manuels optionnels, jamais requis pour CI.

## What it does

1. **Diff public seeds vs Clarity blocklist** — new hostnames only  
   Default seed file: `scripts/eval/fixtures/collector/public-seed-sample.txt`  
   Override with `--public-seed` (e.g. a larger offline export).
2. **1-hop partner / outbound links** from gold HTML fixtures  
   (`partner-outbound-gold.html` + non-safe page-analyzer HTML).
3. **Curated search query → URL list** (`collector-seeds.json`)  
   Offline-first. `--search-live` is stubbed (captcha-heavy) and **not** CI.
4. **PeerTube following** — fixtures by default; `--live` manual only (short timeouts).
5. **Snapshots 2–4 KB** — offline HTML preferred; optional `--playwright` (~5 s hydrate).  
   If Playwright is not installed → graceful degrade + console note.
6. **Review wire** — writes discovery-compatible JSON/CSV and (by default) copies into
   `discovery-report.json` + `~/.clarity/discovery-candidates.json` for `review:candidates`.

## Run (supported / CI = offline)

```bash
# ~50–100 hosts (default --max 80)
pnpm --filter @clarity/extension collect:adult-leads
pnpm --filter @clarity/extension collect:adult-leads -- --max 100

# Then existing loop:
pnpm --filter @clarity/extension judge:misses
pnpm --filter @clarity/extension review:candidates -- --list
# or explicit:
# pnpm --filter @clarity/extension review:candidates -- --from apps/extension/scripts/eval/out/collector/collector-report.json
```

## Optional flags (manual only)

```bash
# Playwright hydrate when no offline HTML (~5s / URL)
# Requires: pnpm add -D playwright && npx playwright install chromium
pnpm --filter @clarity/extension collect:adult-leads -- --playwright --max 50

# PeerTube following live (short timeout; not CI)
# pnpm --filter @clarity/extension collect:adult-leads -- --live --max-probe 5

# Do not overwrite discovery-report / ~/.clarity
pnpm --filter @clarity/extension collect:adult-leads -- --no-wire-review
```

## Outputs

| Path | Role |
|------|------|
| `scripts/eval/out/collector/collector-report.json` | Discovery-compatible report |
| `scripts/eval/out/collector/collector-candidates.csv` | Spreadsheet review |
| `scripts/eval/out/collector/snapshots/*.html` | 2–4 KB snapshots for judge |
| `scripts/eval/out/discovery/discovery-report.json` | Wired for `review:candidates` (unless `--no-wire-review`) |

## Constraints

- No auto-prod, no auto-sign, no secrets committed
- Do not break UNLOCK / STRICT / extension runtime
- Skip fragile long live network smokes (use fixtures)
- Playwright is **optional** — never a hard dependency of `@clarity/extension`

## Caps / sources (defaults)

| Source | Cap / bound |
|--------|-------------|
| Total hosts/URLs | `--max` default **80** (tune 50–100) |
| PeerTube following hosts | `--max-probe` default **5** |
| Snapshot size | ≤ **3500** chars |
| Playwright | ~**5 s** timeout, `--playwright` only |
