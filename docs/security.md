# Tiens Bon — Security Review (Step 21)

This document audits the codebase against every requirement in **Section 5** of the build specification (`v2`), records the manual verification procedures, and states honestly what is protected and what is not.

---

## 1. Section 5 Item-by-Item Audit

### Network (Items 1–3)
1. **No public exposure / private network**:
   - **Status**: Satisfied for home deployment.
   - **Evidence**: In local home deployment, the server runs on the user's PC and is reached from the phone exclusively over Tailscale HTTPS (`tailscale serve`), never `tailscale funnel` and never router port-forwarding. (Note: In the cloud preview/demo container, the server binds to port `3000` so the preview proxy can reach it.)
2. **Ollama listens on `127.0.0.1` only**:
   - **Status**: Satisfied.
   - **Evidence**: `server.ts` connects to `process.env.OLLAMA_URL || 'http://127.0.0.1:11434'` (`server.ts`, lines 126 and 300). Ollama is never exposed directly to the network; only the backend proxy talks to it.
3. **Private tailnet with 2FA**:
   - **Status**: Operational requirement documented in `README.md`.

### Server (Items 4–9)
4. **Access token (`Authorization: Bearer ...` with constant-time comparison)**:
   - **Status**: Satisfied.
   - **Evidence**: `server.ts` (`safeCompareTokens`, `verifyToken`, `verifyTokenOrQuery`, lines 41–96) compares the provided Bearer token against `process.env.ACCESS_TOKEN` using `crypto.timingSafeEqual(bufA, bufB)` and returns `401 Unauthorized` if missing or invalid.
5. **Strict request validation (`extra="forbid"`, length caps, rate limit, timeout)**:
   - **Status**: Satisfied.
   - **Evidence**:
     - Unknown properties rejected with `422`: `server.ts` (`allowedKeys = new Set(['prompt', 'expected_format'])`, lines 196–201).
     - Length cap on `prompt` (`1` to `4000` chars): `server.ts` (lines 203–206) and `config/app.config.json` (`"maxPromptLength": 3000`).
     - Client never controls the model name or Ollama URL.
     - Sliding-window rate limit (`30` requests/minute returning `429`): `server.ts` (`checkRateLimit`, lines 15–31).
     - `AbortController` timeouts on Ollama requests (`2000 ms` status, `4000 ms` generation).
6. **No CORS wildcard (same-origin only)**:
   - **Status**: Satisfied.
   - **Evidence**: `server.ts` does not enable `cors()` or emit `Access-Control-Allow-Origin: *`.
7. **No logging of prompts or user responses**:
   - **Status**: Satisfied.
   - **Evidence**: `server.ts` never logs `req.body.prompt` or model output text.
8. **Security headers (`Content-Security-Policy`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`)**:
   - **Status**: Satisfied.
   - **Evidence**: `server.ts` (lines 100–112) sets:
     - `X-Content-Type-Options: nosniff`
     - `Referrer-Policy: no-referrer`
     - `Permissions-Policy: camera=(), microphone=(), geolocation=()`
     - `Content-Security-Policy` in production builds (`default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data:; connect-src 'self'; worker-src 'self'; manifest-src 'self'; base-uri 'none'; form-action 'self'`).
9. **Minimal server state (no personal message text stored on server)**:
   - **Status**: Satisfied.
   - **Evidence**: All personal profile data, journal entries, plans, images, and pre-generated messages live exclusively in IndexedDB on the user's device (`src/db/index.ts`).

### Web App (Items 10–15)
10. **Untrusted model output and user text (no `innerHTML` / `eval`)**:
    - **Status**: Satisfied.
    - **Evidence**: Rendered strictly through React text nodes (equivalent to `textContent`). No `dangerouslySetInnerHTML`, `innerHTML`, `insertAdjacentHTML`, `document.write`, or `eval` exists anywhere in `src/`.
11. **Model is not an agent (no tools, no actions)**:
    - **Status**: Satisfied.
    - **Evidence**: Model outputs are parsed as JSON, validated with strict Zod schemas (`CravingOutputSchema`, `CheckinExtractionSchema` in `src/schemas/model.ts`), filtered by `validateModelOutput()` (`src/security/safety.ts`), and displayed as plain text.
12. **Service worker precaches app shell only, never `/api` responses**:
    - **Status**: Satisfied.
    - **Evidence**: `src/sw.ts` uses `precacheAndRoute(self.__WB_MANIFEST)` and explicitly bypasses any `/api/` route (`if (url.pathname.startsWith('/api/')) return;`).
13. **Self-hosted assets only (no CDN, no analytics, no third-party requests)**:
    - **Status**: Satisfied.
    - **Evidence**: `index.html` and `src/styles/tokens.css` use a local system font stack and bundled assets only.
14. **Zod validation at every boundary (`.strict()`, length caps, enums)**:
    - **Status**: Satisfied.
    - **Evidence**: Every schema in `src/schemas/` (`profile.ts`, `events.ts`, `pregenerated.ts`, `images.ts`, `plans.ts`, `selftalk.ts`, `settings.ts`, `model.ts`, `config.ts`, `facts.ts`) uses `.strict()` and explicit length caps. Every read and write in `src/db/index.ts` and `src/security/encryption.ts` validates with Zod.
15. **Image re-encoding via Canvas (strips EXIF/GPS metadata), size and count caps**:
    - **Status**: Satisfied.
    - **Evidence**: `src/lib/images.ts` (`processAndSanitizeImage`) checks MIME type (`image/jpeg`, `image/png`, `image/webp`), redraws the image onto an HTML5 `<canvas>` to strip all EXIF/GPS metadata, compresses to WebP/JPEG within `maxSizeBytes` (`1.5 MB`), and `src/db/index.ts` (`addImage`) enforces `maxCount` (`12` images) from `config/app.config.json`.

### Secrets and Git (Items 16–17)
16. **`.gitignore` and `scripts/check-secrets.mjs`**:
    - **Status**: Satisfied.
    - **Evidence**: `.gitignore` excludes `.env`, `server/config.json`, `.private-words.local`, `*.local.json`, `data/`, `node_modules/`, `dist/`. `scripts/check-secrets.mjs` blocks commits containing forbidden files, private keys, API tokens, or words from `.private-words.local`.
17. **Pinned dependencies and audit**:
    - **Status**: Satisfied.

### Data on the Phone & Demo (Items 18–22)
18. **Honest storage disclosure & optional PIN lock**:
    - **Status**: Satisfied.
    - **Evidence**: Documented in `README.md` and inside the in-app PIN Lock card (`src/components/AppPinLock.tsx`).
19. **Discreet mode ON by default**:
    - **Status**: Satisfied.
    - **Evidence**: `config/app.config.json` sets `"discreetModeDefault": true`, and `src/lib/reminders.ts` formats lock-screen notifications with neutral wording when discreet mode is active.
20. **"Delete everything" wipes IndexedDB, caches, localStorage, push subscription, and server state**:
    - **Status**: Satisfied.
    - **Evidence**: `handleDeleteAllData` in `src/App.tsx` and `ProfileEditor.tsx` calls `resetDatabase()`, `localStorage.clear()`, deletes all Cache Storage keys, unsubscribes Service Worker push manager if present, and calls `POST /api/data/clear`.
21. **Backup export warning and Web Crypto encryption**:
    - **Status**: Satisfied.
    - **Evidence**: `src/security/encryption.ts` encrypts backups with `AES-GCM` (256-bit) + `PBKDF2` (600,000 iterations) + `HMAC-SHA256` integrity verification and rejects any external `http(s)://` URLs on import.
22. **Public static demo has no server routes, no token, and fictional content only**:
    - **Status**: Satisfied.
    - **Evidence**: `pnpm build:demo` (`vite build --mode demo`) bundles `demo/profile.demo.json` and `demo/pregenerated.demo.json` (`src/lib/demo-mode.ts`) with no server token card and no required backend calls.

---

## 2. Manual Security Verification Checklist

1. **Unauthenticated network test**: From a phone not connected to the private Tailscale network, opening the local Tailscale URL fails to connect.
2. **Unauthorized API call**:
   ```bash
   curl -i -X POST http://127.0.0.1:3000/api/generate -H "Content-Type: application/json" -d '{"prompt":"test"}'
   ```
   Returns `HTTP/1.1 401 Unauthorized`.
3. **Security headers inspection**:
   ```bash
   curl -I http://127.0.0.1:3000/api/health
   ```
   Confirms `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, and `Permissions-Policy: camera=(), microphone=(), geolocation=()`.
4. **XSS injection test**: Saving `<img src=x onerror=alert(1)>` in a phrase or journal entry renders literally as plain text (`« <img src=x onerror=alert(1)> »`) without executing script.
5. **Strict schema rejection**: Importing a backup or profile with unknown fields or oversized strings is rejected by Zod `.strict()` validation (`tests/schemas.test.ts` and `tests/encryption.test.ts`).
6. **Secret scanner check**: Running `node scripts/check-secrets.mjs` exits `0` (`✓ Secrets check passed`).
7. **Ollama isolation**: Port `11434` is bound to `127.0.0.1` on the host PC and unreachable from external LAN devices.
8. **Dependency audit**: Verified via `pnpm audit`.

---

## 3. Honest Disclosure: What Is Not Protected

- **IndexedDB at rest**: While exported backup files are encrypted with 256-bit AES-GCM (`src/security/encryption.ts`) and the optional PIN lock (`src/security/pin-lock.ts`) uses PBKDF2 + AES-GCM to gate app access against casual snooping on an unlocked phone, active IndexedDB records used by the service worker for background reminders live in browser storage. Protection against a determined physical attacker relies on Android's device screen lock and full-disk encryption.
- **Forgotten PIN or backup password**: Because encryption keys are derived locally with PBKDF2 and never sent to any server, forgetting the PIN or backup password means encrypted data cannot be recovered. Users are warned to export a backup first.
- **Keyword distress detection limits**: Local keyword matching (`src/security/safety.ts`) catches explicit distress phrases deterministically before any model call, but cannot understand subtle or indirect expressions of distress. It is a safety net, not a clinical assessment.
