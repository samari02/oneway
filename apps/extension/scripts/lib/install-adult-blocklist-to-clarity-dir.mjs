#!/usr/bin/env node
/**
 * Seed ~/.clarity/adult-blocklist.json from packaged public/adult-blocklist.json
 * so native-host GET_CONFIG can serve adultDomains.
 *
 * Default: copy only if dest is missing (safe for LIVE machines with a newer list).
 * Force overwrite: --force
 *
 * Usage:
 *   node apps/extension/scripts/lib/install-adult-blocklist-to-clarity-dir.mjs
 *   node apps/extension/scripts/lib/install-adult-blocklist-to-clarity-dir.mjs --force
 *   pnpm --filter @clarity/extension install:adult-blocklist
 */
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const src = path.resolve(__dirname, '../../public/adult-blocklist.json')
const destDir = path.join(os.homedir(), '.clarity')
const dest = path.join(destDir, 'adult-blocklist.json')
const force = process.argv.includes('--force')

if (!fs.existsSync(src)) {
  console.error('Missing', src)
  process.exit(1)
}

if (fs.existsSync(dest) && !force) {
  const doc = JSON.parse(fs.readFileSync(dest, 'utf8'))
  console.log(
    `Skip (already present): ${dest} (${doc.domains?.length ?? '?'} domains). Use --force to overwrite.`
  )
  process.exit(0)
}

fs.mkdirSync(destDir, { recursive: true })
fs.copyFileSync(src, dest)
const doc = JSON.parse(fs.readFileSync(dest, 'utf8'))
console.log(`Installed ${doc.domains?.length ?? '?'} domains → ${dest}`)
