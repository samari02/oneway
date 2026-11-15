# Search-engine atlas (ccTLD + AI) v3

Cheap inventory for Clarity Layer 2 (allowlist only) + **DNR hard-block** of every other search host. **Not** an open web crawler.

## Why

Users could block `yandex.com` / get Layer 2 on `.com`/`.ru` while **`yandex.by`** (and other regional/ccTLD engines) stayed a backdoor to adult SERPs. Same class of miss: Ukrainian portals, Yahoo locals, AI search, privacy meta-search.

## Policy (v2+)

| Host class | Behavior |
|------------|----------|
| **Allowlist** | `google.com` / `www.google.com`, `gemini.google.com` / `bard.google.com`, `chatgpt.com` / `chat.openai.com` |
| **SafeSearch DNR** | google.com SERP only (`safe=active`) |
| **Layer 2 filter-SERP** | Allowlisted hosts only |
| **Everyone else in atlas** | DNR hard-block → Clarity block screen (rule ids `22000–22999`) |

`google.fr` / `google.co.jp` / etc. are **intentionally hard-blocked** (tradeoff: use google.com).

Do **not** hard-block CDN/static hosts needed by allowlisted apps (e.g. ChatGPT / Gemini assets).

## Methodology

1. **Curated seed** in `search-engine-atlas.json` — hand-maintained brand inventory by category (global, Yandex ccTLDs, RU/UA/CIS/EE, Asia, LatAm/EU/ME, AI search, meta/privacy). No Playwright / open-web crawl.
2. **Bounded ccTLD expansion** — engines with `expandCctlds: true` + `hostPrefix` get `brand.<tld>` for each entry in `commonCctlds` via `expand-search-engine-atlas.mjs` (deduped).
3. **DNR sync** — same script with `--sync-dnr` regenerates SafeSearch (id &lt; 1000) + search hard-blocks (22000–22999) in `public/rules.json`.
4. **Optional CT stub** — `--ct-stub` documents a future NRD/CT watch for new `yandex.*` hosts; **not implemented**.

## Source of truth

- `apps/extension/src/shared/data/search-engine-atlas.json` — curated + expanded hosts
- `apps/extension/src/shared/search-engine-atlas.ts` — match / allowlist helpers
- Expand: `pnpm --filter @clarity/extension expand:search-atlas -- --write`
- Sync DNR: `pnpm --filter @clarity/extension sync:search-atlas-dnr`
- Combined: `node apps/extension/scripts/lib/expand-search-engine-atlas.mjs --write --sync-dnr`
- Tests: `pnpm --filter @clarity/extension test:search-atlas`

## Categories covered

- **Global** — Bing, Yahoo, DuckDuckGo (+ lite/html), Ecosia, Startpage, Brave Search, Qwant, Swisscows, Mojeek, Yep, …
- **Yandex** — all common ccTLDs + `ya.ru` / Dzen
- **RU/UA/CIS/EE** — Mail.ru search, Rambler, Ukr.net, Meta.ua, Seznam, WP/Onet search, …
- **Asia** — Baidu, Sogou, 360, Naver, Daum, Yahoo Japan, Coc Coc, Goo, …
- **LatAm/EU/ME** — Terra, UOL, SAPO, Orange/Voila, Fireball, …
- **AI search** — Perplexity, Phind, You.com, Andi, Komo, Copilot/Bing AI, Arc/Dia, Exa, … (**not** ChatGPT / Gemini)
- **Meta / privacy** — Searx/SearXNG public instances, Whoogle publics, MetaGer, Kagi, Gibiru, …

## Regression gate

`yandex.by` (homepage and `/search`) must appear in hard-block DNR `requestDomains`, **not** SafeSearch `family=yes`.
