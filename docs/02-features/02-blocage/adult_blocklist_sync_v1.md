# Adult blocklist sync (v1)

System adult domains are no longer “hardcoded only”. v1 keeps **static DNR** as the always-on network layer and adds a **syncable domain list** that the extension merges additively into `shouldBlock`.

## Sources of truth

| Layer | Location | Role |
|-------|----------|------|
| Static DNR | `apps/extension/public/rules.json` | Packaged `declarativeNetRequest` rules (exact domains + mirror regexes) |
| System seed | `apps/extension/public/adult-blocklist.json` | Canonical JSON list shipped with the extension; merged into DNR at generate time |
| Desktop disk | `~/.clarity/adult-blocklist.json` | Optional remote/updated list the native host serves on `GET_CONFIG` |
| Extension storage | `chrome.storage.local.adultBlocklistDomains` | Bundled seed ∪ synced domains (additive) |

## Sync flow

```
Maintainer / future CDN / desktop invoke('write_adult_blocklist_to_disk')
        ↓
~/.clarity/adult-blocklist.json
        ↓
Native host GET_CONFIG → CONFIG_UPDATE { adultDomains: [...] }
        ↓
Extension mergeRemoteAdultDomains (additive; empty = no-op)
        ↓
chrome.storage.local.adultBlocklistDomains
        ↓
service-worker shouldBlock() domain match
(+ static rules.json DNR still applies independently)
```

## Additive merge contract

1. **Bundled seed** loads on install/startup from packaged `adult-blocklist.json`.
2. **Remote/synced** domains from desktop are **unioned** into storage.
3. If `adultDomains` is **missing or empty**, the extension **does not clear** existing domains (never wipe protection).
4. Static DNR is never removed by sync failure.

## File shape (`adult-blocklist.json`)

```json
{
  "version": 1,
  "updatedAt": "2026-08-02",
  "domains": ["xcolle.jp", "pcolle.jp", "fc2ppv.tv", "..."],
  "hostnameSubstrings": ["missav", "fc2ppv", "xcolle", "..."],
  "policySensitive": [
    { "domain": "fantia.jp", "notes": "Prefer content analysis" }
  ]
}
```

A bare JSON array of domain strings is also accepted on disk.

## Policy-sensitive platforms

Fantia, ci-en, booth, Fanbox (and similar mixed SFW/NSFW marketplaces) are **not** hard-seeded. Prefer eval fixtures + Layer 3 content analysis.

## Maintainer commands

```bash
# Expand seed, merge new hosts into rules.json, refresh eval corpus
pnpm --filter @clarity/extension generate:adult-blocklist

# Offline precision/recall eval
pnpm --filter @clarity/extension eval:adult-blocking

# Seed local desktop file for native sync testing
mkdir -p ~/.clarity
cp apps/extension/public/adult-blocklist.json ~/.clarity/adult-blocklist.json
```

Desktop can also write the file via Tauri:

`invoke('write_adult_blocklist_to_disk', { payload })`

## Extension reload / test

1. `pnpm --filter @clarity/extension build`
2. Chrome → `chrome://extensions` → reload Clarity
3. Confirm `dist/adult-blocklist.json` and `dist/rules.json` are present
4. Optional: copy list to `~/.clarity/`, rebuild desktop/native host, confirm `GET_CONFIG` returns `adultDomains`
5. Navigate to a seed host (e.g. `https://xcolle.jp/`) → block screen

## Future (not v1)

- CDN / Supabase Storage fetch with etag
- `chrome.declarativeNetRequest.updateDynamicRules` for hot DNR without rebuild
- UI to show system list version in Boundaries
- Self-improving observe→promote loop: see [self_improving_blocking_loop_v1.md](./self_improving_blocking_loop_v1.md)
