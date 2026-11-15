# Search-engine atlas v2 (hard-block + allowlist)

Cheap inventory for Clarity. **Not** an open web crawler.

## Policy (v2)

**Hard-block** every atlas search host **except** an explicit allowlist. Navigating to yandex.by, bing, duckduckgo, perplexity, etc. shows the Clarity block screen (DNR `requestDomains`), same path as adult domains.

### Allowlist (Layer 2 + navigation allowed)

| Host | Behavior |
|------|----------|
| `google.com` / `www.google.com` | SafeSearch DNR (`safe=active`) + Layer 2 query intelligence |
| `gemini.google.com` / `bard.google.com` | Allowed (Gemini); Layer 2 on URL-visible queries |
| `chatgpt.com` / `chat.openai.com` | Allowed (ChatGPT); Layer 2 on URL-patternable search surfaces |

### Hard-blocked (examples)

yandex.* (incl. **yandex.by**), bing, duckduckgo, yahoo, ecosia, qwant, brave, startpage, baidu, naver, regional UA engines, perplexity, you.com, phind, komo, andi, copilot, **google.ccTLDs** (`google.fr`, `google.co.jp`, …).

> Tradeoff (intentional): user asked for **sauf google.com** — country Google TLDs are blocked; use `google.com`.

## Design

| Path | What |
|------|------|
| **DNR hard-block** | Atlas hosts ∉ allowlist → `rules.json` id 22000–22999 (`requestDomains` → block-screen) |
| **SafeSearch DNR** | **google.com only** (id &lt; 1000) |
| **Layer 2 filter** | Allowlisted hosts only (`search-filter.ts`) |
| **Adult blocklist** | Unchanged — separate from search hard-block band |

## Source of truth

- `apps/extension/src/shared/data/search-engine-atlas.json` — curated seed + `policy.allowlistHosts`
- `apps/extension/src/shared/search-engine-atlas.ts` — match / allowlist helpers
- Expand (bounded ccTLDs): `pnpm --filter @clarity/extension expand:search-atlas`
- Sync DNR: `pnpm --filter @clarity/extension sync:search-atlas-dnr`
- Tests: `pnpm --filter @clarity/extension test:search-atlas`

## Optional future

`--ct-stub` on the expand script documents a NRD/CT watch for new `yandex.*` — not implemented.
