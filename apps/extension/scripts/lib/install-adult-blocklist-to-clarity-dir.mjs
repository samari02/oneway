#!/usr/bin/env node
/**
 * Copy packaged adult-blocklist.json → ~/.clarity/adult-blocklist.json
 * for native-host GET_CONFIG sync testing.
 *
 * Usage: node apps/extension/scripts/lib/install-adult-blocklist-to-clarity-dir.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const src = path.resolve(__dirname, '../../public/adult-blocklist.json')
const destDir = path.join(os.homedir(), '.clarity')
const dest = path.join(destDir, 'adult-blocklist.json')

if (!fs.existsSync(src)) {
  console.error('Missing', src)
  process.exit(1)
}
fs.mkdirSync(destDir, { recursive: true })
fs.copyFileSync(src, dest)
const doc = JSON.parse(fs.readFileSync(dest, 'utf8'))
console.log(`Installed ${doc.domains?.length ?? '?'} domains → ${dest}`)
