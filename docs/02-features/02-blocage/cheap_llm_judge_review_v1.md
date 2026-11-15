# Cheap LLM judge + review (v1) — Étape 5

Close the immune-system loop for **analyzer misses** without an open crawler.

Related: [cheap_agent_scanner_mvp.md](./cheap_agent_scanner_mvp.md), [targeted_discovery_v1.md](./targeted_discovery_v1.md), [signed_dynamic_adult_list_v1.md](./signed_dynamic_adult_list_v1.md).

## What shipped

1. **`judge:misses`** — compress miss HTML to ~3.5 KB snapshot  
   - **Default:** offline heuristic (no network)  
   - **Optional LLM:** `--llm` + `CLARITY_JUDGE_API_KEY` (never commit the key)
2. **`review:candidates`** — CLI approve/reject over discovery JSON (+ optional judge hints)  
   - Writes `approved-sign-payload.json` (unsigned)  
   - Minimal HTML board (`scripts/eval/review/`) via `--board` / `--serve` on `127.0.0.1`
3. **Safe defaults** — LLM off without key; no auto-prod; FP gate still required before `sign:adult-list`

## Run without LLM (supported / CI)

```bash
pnpm --filter @clarity/extension discover:adult-leads
pnpm --filter @clarity/extension judge:misses
pnpm --filter @clarity/extension review:candidates -- --list
pnpm --filter @clarity/extension review:candidates -- --approve globalinnovationdesign.org,pigav.com
pnpm --filter @clarity/extension review:candidates -- --board
# optional local UI:
# pnpm --filter @clarity/extension review:candidates -- --serve
```

Then (after FP evals):

```bash
pnpm --filter @clarity/extension eval:page-analyzer
pnpm --filter @clarity/extension eval:adult-blocking
pnpm --filter @clarity/extension sign:adult-list -- --sign --in apps/extension/scripts/eval/out/review/approved-sign-payload.json
```

## Run with LLM (optional)

```bash
export CLARITY_JUDGE_API_KEY='…'          # never commit
# optional:
# export CLARITY_JUDGE_BASE_URL='https://api.openai.com/v1'
# export CLARITY_JUDGE_MODEL='gpt-4o-mini'
pnpm --filter @clarity/extension judge:misses -- --llm
```

If the key is missing or the call fails, the tool falls back to the offline heuristic.

## Outputs

| Path | Role |
|------|------|
| `scripts/eval/out/review/judge-results.json` | Judge labels / hints |
| `scripts/eval/out/review/review-state.json` | Approved / rejected domains |
| `scripts/eval/out/review/approved-sign-payload.json` | Unsigned payload for Étape 3 signer |
| `scripts/eval/review/review-board.json` | Data for minimal HTML UI |

## MVP loop status

Étapes **1–6** form a coherent offline loop: fixtures analyzer → safe corpus → signed list channel → targeted discovery → miss judge + human review → **bounded collector** → (manual) sign. Live network discovery/LLM/Playwright remain optional.

See [targeted_collector_playwright_v1.md](./targeted_collector_playwright_v1.md) for Étape 6.
