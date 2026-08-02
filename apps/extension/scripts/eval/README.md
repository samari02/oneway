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
