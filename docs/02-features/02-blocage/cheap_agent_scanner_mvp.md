# Cheap Agent Scanner / immune system (MVP)

Companion to the canvas tab **Scanner / immune** in the managed Cursor file
`~/.cursor/projects/Users-samuelmarinelli-dev-oneway/canvases/clarity-protection-plan.canvas.tsx`.

## Loop (plain language)

1. **Discovery** — hot leads only (linked PeerTube instances, shared adult ad networks, reports). Never untargeted Playwright crawl.
2. **Analyzer offline** — run Clarity `page-analyzer` scoring on HTML fixtures / snapshots (≈90% triage, no LLM).
3. **Cheap LLM on misses** — ~3 KB summary → engine / ad-network / signal family. Only doubtful pages.
4. **FP gate** — candidate rules must pass a safe corpus (Wiki, medical, non-adult PeerTube). One hard-negative FP → reject.
5. **Ship** — signed dynamic domain/ad list channel + code rules for structural fingerprints (`isNSFW`, `avx-*`, …).

## Cost note

- **Cheap:** local analyzer + LLM on short summaries.
- **Expensive (out of scope):** untargeted Playwright crawl of random URLs. We do not do that.

## Plan table (update statuses as work lands)

| Étape | Statut  | Livrable                                                         | Notes                                                                 |
|-------|---------|------------------------------------------------------------------|-----------------------------------------------------------------------|
| 1     | fait    | Offline runner = Clarity page-analyzer on HTML fixtures/snapshots | `pnpm --filter @clarity/extension eval:page-analyzer`                 |
| 2     | fait    | Safe-corpus gate (minimal)                                       | Wiki sexuality + PeerTube `isNSFW:false` smoke; hard-neg FP → exit 1  |
| 3     | fait    | Dynamic signed domain/ad list channel                            | See [signed_dynamic_adult_list_v1.md](./signed_dynamic_adult_list_v1.md) |
| 4     | à faire | Targeted discovery (PeerTube following + adult ad pivots) later  | Hot leads only                                                        |
| 5     | à faire | Cheap LLM judge on misses + review UI later                      | Not on every page                                                     |

## Commands

```bash
pnpm --filter @clarity/extension eval:page-analyzer
pnpm --filter @clarity/extension sign:adult-list:install
pnpm --filter @clarity/extension verify:adult-list
```

## Constraints

- Do not break UNLOCK / STRICT / extension protection.
- No `chrome.runtime.reload`.
- Focus: canvas tab + scanner MVP slices — not a 24/7 crawler or LLM UI yet.
