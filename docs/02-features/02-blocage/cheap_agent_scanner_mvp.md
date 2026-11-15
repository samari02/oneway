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

| Étape | Statut   | Livrable                                                         | Notes                                              |
|-------|----------|------------------------------------------------------------------|----------------------------------------------------|
| 1     | à faire  | Offline runner = Clarity page-analyzer on HTML fixtures/snapshots | pigav / globalinnovationdesign gold HTML           |
| 2     | à faire  | Safe-corpus gate (minimal)                                       | Smoke hard-negatives → 0 FP                        |
| 3     | à faire  | Dynamic signed domain/ad list channel (stub OK)                  | Feed extension without permanent rebuild           |
| 4     | à faire  | Targeted discovery (PeerTube following + adult ad pivots) later  | Hot leads only                                     |
| 5     | à faire  | Cheap LLM judge on misses + review UI later                      | Not on every page                                  |

## Constraints

- Do not break UNLOCK / STRICT / extension protection.
- No `chrome.runtime.reload`.
- Focus: canvas tab + scanner MVP slices — not a 24/7 crawler or LLM UI yet.
