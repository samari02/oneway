# Search-engine atlas

Source of truth: `search-engine-atlas.json`.

## How the list is made

1. **Hand-curated** brand inventory by category (global, Yandex, RU/UA/CIS/EE, Asia, LatAm/EU/ME, AI search, meta/privacy). No open-web crawler.
2. **Bounded ccTLD expansion** via `scripts/lib/expand-search-engine-atlas.mjs`: engines with `expandCctlds` + `hostPrefix` get `brand.<tld>` for each `commonCctlds` entry (deduped).
3. **DNR sync** (`--sync-dnr`): SafeSearch only for allowlisted `google.com`; every other atlas host → hard-block rules `22000–22999`.
4. **CT/NRD watch**: `--ct-stub` only — not implemented.

## Allowlist (everything else blocked)

- `google.com` / `www.google.com`
- `gemini.google.com` / `bard.google.com`
- `chatgpt.com` / `chat.openai.com`

## Commands

```bash
pnpm --filter @clarity/extension expand:search-atlas -- --write --sync-dnr
pnpm --filter @clarity/extension test:search-atlas
```

See also: `docs/02-features/02-blocage/search_engine_atlas_v1.md`.
