# Signed dynamic adult list (v1) — Étape 3

Hot-update **domains + adult ad hosts** without a Chrome Web Store republish.

Related: [adult_blocklist_sync_v1.md](./adult_blocklist_sync_v1.md), [cheap_agent_scanner_mvp.md](./cheap_agent_scanner_mvp.md).

## Why

Static `rules.json` DNR is excellent but requires rebuild/reload to grow. The signed channel lets maintainers push new hosts (and ad networks) that the extension:

1. **Verifies** (Ed25519) against an embedded public key  
2. **Merges** into `chrome.storage.local.adultBlocklistDomains` (existing `shouldBlock` path)  
3. **Applies** `chrome.declarativeNetRequest.updateDynamicRules` (ids `900000–909999`)

Empty / invalid / bad-signature payloads are **rejected** — never wipe protection.

## Document shape

```json
{
  "format": "clarity-signed-adult-list/v1",
  "sequence": 1794728953599,
  "issuedAt": "2026-11-15T07:49:00.000Z",
  "expiresAt": "2027-11-15T07:49:00.000Z",
  "keyId": "clarity-adult-list-2026",
  "payload": {
    "domains": ["pigav.com", "globalinnovationdesign.org"],
    "adHosts": ["magsrv.com", "exoclick.com"]
  },
  "signature": "<base64 Ed25519>"
}
```

### Canonical message (signed bytes)

UTF-8 lines joined by `\n`:

```
clarity-signed-adult-list/v1
{sequence}
{issuedAt}
{expiresAt}
{keyId}
{"adHosts":[...sorted...],"domains":[...sorted...]}
```

(`JSON.stringify` of `{ domains, adHosts }` with **sorted unique** arrays.)

## Keys

| Item | Location |
|------|----------|
| Public key (SPKI base64) | `apps/extension/scripts/lib/dynamic-adult-list.public.json` + embedded in `signed-adult-list.ts` |
| Private key | `~/.clarity/keys/adult-list-ed25519-private.pem` (**never commit**) |

```bash
pnpm --filter @clarity/extension sign:adult-list -- --init-keys
pnpm --filter @clarity/extension sign:adult-list:install   # default MVP payload → ~/.clarity + fixture
pnpm --filter @clarity/extension verify:adult-list
```

## Delivery paths

| Source | How |
|--------|-----|
| Native host | `GET_CONFIG` → `signedAdultList` from `~/.clarity/signed-adult-list.json` |
| HTTPS (optional) | Set `chrome.storage.local.signedAdultListFetchUrl` to an `https://…` URL; alarm every 6h |
| Packaged bootstrap | `public/signed-adult-list.json` copied into `dist/` on build |

Refresh also runs on install/startup.

## Test refresh (dev)

1. Sign / install list:
   ```bash
   pnpm --filter @clarity/extension sign:adult-list:install
   ```
2. Rebuild extension (+ desktop host if testing native path):
   ```bash
   pnpm --filter @clarity/extension build
   # optional: rebuild Clarity.app / native host so GET_CONFIG includes signedAdultList
   ```
3. Chrome → **Reload** Clarity (UNLOCK → Load unpacked → STRICT as usual — no `chrome.runtime.reload` from code).
4. Confirm storage: `signedAdultListSequence`, `signedAdultListHostCount`, and that `adultBlocklistDomains` contains e.g. `pigav.com`.
5. Optional HTTPS test: host the JSON over HTTPS, then in SW console:
   ```js
   chrome.storage.local.set({ signedAdultListFetchUrl: 'https://example.com/signed-adult-list.json' })
   ```
   Wait for alarm or re-trigger install/startup path.

## Sequence gate

A list with `sequence <= signedAdultListSequence` is verified but **not re-applied** (avoids thrashing DNR). Bump `sequence` (default: timestamp) when publishing updates.
