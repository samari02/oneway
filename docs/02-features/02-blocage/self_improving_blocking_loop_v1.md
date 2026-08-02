# Self-improving adult blocking loop (v1)

Language-independent growth of adult coverage — **not** more keyword languages.

Related: [adult_blocklist_sync_v1.md](./adult_blocklist_sync_v1.md) (seed + `GET_CONFIG` sync).

## Loop (text diagram)

```
Observe (Layer 3 / structural block)
        ↓
Candidate (chrome.storage.local.adultBlockCandidates)
        ↓  native ADULT_CANDIDATE (if desktop connected)
~/.clarity/adult-blocklist-candidates.json
        ↓
Promote (promote:adult-candidates — hits/score gate, skip dual-use)
        ↓  additive only; empty never wipes
promoted-adult-domains.json ∪ public/adult-blocklist.json
        ↓
generate:adult-blocklist  →  rules.json + seed + corpus refresh
        ↓
eval:adult-blocking  →  FAIL on hard-negative FPs
        ↓
Deploy (extension build / reload; optional copy seed → ~/.clarity)
        ↓
Structural signals use grown blocklist (self-reinforcing link graph)
```

## Pillars

| # | Pillar | v1 status |
|---|--------|-----------|
| 1 | Structural signals (adult links ≥K, ad networks, age-gate/RTA) | In `page-analyzer.ts` |
| 2 | Syncable list that can grow | Seed + `~/.clarity` + candidates file |
| 3 | Eval as the gate | `eval:adult-blocking` (+ structural HTML corpus) |
| 4 | Friction / DNS (S3) | Hosts v1 + disable-friction v1 (cooldown + DISABLE) |
| 5 | Keyword languages capped EN/FR/JP (+ light CN) | CN light set only |

## A. Observe → candidates

On **content-analysis / structural** blocks (not static DNR alone), the service worker records the registrable domain via `recordAdultBlockCandidate`:

- Storage: `chrome.storage.local.adultBlockCandidates` (cap 200)
- Fields: domain, hits, timestamps, maxScore, reasons, source
- **Never** records policy-sensitive dual-use hosts (Fantia, booth, ci-en, Fanbox, Patreon, …)
- If native host connected: `ADULT_CANDIDATE` → `~/.clarity/adult-blocklist-candidates.json`

## B. Promote safely

```bash
pnpm --filter @clarity/extension promote:adult-candidates
# optional: --dry-run | --candidates <path> | --use-sample | --min-hits 2 | --min-score 70
```

Eligible: `hits >= 2` **or** `maxScore >= 70`. Additive merge into:

1. `apps/extension/scripts/lib/promoted-adult-domains.json` (durable; generate unions this)
2. `apps/extension/public/adult-blocklist.json` domains

Then **required**:

```bash
pnpm --filter @clarity/extension generate:adult-blocklist
pnpm --filter @clarity/extension eval:adult-blocking
```

Do not ship if hard-negative FPs appear.

## C. Self-reinforcing structural signals

Page analysis loads `adultBlocklistDomains` from storage and counts outbound links against **bundled known set ∪ synced blocklist**.

- ≥**3** distinct adult/blocklist domains linked → strong score (75)
- Adult ad-network hosts in script/iframe/img/a
- Age-gate / RTA / rating=adult meta (existing)

Those blocks also create candidates (A).

## D. Eval gate

- Domain layer: DNR + seed + hostname heuristics (`adult-blocking-corpus.json`)
- Structural layer: HTML snippets (`structural-blocking-corpus.json`)
- Exit `1` on `hard_negative*` false positives

## E. Light CN keywords

Small high-signal Chinese terms in `page-analyzer` EXPLICIT_KEYWORDS (CJK substring path). No expansion into more languages.

## F. Friction / DNS (S3)

**DNS / hosts v1 (shipped, macOS):** managed `/etc/hosts` section from
`~/.clarity/adult-blocklist.json`. See [`hosts_adult_blocking_v1.md`](./hosts_adult_blocking_v1.md).
Additive to the extension; DoH caveat applies.

**Disable friction v1 (shipped):** cooldown (15/30/60s, default 30) + type `DISABLE`
before turning off hosts or pausing extension protection. See
[`disable_friction_v1.md`](./disable_friction_v1.md).

**Still later:** password vault / friend unlock; Windows/Linux; local DNS proxy.
Not a substitute for a healthy Observe → promote → eval loop.

## Maintainer / reload

```bash
pnpm --filter @clarity/extension promote:adult-candidates   # when candidates exist
pnpm --filter @clarity/extension generate:adult-blocklist
pnpm --filter @clarity/extension eval:adult-blocking
pnpm --filter @clarity/extension build
# Chrome → chrome://extensions → Reload Clarity
# Optional: pnpm --filter @clarity/extension install:adult-blocklist
```

## LIVE status (desktop native host)

Wired in practice:

1. `GET_CONFIG` → `CONFIG_UPDATE.adultDomains` from `~/.clarity/adult-blocklist.json`
2. `ADULT_CANDIDATE` → upsert into `~/.clarity/adult-blocklist-candidates.json` (capped)
3. `write_adult_blocklist_to_disk` Tauri command (refuses empty overwrite of non-empty)
4. Seed helper: `pnpm --filter @clarity/extension install:adult-blocklist` (if-missing)

## Files

| Path | Role |
|------|------|
| `src/background/adult-candidates.ts` | Observe / storage |
| `src/background/adult-blocklist.ts` | Seed + remote merge |
| `src/content/page-analyzer.ts` | Structural + keywords |
| `scripts/lib/promote-adult-candidates.mjs` | Promote |
| `scripts/lib/promoted-adult-domains.json` | Durable promotions |
| `scripts/lib/generate-adult-blocklist.mjs` | Seed + DNR + corpus |
| `scripts/lib/install-adult-blocklist-to-clarity-dir.mjs` | Seed `~/.clarity` if missing |
| `scripts/eval/run-adult-blocking-eval.mjs` | Gate |
| `desktop …/adult_blocklist_file.rs` | Native GET_CONFIG domains |
| `desktop …/adult_candidates_file.rs` | Native candidate disk |
