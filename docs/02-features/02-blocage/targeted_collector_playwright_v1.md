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
   (**mostly `*.example` placeholders for `--smoke`**). Default collect skips those
   and reports honestly if there are **0 real candidates**. Override with
   `--public-seed PATH` for a real hostname list.
2. **1-hop partner / outbound links** from gold HTML  
   (`partner-outbound-gold.html` + non-safe page-analyzer HTML). Fixture hosts skipped unless `--smoke`.
3. **Curated search query → URL list** (`collector-seeds.json`)  
   Real URLs in `searchSeeds`; fixture URLs in `smokeSearchSeeds` (`--smoke` only).  
   `--search-live` is stubbed (captcha-heavy) and **not** CI.
4. **PeerTube following** — offline fixture graph is smoke-only; `--live` for real hosts (manual).
5. **Snapshots 2–4 KB** — offline HTML preferred; optional `--playwright` (~5 s hydrate).  
   If Playwright is not installed → graceful degrade + console note.
6. **Review wire** — default writes **real-only** discovery JSON into
   `discovery-report.json` + `~/.clarity/discovery-candidates.json`.  
   `--smoke` does **not** wire the human review queue.

## Run (human review = real-only default)

```bash
# Real hostnames only (skips *.example). May honestly print 0 pending real candidates
# when the default seed is mostly placeholders — pass --public-seed or --live for new leads.
pnpm --filter @clarity/extension collect:adult-leads
pnpm --filter @clarity/extension collect:adult-leads -- --max 100
# pnpm --filter @clarity/extension collect:adult-leads -- --public-seed /path/to/real-hosts.txt

# Then existing loop:
pnpm --filter @clarity/extension judge:misses
pnpm --filter @clarity/extension review:candidates -- --list
# Fixtures hidden by default; show with --include-fixtures
```

## CI / fixture smoke (does not pollute review)

```bash
pnpm --filter @clarity/extension collect:adult-leads:smoke
# equivalent: collect:adult-leads -- --smoke
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
- Default path never pads review with `*.example` / `collector-batch-N.example`
- Skip fragile long live network smokes (use `--smoke` fixtures)
- Playwright is **optional** — never a hard dependency of `@clarity/extension`

## Caps / sources (defaults)

| Source | Cap / bound |
|--------|-------------|
| Total hosts/URLs | `--max` default **80** (tune 50–100) |
| PeerTube following hosts | `--max-probe` default **5** |
| Snapshot size | ≤ **3500** chars |
| Playwright | ~**5 s** timeout, `--playwright` only |
