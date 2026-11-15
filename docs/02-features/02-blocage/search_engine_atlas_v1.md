# Search-engine atlas (ccTLD + AI) v1

Cheap inventory for Clarity Layer 2 + SafeSearch DNR. **Not** an open web crawler.

## Why

Users could block `yandex.com` / get Layer 2 on `.com`/`.ru` while **`yandex.by`** (and other regional/ccTLD engines) stayed a backdoor to adult SERPs. Same class of miss: Ukrainian portals, Yahoo locals, AI search.

## Design

| Path | What |
|------|------|
| **Layer 2 filter-SERP** | `search-filter.ts` uses atlas host match + query params → same intelligence as `yandex.com` |
| **SafeSearch DNR** | Engines with known params (`family=yes`, `kp=1`, …) → `rules.json` id &lt; 1000 |
| **Hard adult block** | Still adult-blocklist / DNR `requestDomains` — **search engines are not hard-blocked** |
| **Google** | `mode: google-special` — existing SafeSearch + Layer 2 preserved |

AI search (Perplexity, You.com, Phind, …): **filter-only** (no reliable SafeSearch param). In-chat prompts (ChatGPT) are not visible to `webNavigation` — URL-patternable surfaces only.

## Source of truth

- `apps/extension/src/shared/data/search-engine-atlas.json` — curated seed (~128 hosts, 27 engines)
- `apps/extension/src/shared/search-engine-atlas.ts` — match helpers
- Expand (bounded ccTLDs, no Playwright): `pnpm --filter @clarity/extension expand:search-atlas`
- Sync DNR: `pnpm --filter @clarity/extension sync:search-atlas-dnr`
- Tests: `pnpm --filter @clarity/extension test:search-atlas`

## Optional future

`--ct-stub` on the expand script documents a NRD/CT watch for new `yandex.*` — not implemented.
