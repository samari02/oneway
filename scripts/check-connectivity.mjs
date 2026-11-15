#!/usr/bin/env node
/**
 * Guardrails for desktop ↔ extension ↔ native-messaging connectivity.
 * Run: pnpm check:connectivity (from repo root)
 */

import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** Stable ID from manifest `key` (apps/extension/manifest.json). */
export const EXPECTED_EXTENSION_ID = "bladnadefjcnkapbdclfjpbekhmmoojb";

const ALPHABET = "abcdefghijklmnop";

export function chromeExtensionIdFromPublicKeyDer(der) {
  const hash = createHash("sha256").update(der).digest();
  let id = "";
  for (let i = 0; i < 16; i++) {
    id += ALPHABET[hash[i] >> 4];
    id += ALPHABET[hash[i] & 0x0f];
  }
  return id;
}

export function chromeExtensionIdFromManifestKey(base64Key) {
  const der = Buffer.from(base64Key.replace(/\s+/g, ""), "base64");
  return chromeExtensionIdFromPublicKeyDer(der);
}

function fail(message) {
  console.error(`check-connectivity: ${message}`);
  process.exitCode = 1;
}

function read(rel) {
  return readFileSync(path.join(REPO_ROOT, rel), "utf8");
}

let errors = 0;
function assert(condition, message) {
  if (!condition) {
    fail(message);
    errors++;
  }
}

// --- Cargo package name ---
const cargoToml = read("apps/desktop/src-tauri/Cargo.toml");
const pkgMatch = cargoToml.match(/^\[package\][\s\S]*?^name\s*=\s*"([^"]+)"/m);
assert(pkgMatch?.[1] === "appsdesktop", `Cargo.toml package name must be appsdesktop (got ${pkgMatch?.[1] ?? "missing"})`);

// --- Tauri product name ---
const tauriConf = JSON.parse(read("apps/desktop/src-tauri/tauri.conf.json"));
assert(
  tauriConf.productName === "Clarity",
  `tauri.conf.json productName must be Clarity (got ${tauriConf.productName ?? "missing"})`,
);

// --- Native host install script default binary path ---
const installHost = read("apps/desktop/scripts/install-native-host.sh");
assert(
  installHost.includes("/Applications/Clarity.app/Contents/MacOS/appsdesktop"),
  "install-native-host.sh must default to /Applications/Clarity.app/Contents/MacOS/appsdesktop",
);

// --- Manifest key → extension ID ---
let manifest;
try {
  manifest = JSON.parse(read("apps/extension/manifest.json"));
} catch (e) {
  fail(`could not parse apps/extension/manifest.json: ${e.message}`);
  process.exit(1);
}

if (manifest.key) {
  const derived = chromeExtensionIdFromManifestKey(manifest.key);
  console.log(`manifest key → extension ID: ${derived}`);
  assert(
    derived === EXPECTED_EXTENSION_ID,
    `manifest key yields ${derived}, expected ${EXPECTED_EXTENSION_ID}`,
  );
} else {
  fail('apps/extension/manifest.json is missing a stable "key" field');
}

if (process.exitCode === 1 || errors > 0) {
  console.error("\ncheck-connectivity: FAILED");
  process.exit(1);
}

console.log("check-connectivity: OK");