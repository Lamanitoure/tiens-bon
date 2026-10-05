# Tiens Bon

**Tiens Bon** (*French for "hold on"*) is a local-first, open-weight AI companion for one person who wants to quit smoking at home. It prepares messages in his own voice ahead of time, warns his before his risk moments, shows his own photos and words, and never judges his. Anyone can fork it and make it theirs.

---

## 1. Core Principles & Product Overview

- **Before the craving (main value)**: A reminder arrives `10 minutes` (`reminderLeadTimeMinutes` in `config/app.config.json`) before each personal risk window, written in his voice and pointing to an alternative she chose. **Discreet mode is ON by default** so lock-screen notifications show neutral text only.
- **During the craving (instant, <100 ms, 100% offline)**: One tap (in-app button, PWA home-screen shortcut `/?craving=1`, or smartwatch webhook) opens an instant screen with a 3-minute grounding challenge, a message in his voice, one of his personal resource photos, a breathing anchor ring, and optional eyes-closed audio narration. Nothing waits for a model call during a craving.
- **After a craving or slip (zero guilt)**:
  - **Evening Check-in (2 min)**: Free-text journal entry where Gemma extracts `trigger`, `emotion`, and `outcome` (`resisted` | `smoked` | `unknown`), validated by Zod and editable before saving.
  - **No-Reproach Relapse Debrief**: If she taps *"I smoked"*, his best streak and total savings are **never erased**. Loving/deterrent photos are never shown after a relapse (only calm/neutral imagery). She is guided through a gentle *"If... Then..."* implementation intention plan in his own words.
  - **Weekly Recap & Learned Risk Windows**: Deterministic code computes weekly victories and savings, detects recurring craving hours (`minEventsBeforeLearnedWindow`), and asks his permission before adding a new reminder window.
- **Sourced Health Facts (`config/facts.json`)**: Hand-written facts from official health authorities (WHO / Santé publique France) with explicit source URLs, displayed strictly as written and never generated or altered by the AI model.
- **Total Data Control**:
  - All personal data lives in **IndexedDB** on the device, validated on every read and write with `.strict()` **Zod** schemas.
  - **Encrypted Web Crypto Backups**: Export and import backups sealed with `AES-GCM` (256-bit), `PBKDF2` (600,000 iterations), and `HMAC-SHA256`.
  - **Optional Web Crypto PIN Lock**: Protects app opening with a `PBKDF2` + `AES-GCM` verifier.
  - **Delete Everything**: One-tap confirmed reset clears IndexedDB, Cache Storage, `localStorage`, push subscriptions, and transient server state.

---

## 2. Where the AI Is (and Is Not)

The open-weight **Gemma** model (`gemma2:2b` via **Ollama**) performs four bounded tasks:
1. **Prepare**: Pre-generates daily batches of 3-minute challenges and encouraging messages in his voice (`src/lib/pregeneration.ts`).
2. **Extract**: Turns free-text evening check-ins into structured `{trigger, emotion, outcome}` drafts (`src/lib/checkin.ts`).
3. **Rephrase**: Wraps code-computed weekly statistics into a warm 2-sentence note starting with what worked (`src/lib/recap-model.ts`).
4. **Organize**: Helps structure his personal phrases and context prompts.

**What the model never does**:
- It **never** computes streaks, counters, money saved, dates, or learned risk windows (all computed deterministically in `src/lib/stats.ts` and `src/lib/recap.ts`).
- It **never** gives medical advice, health statistics, percentages, medication names, dosages, future predictions (*"you will"*), or guilt/reproach. Every model response passes through `validateModelOutput()` (`src/security/safety.ts`).
- It has **no tools and no actions**.
- **Distress interception runs in plain code before any model call** (`checkDistress()` in `src/security/safety.ts`): if any free-text input contains a distress keyword from `config/distress.defaults.json`, no model call is made and the fixed helpline & trusted contact banner is displayed immediately.

---

## 3. Installation & Local Setup

### Prerequisites
- **Node.js** (v22 LTS recommended) & **pnpm**
- **Ollama** ([ollama.com](https://ollama.com)) running locally on `127.0.0.1:11434`

### Step-by-Step Setup

1. **Clone the repository and install dependencies**:
   ```bash
   git clone https://github.com/Lamanirevegrand/tiens-bon.git
   cd tiens-bon
   pnpm install --frozen-lockfile
   ```

2. **Pull the open-weight Gemma model in Ollama**:
   ```bash
   ollama pull gemma2:2b
   ```
   *(Keep Ollama bound to its default `127.0.0.1:11434`. Never set `OLLAMA_HOST=0.0.0.0`.)*

3. **Configure environment variables**:
   Copy `.env.example` to `.env` and set a strong random access token:
   ```bash
   cp .env.example .env
   node -e "console.log('ACCESS_TOKEN=' + require('crypto').randomBytes(32).toString('base64url'))" >> .env
   ```

4. **Run the verification suite and start the server**:
   ```bash
   pnpm typecheck
   pnpm lint
   pnpm test
   pnpm dev
   ```

5. 5. **Open the web app or install the PWA**:
   Open `http://localhost:3000` (or your local IP address / deployed URL) in your browser. On Android Chrome or iOS Safari, tap **"Add to Home screen"** (or use the in-app install button) to install the PWA. Enter your `ACCESS_TOKEN` in **Profile > Local Gemma Model Connection**.

   Open your `https://<machine>.<tailnet>.ts.net` URL in Chrome on Android, paste your `ACCESS_TOKEN` once in **Profile > Local Gemma Model Connection**, and tap **"Add to Home screen"** to install the PWA.

---

## 4. Configuration Reference (Nothing Personal or Tunable Is Hard-Coded)

Every threshold, word list, prompt template, and fallback lives in validated configuration files:

| File | Purpose | Validation Schema |
|---|---|---|
| `config/app.config.json` | Default/supported languages (`fr`, `en`), challenge duration (`180s`), reminder lead time (`10m`), batch size (`10`), contexts, tones, retry count, `minEventsBeforeLearnedWindow` (`5`), image limits (`maxCount: 12`, `maxSizeBytes`, `quality`), `maxPromptLength`, `discreetModeDefault` (`true`) | `AppConfigSchema` (`src/schemas/config.ts`) |
| `config/safety.defaults.json` | Blocked regex patterns (percentages, medical terms, dosages, predictions, guilt words) and safe replacement messages | `SafetyConfigSchema` (`src/schemas/config.ts`) |
| `config/distress.defaults.json` | Distress keywords per language (`fr`, `en`) checked by code before any model call | `DistressConfigSchema` (`src/schemas/config.ts`) |
| `config/facts.json` | Hand-written sourced health facts from WHO and Santé publique France with official URLs | `FactsListSchema` (`src/schemas/facts.ts`) |
| `config/prompts/*.txt` | Editable prompt templates (`craving.txt`, `relapse.txt`, `checkin-extraction.txt`, `reminder.txt`, `recap.txt`) | Validated at build/runtime |
| `config/fallback/en.json`, `fr.json` | Offline fallback templates built from the user's own phrases and alternatives | Used when Ollama is unreachable |
| `demo/profile.demo.json` | Fictional demo profile ("Camille") with 12 phrases, risk windows, helpline, and savings goal | `ProfileSchema` (`src/schemas/profile.ts`) |
| `demo/pregenerated.demo.json` | Bundled Gemma pre-generated messages for the static demo | `PregeneratedMessageSchema` (`src/schemas/pregenerated.ts`) |
| `src/i18n/fr.json`, `en.json` | All user-facing interface strings in French and English (strict key parity enforced by `tests/i18n.test.ts`) | Tested in `tests/i18n.test.ts` |

---

## 5. How to Make It Yours

1. **Customize in the app**: Open the **Profile & Mantras** tab and click **Customize my profile** (`ProfileEditor.tsx`) to enter your own reasons, risk windows, alternatives, phrases in your voice, support person, required helpline, and savings goal.
2. **Switch language**: Toggle between **Français** and **English** in the top header at any time.
3. **Protect real personal words from git commits**: Before customizing any files locally, create `.private-words.local` (ignored by git) and list your real name, city, or phone numbers (one per line). `scripts/check-secrets.mjs` will block any commit that accidentally contains those words.
4. **Build the static public demo**:
   ```bash
   pnpm build:demo
   ```
   Produces a self-contained static build in `dist/` using only fictional data from `demo/`.

---

## 6. Security Notes & Honest Limits

Please read [`docs/security.md`](./docs/security.md) for the full item-by-item audit. Key limits stated honestly:

1. **Not medical advice & substance safety warning**:
   - **Tiens Bon is not a medical device and does not provide medical advice, diagnosis, or treatment.** Consult a doctor, pharmacist, or qualified healthcare professional for medical support.
   - **Important warning**: This application is designed for smoking cessation habits and **is not designed for substances where stopping abruptly can be medically dangerous or life-threatening (for example, alcohol or certain medications such as benzodiazepines) without medical supervision.**
2. **IndexedDB storage & optional PIN lock**:
   - IndexedDB is not encrypted at rest by the browser so that the Service Worker can read pre-generated reminders offline. Physical device security relies on Android's screen lock and device encryption.
   - The optional **Web Crypto PIN Lock** (`PBKDF2` + `AES-GCM`) blocks casual snooping if someone picks up your unlocked phone, not a determined forensic attacker. If you forget your PIN, you must reset local data—export an encrypted backup first.
3. **Reminders require the PC on (or Plan B)**:
   - Live model pre-generation requires the server or Ollama to be reachable. When offline, the app falls back seamlessly to cached batches and **Plan B** copyable alarm labels for your phone's native Clock app (`docs/feasibility.md`).
4. **Small model & keyword limits**:
   - Small open-weight models (`gemma2:2b`) can occasionally produce imperfect phrasing; our Zod schemas and regex safety filter (`src/security/safety.ts`) catch prohibited patterns and fall back to your own written phrases.
   - Keyword distress detection (`config/distress.defaults.json`) is deterministic and fast, but cannot detect every nuanced expression of distress.

---

## 7. Licenses

- Application Code: Released under the GNU General Public License v3.0 (GPL-3.0)
- **Gemma Model Weights**: Users download and run Gemma weights themselves via Ollama under Google's [Gemma Terms of Use](https://ai.google.dev/gemma/terms). No model weights are distributed in this repository.
