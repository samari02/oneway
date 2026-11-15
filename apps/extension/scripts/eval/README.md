# Adult blocking offline eval

Scores the **current** adult blocking stack without a Chrome session:

1. Static DNR `requestDomains` + `regexFilter` from `public/rules.json`
2. System seed / sync list `public/adult-blocklist.json`
3. Hostname substring heuristics (same family as page-analyzer domain signals)

Does **not** run Focus Mode distraction rules or full HTML content analysis.

## Run

From repo root:

```bash
node apps/extension/scripts/eval/run-adult-blocking-eval.mjs
```

Or:

```bash
pnpm --filter @clarity/extension eval:adult-blocking
```

## Corpus

- Fixtures: [`fixtures/adult-blocking-corpus.json`](./fixtures/adult-blocking-corpus.json)
- Shape: `{ url, label: "block"|"allow", category, notes? }`
- Includes JP positives (FC2, missav mirrors, FANZA/DMM, live cams, doujin markets like xcolle/pcolle) and **hard negatives** (sex ed, medical, museums, lingerie e-commerce, anime news, Wikipedia sexuality, mainstream news, GitHub, Google, …).

Regenerate seed + corpus + merge new domains into DNR:

```bash
node apps/extension/scripts/lib/generate-adult-blocklist.mjs
```

## Interpreting output

- **Precision / Recall / F1** on block vs allow labels
- **Misses**: labeled `block` but not matched offline
- **False positives**: labeled `allow` but matched — hard-negative FPs fail the script (`exit 1`)
- `policy_sensitive_allow` (Fantia / ci-en / booth / Fanbox): domain-only stack should **allow**; content analysis may still block NSFW pages in-browser

## Page-analyzer offline (cheap-agent scanner MVP)

Runs the real `src/content/page-analyzer.ts` against local HTML fixtures (linkedom + esbuild bundle). Includes a minimal safe-corpus smoke gate (hard-negative FPs → exit 1).

```bash
pnpm --filter @clarity/extension eval:page-analyzer
```

- Corpus: [`fixtures/page-analyzer-corpus.json`](./fixtures/page-analyzer-corpus.json)
- HTML: [`fixtures/page-analyzer/`](./fixtures/page-analyzer/)
- Plan: [`docs/02-features/02-blocage/cheap_agent_scanner_mvp.md`](../../../../docs/02-features/02-blocage/cheap_agent_scanner_mvp.md)

## Targeted discovery (Étape 4)

PeerTube following/followers **fixtures** + adult ad/CDN HTML pivots. **No open-web crawl.** Review JSON/CSV only — never auto-sign.  
Live `--live` PeerTube HTTP is **optional/manual only** (not CI).

```bash
pnpm --filter @clarity/extension discover:adult-leads
pnpm --filter @clarity/extension discover:adult-leads -- --emit-sign-payload
```

- Seeds: [`../lib/discovery-seeds.json`](../lib/discovery-seeds.json)
- Fixtures: [`fixtures/discovery/`](./fixtures/discovery/)
- Output: `scripts/eval/out/discovery/` (gitignored) + `~/.clarity/discovery-candidates.json`

## Miss judge + review (Étape 5)

```bash
pnpm --filter @clarity/extension judge:misses          # offline heuristic (default)
# pnpm --filter @clarity/extension judge:misses -- --llm   # needs CLARITY_JUDGE_API_KEY
pnpm --filter @clarity/extension review:candidates -- --list
pnpm --filter @clarity/extension review:candidates -- --approve globalinnovationdesign.org
pnpm --filter @clarity/extension review:candidates -- --board
```

- Miss fixtures: [`fixtures/misses/`](./fixtures/misses/)
- Review UI: [`review/index.html`](./review/index.html) (serve via `review:candidates -- --serve`)
- Doc: [`cheap_llm_judge_review_v1.md`](../../../../docs/02-features/02-blocage/cheap_llm_judge_review_v1.md)

## Bounded collector (Étape 6)

Default = **real hostnames only** (skips `*.example`). Caps ~50–100 URLs/run.
Fixture CI = `--smoke` / `collect:adult-leads:smoke` (does **not** wire human review).
Optional `--playwright` / `--live` (manual only).

```bash
pnpm --filter @clarity/extension collect:adult-leads
pnpm --filter @clarity/extension collect:adult-leads -- --max 100
# CI fixtures (no review pollution):
pnpm --filter @clarity/extension collect:adult-leads:smoke
# optional: --playwright  (degrades if Playwright not installed)
pnpm --filter @clarity/extension review:candidates -- --list
# show *.example rows: review:candidates -- --list --include-fixtures
```

- Seeds: [`../lib/collector-seeds.json`](../lib/collector-seeds.json) (`searchSeeds` real; `smokeSearchSeeds` for `--smoke`)
- Fixtures: [`fixtures/collector/`](./fixtures/collector/) — `public-seed-sample.txt` is mostly placeholders for smoke
- Output: `scripts/eval/out/collector/` (gitignored) + wires real-only `discovery-report.json` by default
- Doc: [`targeted_collector_playwright_v1.md`](../../../../docs/02-features/02-blocage/targeted_collector_playwright_v1.md)

## Related

- Sync contract: [`docs/02-features/02-blocage/adult_blocklist_sync_v1.md`](../../../../docs/02-features/02-blocage/adult_blocklist_sync_v1.md)
- Self-improving loop: [`docs/02-features/02-blocage/self_improving_blocking_loop_v1.md`](../../../../docs/02-features/02-blocage/self_improving_blocking_loop_v1.md)
- Robustness smoke checks: `node apps/extension/scripts/test-blocking-robustness.mjs`

## Promote → eval gate

After observing candidates (or syncing via native host):

```bash
pnpm --filter @clarity/extension promote:adult-candidates
pnpm --filter @clarity/extension generate:adult-blocklist
pnpm --filter @clarity/extension eval:adult-blocking
```

Hard-negative FPs fail the eval (`exit 1`). Structural HTML fixtures live in `fixtures/structural-blocking-corpus.json`.

## Public NSFW lists (complement)

Additive import of oisd NSFW Small + StevenBlack porn-only (capped; never replaces JP curated seed):

```bash
pnpm --filter @clarity/extension import:public-adult-lists
# optional: --dry-run | --cap 1000
pnpm --filter @clarity/extension generate:adult-blocklist
pnpm --filter @clarity/extension eval:adult-blocking
```

Details + cap rationale: [`docs/02-features/02-blocage/public_adult_lists_import_v1.md`](../../../../docs/02-features/02-blocage/public_adult_lists_import_v1.md).
