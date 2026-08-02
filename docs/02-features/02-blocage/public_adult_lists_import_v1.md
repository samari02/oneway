# Public adult lists import (complement)

Additive import of community **NSFW-tagged** host lists into Clarity’s adult seed pipeline. Public lists are a **second source** — they never replace the JP-heavy curated expansion in `generate-adult-blocklist.mjs`.

Related: [adult_blocklist_sync_v1.md](./adult_blocklist_sync_v1.md), [self_improving_blocking_loop_v1.md](./self_improving_blocking_loop_v1.md).

## Sources

| Source | URL | Why |
|--------|-----|-----|
| oisd NSFW Small | `domainswild2_nsfw_small.txt` (GitHub mirror of oisd) | Adult-tagged; Tranco ∩ NSFW → higher-traffic, smaller |
| StevenBlack porn-only | `alternates/porn-only/hosts` | Adult-tagged hosts alternate (not the full unified ad list) |

Full oisd NSFW (~500k) is intentionally **not** ingested raw.

## Cap (DNR / extension size)

Default **`--cap 1500`** new complement domains written to:

`apps/extension/scripts/lib/imported-public-adult-domains.json`

Each domain can become up to **2** static DNR rules at generate time. Cap keeps growth bounded under Chromium static-rule budgets (~30k). Prefer:

1. Domains in **both** sources  
2. Hostnames matching adult tokens (`porn`, `xxx`, `jav`, …)  
3. Shorter / apex-ish labels  

Override: `--cap 800` (or lower) if eval hard-negative FPs appear or package size is a concern.

## Skips

- Policy-sensitive dual-use: Fantia, ci-en, booth, Fanbox, Patreon, Pixiv, major social, etc.
- Domains already in the curated seed
- Offline eval **allow** hosts (hard negatives) when the corpus is present
- Lightweight noise heuristics (CDN/tracking-looking labels, invalid hosts)

## Maintainer commands

```bash
# Fetch + rank + write capped complement sidecar
pnpm --filter @clarity/extension import:public-adult-lists
# optional: --dry-run | --cap 1000

# Union into adult-blocklist.json + rules.json + refresh corpus
pnpm --filter @clarity/extension generate:adult-blocklist

# Gate — abort ship on hard-negative FPs
pnpm --filter @clarity/extension eval:adult-blocking
```

Empty `imported-public-adult-domains.json` / missing file **never wipes** curated domains.

## Pipeline position

```
curated EXPANSION_DOMAINS (JP-heavy)
        ∪
promoted-adult-domains.json (observe→learn)
        ∪
imported-public-adult-domains.json  ← this step (public NSFW complement)
        ↓
generate:adult-blocklist → public/adult-blocklist.json + rules.json
        ↓
eval:adult-blocking
```
