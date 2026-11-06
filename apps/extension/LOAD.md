# Load Resume Agent in Chrome

1. Open `chrome://extensions` (Developer mode **on**).
2. **Load unpacked** → select this folder’s **`dist`** directory:
   ```
   resume-agent/apps/extension/dist
   ```
3. Note the extension ID Chrome assigns (path-dependent; run `node ../../scripts/print-extension-id.mjs` if you moved the folder).
4. Options are pre-filled on install (port `3847`, repo URL, shared token from `.env.local`).
5. Restart API if you change the extension path (CORS origin is tied to extension ID).
