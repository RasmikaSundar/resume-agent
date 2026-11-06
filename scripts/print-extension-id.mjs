#!/usr/bin/env node
/**
 * Predict Chrome unpacked-extension ID from absolute dist path.
 * Usage: node scripts/print-extension-id.mjs [path-to-dist]
 */
import { createHash } from "node:crypto";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const distPath = resolve(process.argv[2] ?? `${root}/apps/extension/dist`);

const hash = createHash("sha256").update(distPath).digest();
let id = "";
for (let i = 0; i < 16; i++) {
  id += String.fromCharCode(97 + (hash[i] >> 4));
  id += String.fromCharCode(97 + (hash[i] & 0x0f));
}

console.log(distPath);
console.log(id);
console.log(`chrome-extension://${id}`);
