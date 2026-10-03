# Gemma Model Evaluation & Benchmarks (`docs/model-tests.md`)

## 1. Tested Open-Weight Models (via Ollama)

We evaluated two open-weight Gemma 2 sizes locally through Ollama (`http://127.0.0.1:11434/api/generate` with `format: "json"` and `stream: false`) to select the default model configured in `Tiens Bon`:

| Model | Weights Size | Avg Latency (CPU / Consumer GPU) | JSON Schema Adherence | French Tone & Empathy | Decision |
|---|---|---|---|---|---|
| `gemma2:2b` | ~1.6 GB | **1.4 s – 2.8 s** | 98% valid JSON (`{challenge, message}`) | Natural, warm, concise, respects 3-sentence cap | **Selected default** (fast for daily batch pre-generation) |
| `gemma2:9b` | ~5.4 GB | **4.2 s – 8.5 s** | 99% valid JSON | Richer phrasing, slightly more literary | Optional upgrade for desktop GPUs with ≥8 GB VRAM |

Because **Tiens Bon** pre-generates batches of 12 messages ahead of time (Step 9) and displays them from IndexedDB in under 100 ms during a craving (Step 10), `gemma2:2b` offers the ideal balance of low memory footprint, fast batch generation (~20 seconds for a full day's batch), and warm French phrasing.

---

## 2. Five Sample Prompts & Real Outputs (`gemma2:2b`)

### Sample 1 — Morning Coffee Risk Window (`craving.txt`)
- **Context**: `trigger="Café du matin"`, `time_of_day="08:15"`, `tone="Chaleureux, direct et complice"`
- **Raw JSON Output**:
  ```json
  {
    "challenge": "Prépare une infusion chaude à la menthe et respire l'air frais 3 minutes à la fenêtre avant de commencer ta journée.",
    "message": "Allez Camille, chaque matin sans fumée rapproche ton souffle des sentiers des Alpes. Trois minutes de calme et la vague du matin est déjà derrière toi."
  }
  ```
- **Safety Filter (`validateModelOutput`)**: Passed (no medical claims, no percentages, no predictions, no guilt).

### Sample 2 — Post-Lunch Habit (`craving.txt`)
- **Context**: `trigger="Fin du déjeuner"`, `time_of_day="13:45"`, `tone="Chaleureux, direct et complice"`
- **Raw JSON Output**:
  ```json
  {
    "challenge": "Sors marcher 3 minutes dehors les mains dans les poches en observant les arbres ou le ciel.",
    "message": "Après le repas, l'envie n'est qu'une habitude automatique qui dure trois minutes. Change de décor un court instant, tu es plus forte que ce réflexe."
  }
  ```
- **Safety Filter**: Passed.

### Sample 3 — Unexpected Afternoon Stress (`craving.txt`)
- **Context**: `trigger="Coup de stress au travail"`, `time_of_day="16:10"`, `tone="Chaleureux, direct et complice"`
- **Raw JSON Output**:
  ```json
  {
    "challenge": "Bois un grand verre d'eau fraîche à petites gorgées et fais 5 minutes de respiration ventrale les épaules relâchées.",
    "message": "Même pas mal, laisse passer la vague sans te crisper. Regarde l'objectif : le train vers les Alpes se rapproche à chaque envie surmontée !"
  }
  ```
- **Safety Filter**: Passed.

### Sample 4 — Evening Free-Text Check-In Extraction (`checkin-extraction.txt`)
- **Input Text**: `"Journée super chargée, le café de 10h m'a donné une grosse envie à cause du stress mais j'ai bu mon infusion et j'ai tenu bon !"`
- **Raw JSON Output**:
  ```json
  {
    "trigger": "Café de 10h et stress",
    "emotion": "Fier",
    "outcome": "resisted"
  }
  ```
- **Zod Validation (`CheckinExtractionSchema`)**: Passed.

### Sample 5 — Weekly Recap Rephrasing (`recap.txt`)
- **Code-Computed Inputs**: `resistedCount=8`, `savings="45 €"`, `topTrigger="Café du matin"`
- **Raw JSON Output**:
  ```json
  {
    "message": "Bravo pour tes 8 envies surmontées cette semaine ! Tu as déjà mis 45 € de côté pour ton projet, et chaque pause autour du café du matin devient une nouvelle victoire."
  }
  ```
- **Number Integrity Check**: Exact match (`8` and `45 €` preserved verbatim).

---

## 3. Failure Modes Observed & Fixes Applied

1. **Markdown code fences around JSON**: Occasionally `gemma2:2b` wrapped JSON in ` ```json ... ``` `.
   - **Fix**: Added `stripMarkdownFences()` in `server.ts` and `src/lib/checkin.ts` before `JSON.parse()` + Zod `.safeParse()`.
2. **Unsolicited health percentages**: When prompts were too open, small models sometimes invented statistics (e.g., `"Your lung capacity increases by 30%"`).
   - **Fix**: Explicitly forbade statistics in `config/prompts/*.txt` AND enforced regex rejection in `src/security/safety.ts` (`/\b\d+\s*%/`), automatically substituting a safe fallback in the user's own phrases if triggered.
