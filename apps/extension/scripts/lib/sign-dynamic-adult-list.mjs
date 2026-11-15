#!/usr/bin/env node
/**
 * Sign / verify Clarity dynamic adult lists (Étape 3).
 *
 * Keypair (maintainer machine):
 *   ~/.clarity/keys/adult-list-ed25519-private.pem
 *   ~/.clarity/keys/adult-list-ed25519-public.pem
 *
 * Usage:
 *   node apps/extension/scripts/lib/sign-dynamic-adult-list.mjs --init-keys
 *   node apps/extension/scripts/lib/sign-dynamic-adult-list.mjs --sign [--in list.json] [--out ~/.clarity/signed-adult-list.json]
 *   node apps/extension/scripts/lib/sign-dynamic-adult-list.mjs --verify [--in ~/.clarity/signed-adult-list.json]
 *   node apps/extension/scripts/lib/sign-dynamic-adult-list.mjs --install  # sign default MVP payload → ~/.clarity
 *
 * Private key is NEVER written into the repo.
 */
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { fileURLToPath, pathToFileURL } from 'node:url'
import {
  generateKeyPairSync,
  createPrivateKey,
  createPublicKey,
  sign as cryptoSign,
  verify as cryptoVerify,
} from 'node:crypto'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PUBLIC_META_PATH = path.join(__dirname, 'dynamic-adult-list.public.json')
const KEY_DIR = path.join(os.homedir(), '.clarity', 'keys')
const PRIV_PATH = path.join(KEY_DIR, 'adult-list-ed25519-private.pem')
const PUB_PATH = path.join(KEY_DIR, 'adult-list-ed25519-public.pem')
const DEFAULT_OUT = path.join(os.homedir(), '.clarity', 'signed-adult-list.json')
const FORMAT = 'clarity-signed-adult-list/v1'

/** Default MVP payload — domains previously dirty as hard-seeds + adult ad hosts. */
const DEFAULT_PAYLOAD = {
  domains: [
    'pigav.com',
    'globalinnovationdesign.org',
    'vkvideo.ru',
    'm.vkvideo.ru',
  ],
  adHosts: [
    'exoclick.com',
    'juicyads.com',
    'trafficjunky.net',
    'magsrv.com',
    'realsrv.com',
    'tsyndicate.com',
  ],
}

function parseArgs(argv) {
  const out = { _: [] }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--init-keys') out.initKeys = true
    else if (a === '--sign') out.sign = true
    else if (a === '--verify') out.verify = true
    else if (a === '--install') out.install = true
    else if (a === '--in') out.in = argv[++i]
    else if (a === '--out') out.out = argv[++i]
    else if (a === '--sequence') out.sequence = Number(argv[++i])
    else if (a === '--days') out.days = Number(argv[++i])
    else out._.push(a)
  }
  return out
}

function uniqSorted(list) {
  const s = new Set()
  for (const raw of list || []) {
    if (typeof raw !== 'string') continue
    let d = raw.trim().toLowerCase()
    d = d.replace(/^https?:\/\//, '').split('/')[0] || ''
    d = d.replace(/^www\./, '').replace(/^\.+|\.+$/g, '')
    if (d.includes('.')) s.add(d)
  }
  return [...s].sort()
}

export function buildCanonicalMessage(doc) {
  const domains = uniqSorted(doc.payload?.domains)
  const adHosts = uniqSorted(doc.payload?.adHosts)
  const body = JSON.stringify({ domains, adHosts })
  return [
    doc.format || FORMAT,
    String(doc.sequence ?? 0),
    String(doc.issuedAt || ''),
    String(doc.expiresAt || ''),
    String(doc.keyId || ''),
    body,
  ].join('\n')
}

function loadPublicMeta() {
  return JSON.parse(fs.readFileSync(PUBLIC_META_PATH, 'utf8'))
}

function initKeys() {
  fs.mkdirSync(KEY_DIR, { recursive: true })
  if (fs.existsSync(PRIV_PATH) && fs.existsSync(PUB_PATH)) {
    console.log('Keys already exist:', KEY_DIR)
    return
  }
  const { publicKey, privateKey } = generateKeyPairSync('ed25519')
  fs.writeFileSync(
    PRIV_PATH,
    privateKey.export({ type: 'pkcs8', format: 'pem' }),
    { mode: 0o600 }
  )
  fs.writeFileSync(
    PUB_PATH,
    publicKey.export({ type: 'spki', format: 'pem' })
  )
  const spkiB64 = Buffer.from(
    publicKey.export({ type: 'spki', format: 'der' })
  ).toString('base64')
  console.log('Wrote', PRIV_PATH)
  console.log('Wrote', PUB_PATH)
  console.log('Embed publicKeySpkiBase64 in dynamic-adult-list.public.json:')
  console.log(spkiB64)
}

function signDocument({ payload, sequence, days }) {
  if (!fs.existsSync(PRIV_PATH)) {
    throw new Error(`Missing private key at ${PRIV_PATH} — run --init-keys first`)
  }
  const meta = loadPublicMeta()
  const issuedAt = new Date().toISOString()
  const expires = new Date(Date.now() + (days || 365) * 864e5).toISOString()
  const doc = {
    format: FORMAT,
    sequence: sequence ?? Date.now(),
    issuedAt,
    expiresAt: expires,
    keyId: meta.keyId,
    payload: {
      domains: uniqSorted(payload.domains),
      adHosts: uniqSorted(payload.adHosts),
    },
  }
  const msg = Buffer.from(buildCanonicalMessage(doc), 'utf8')
  const privateKey = createPrivateKey(fs.readFileSync(PRIV_PATH))
  const signature = cryptoSign(null, msg, privateKey)
  doc.signature = signature.toString('base64')
  return doc
}

export function verifyDocument(doc, publicKeySpkiBase64) {
  if (!doc || typeof doc !== 'object') return { ok: false, reason: 'not_object' }
  if (doc.format !== FORMAT) return { ok: false, reason: 'bad_format' }
  if (typeof doc.signature !== 'string' || !doc.signature) {
    return { ok: false, reason: 'missing_signature' }
  }
  const exp = Date.parse(doc.expiresAt || '')
  if (!Number.isFinite(exp) || exp < Date.now()) {
    return { ok: false, reason: 'expired' }
  }
  const meta = loadPublicMeta()
  const keyId = doc.keyId || ''
  if (keyId && keyId !== meta.keyId) {
    return { ok: false, reason: 'key_id_mismatch' }
  }
  const spkiB64 = publicKeySpkiBase64 || meta.publicKeySpkiBase64
  const spki = Buffer.from(spkiB64, 'base64')
  const publicKey = createPublicKey({ key: spki, format: 'der', type: 'spki' })
  const msg = Buffer.from(buildCanonicalMessage(doc), 'utf8')
  const sig = Buffer.from(doc.signature, 'base64')
  const ok = cryptoVerify(null, msg, publicKey, sig)
  if (!ok) return { ok: false, reason: 'bad_signature' }
  return {
    ok: true,
    domains: uniqSorted(doc.payload?.domains),
    adHosts: uniqSorted(doc.payload?.adHosts),
    sequence: doc.sequence,
  }
}

function readPayloadOrDefault(inPath) {
  if (!inPath) return { ...DEFAULT_PAYLOAD }
  const raw = JSON.parse(fs.readFileSync(inPath, 'utf8'))
  if (raw.payload) return raw.payload
  if (raw.domains || raw.adHosts) {
    return { domains: raw.domains || [], adHosts: raw.adHosts || [] }
  }
  throw new Error('Input must be {domains,adHosts} or a full signed doc with payload')
}

function main() {
  const args = parseArgs(process.argv.slice(2))
  if (args.initKeys) {
    initKeys()
    return
  }

  if (args.verify) {
    const inPath = args.in || DEFAULT_OUT
    const doc = JSON.parse(fs.readFileSync(inPath, 'utf8'))
    const result = verifyDocument(doc)
    console.log(JSON.stringify(result, null, 2))
    if (!result.ok) process.exit(1)
    return
  }

  if (args.sign || args.install) {
    const payload = readPayloadOrDefault(args.in)
    const doc = signDocument({
      payload,
      sequence: args.sequence,
      days: args.days,
    })
    const outPath = args.out || DEFAULT_OUT
    fs.mkdirSync(path.dirname(outPath), { recursive: true })
    fs.writeFileSync(outPath, JSON.stringify(doc, null, 2) + '\n')
    const check = verifyDocument(doc)
    console.log('Wrote', outPath)
    console.log(
      `domains=${check.domains?.length || 0} adHosts=${check.adHosts?.length || 0} sequence=${doc.sequence}`
    )
    console.log('verify:', check.ok ? 'OK' : check.reason)
    if (!check.ok) process.exit(1)

    // Also write a repo fixture for offline verify tests (no private key needed).
    if (args.install) {
      const fixturePath = path.join(
        __dirname,
        '../eval/fixtures/signed-adult-list.sample.json'
      )
      fs.writeFileSync(fixturePath, JSON.stringify(doc, null, 2) + '\n')
      console.log('Wrote fixture', fixturePath)
    }
    return
  }

  console.log(`Usage:
  --init-keys
  --sign [--in payload.json] [--out path] [--sequence N] [--days 365]
  --verify [--in path]
  --install   # sign default MVP payload → ~/.clarity + eval fixture`)
  process.exit(2)
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main()
}
