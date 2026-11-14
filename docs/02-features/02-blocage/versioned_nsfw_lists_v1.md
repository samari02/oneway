# Versioned NSFW lists (repo pipeline)

Single source of truth for shipped adult blocking lives in the **oneway** repo — not ad-hoc `~/dev/dist` dumps.

## Official pipeline

```bash
# 1. Optional: fetch community complements (needs network)
pnpm --filter @clarity/extension import:public-adult-lists
# flags: --dry-run | --cap 2500 (default)

# 2. Union curated seed + promoted + imported → DNR + seed JSON + eval corpus
pnpm --filter @clarity/extension generate:adult-blocklist

# 3. Gate before ship
pnpm --filter @clarity/extension eval:adult-blocking

# 4. Build extension
pnpm --filter @clarity/extension build
```

Artifacts (committed / versioned):

| File | Role |
|------|------|
| `scripts/lib/promoted-adult-domains.json` | Observe→learn promotions |
| `scripts/lib/imported-public-adult-domains.json` | Capped public-list complement |
| `public/adult-blocklist.json` | Runtime seed + desktop sync base |
| `public/rules.json` | Static DNR rules merged at generate time |

Empty imported/promoted sidecars **never wipe** the JP-heavy curated seed.

## Why not `~/dev/dist/rules-nsfw.json`?

Local ~140k HaGeZi/StevenBlack dumps are useful for **personal** Cold Turkey / DNS backstops but are:

- Outside git (no team replay, no CI gate)
- Far above practical MV3 static rule counts in one extension

Repo strategy: **curated + capped import + promoted loop + content/DNS layers**. Raise `--cap` only after `eval:adult-blocking` stays clean.

## Chrome limits

Each imported domain may add up to **two** static DNR rules. Default cap **2500** new imports targets ~5k rule growth — monitor `rules.json` size and eval FPs before raising further.

A second static ruleset file is possible in theory (`declarativeNetRequest.rule_resources`) but not required for v1; prefer one merged `rules.json` from `generate:adult-blocklist`.

## When network is blocked

Run `generate:adult-blocklist` + `build` on existing sidecars. Re-run `import:public-adult-lists` when GitHub raw fetches work again (Cold Turkey / DNS).