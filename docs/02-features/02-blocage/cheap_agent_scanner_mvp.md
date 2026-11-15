# Cheap Agent Scanner / immune system (MVP)

Companion to the canvas tab **Scanner / immune** in the managed Cursor file
`~/.cursor/projects/Users-samuelmarinelli-dev-oneway/canvases/clarity-protection-plan.canvas.tsx`.

## Loop (plain language)

1. **Discovery** — hot leads only (linked PeerTube instances, shared adult ad networks, reports). Never untargeted Playwright crawl.
2. **Analyzer offline** — run Clarity `page-analyzer` scoring on HTML fixtures / snapshots (≈90% triage, no LLM).
3. **Cheap LLM on misses** — ~3 KB summary → engine / ad-network / signal family. Only doubtful pages (optional; offline heuristic default).
4. **FP gate** — candidate rules must pass a safe corpus (Wiki, medical, non-adult PeerTube). One hard-negative FP → reject.
5. **Ship** — human-approved signed dynamic domain/ad list + code rules for structural fingerprints.

## Cost note

- **Cheap:** local analyzer + optional LLM on short summaries.
- **Expensive (out of scope):** untargeted Playwright crawl of random URLs. We do not do that.

## Plan table

| Étape | Statut | Livrable | Notes |
|-------|--------|----------|-------|
| 1 | fait | Offline page-analyzer on fixtures | `eval:page-analyzer` |
| 2 | fait | Safe-corpus gate (minimal) | hard-neg FP → exit 1 |
| 3 | fait | Signed dynamic domain/ad list | [signed_dynamic_adult_list_v1.md](./signed_dynamic_adult_list_v1.md) |
| 4 | fait | Targeted discovery (fixtures) | [targeted_discovery_v1.md](./targeted_discovery_v1.md) |
| 5 | fait | Cheap judge on misses + review CLI/UI | [cheap_llm_judge_review_v1.md](./cheap_llm_judge_review_v1.md) |
| 6 | fait | Bounded collector (+ optional Playwright) | [targeted_collector_playwright_v1.md](./targeted_collector_playwright_v1.md) |
| 6b | fait | Search-engine atlas (ccTLD + AI) | [search_engine_atlas_v1.md](./search_engine_atlas_v1.md) — v2 hard-block sauf allowlist `google.com` + Gemini + ChatGPT; `yandex.by` DNR block |

## Commands

```bash
pnpm --filter @clarity/extension eval:page-analyzer
pnpm --filter @clarity/extension discover:adult-leads
pnpm --filter @clarity/extension collect:adult-leads
# CI fixtures only (does not pad review): collect:adult-leads:smoke
pnpm --filter @clarity/extension judge:misses
pnpm --filter @clarity/extension review:candidates -- --list
# *.example hidden by default; --include-fixtures to show
pnpm --filter @clarity/extension sign:adult-list:install
pnpm --filter @clarity/extension verify:adult-list
pnpm --filter @clarity/extension test:search-atlas
pnpm --filter @clarity/extension sync:search-atlas-dnr
```

## Constraints

- Do not break UNLOCK / STRICT / extension protection.
- No `chrome.runtime.reload`.
- LLM off unless `CLARITY_JUDGE_API_KEY` + `--llm`. Never commit secrets.
