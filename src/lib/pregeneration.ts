import {
  addPregeneratedMessage,
  getStoredProfile,
  getUnusedPregenerated,
  markPregeneratedUsed,
} from '../db/index.ts';
import type { CravingOutput } from '../schemas/model.ts';
import type { PregeneratedMessage } from '../schemas/pregenerated.ts';
import type { Profile } from '../schemas/profile.ts';
import { getRandomFallback, validateModelOutput } from '../security/safety.ts';
import { checkModelStatus, generateMotivation } from './api.ts';
import { activeConfig } from './config.ts';

export interface BatchItemPlan {
  category: 'morning' | 'risk_window' | 'craving' | 'evening';
  context: string;
  prompt: string;
  fallbackChallenge: string;
  fallbackMessage: string;
}

/**
 * Builds personalized fallback messages directly from her own phrases and alternatives (Step 9).
 * Used when the model/PC is unreachable (e.g. offline, airplane mode).
 */
export function buildPersonalizedFallback(
  profile: Profile,
  category: 'morning' | 'risk_window' | 'craving' | 'evening' = 'craving',
): CravingOutput {
  const lang = profile.language || 'fr';
  const defaultFallback = getRandomFallback(lang);

  // 1. Pick a phrase in her own voice
  let phrase = defaultFallback.message;
  if (profile.phrases && profile.phrases.length > 0) {
    const randomPhrase = profile.phrases[Math.floor(Math.random() * profile.phrases.length)];
    if (randomPhrase && randomPhrase.trim().length > 0) {
      phrase = randomPhrase.trim();
    }
  }

  // 2. Pick one of her preferred concrete alternatives
  let challenge = defaultFallback.challenge;
  if (profile.alternatives && profile.alternatives.length > 0) {
    const randomAlt = profile.alternatives[Math.floor(Math.random() * profile.alternatives.length)];
    if (randomAlt && randomAlt.trim().length > 0) {
      challenge = randomAlt.trim();
    }
  }

  // Special adjustments for specific categories
  if (category === 'morning') {
    challenge =
      lang === 'fr'
        ? `Boire un grand verre d'eau tiède et respirer : ${challenge}`
        : `Drink a tall glass of warm water and breathe: ${challenge}`;
  } else if (category === 'evening') {
    challenge =
      lang === 'fr'
        ? `Prendre un temps calme de gratitude : ${challenge}`
        : `Take a quiet moment of gratitude: ${challenge}`;
  }

  const rawOutput: CravingOutput = {
    challenge,
    message: phrase,
  };

  const validation = validateModelOutput(rawOutput, lang);
  return validation.sanitized;
}

/**
 * Builds plans for the daily pregeneration batch based on config contexts and batch size.
 */
export function buildBatchPlans(profile: Profile): BatchItemPlan[] {
  const plans: BatchItemPlan[] = [];
  const lang = profile.language;
  const tone = profile.tone;
  const reasons = profile.reasons.join(', ');
  const alts = profile.alternatives;
  const contextsList = activeConfig.app.contextsList || [
    'morning_coffee',
    'after_meal',
    'work_break',
    'stress',
    'evening_relaxation',
    'social',
  ];
  const targetBatchSize = activeConfig.app.batchSize || 10;

  // 1. Morning motivation (1)
  const defaultMorningMsg =
    lang === 'fr'
      ? 'Une nouvelle journée commence, chaque respiration libre est une victoire pour toi.'
      : 'A new day begins, every clean breath is a victory for you.';
  const defaultMorningChallenge =
    lang === 'fr'
      ? 'Boire un grand verre d eau tiède et respirer profondément à la fenêtre.'
      : 'Drink a tall glass of warm water and take 3 deep breaths at the window.';

  plans.push({
    category: 'morning',
    context: 'morning',
    prompt: `You are helping Camille wake up and start her smoke-free day with calm confidence. Her core reasons: ${reasons}. Tone: ${tone}. Write in ${lang}. Return JSON: {"challenge": "...", "message": "..."}`,
    fallbackChallenge: defaultMorningChallenge,
    fallbackMessage:
      profile.phrases.length > 0
        ? `${profile.phrases[0]} ${defaultMorningMsg}`.slice(0, 500)
        : defaultMorningMsg,
  });

  // 2. Risk windows from profile (one per window)
  for (const rw of profile.riskWindows) {
    const randomAlt =
      alts.length > 0 ? alts[Math.floor(Math.random() * alts.length)] : 'Marcher 5 minutes';
    plans.push({
      category: 'risk_window',
      context: `risk_window:${rw.time}_${rw.label}`,
      prompt: `Camille approaches her usual risk window: ${rw.time} (${rw.label}). Suggest an alternative activity like: ${alts.join(', ')}. Tone: ${tone}. Write in ${lang}. Return JSON: {"challenge": "...", "message": "..."}`,
      fallbackChallenge: `${randomAlt} (${rw.label})`,
      fallbackMessage:
        lang === 'fr'
          ? `C'est le moment habituel de ${rw.label}. Tu as déjà toutes les ressources pour passer cette fenêtre sereinement.`
          : `This is your usual ${rw.label} window. You have everything you need to pass through calmly.`,
    });
  }

  // 3. Contextual craving responses from config contexts
  for (const ctx of contextsList) {
    const fallback = buildPersonalizedFallback(profile, 'craving');
    plans.push({
      category: 'craving',
      context: `craving:${ctx}`,
      prompt: `Camille is experiencing a craving in context "${ctx}". Alternatives she enjoys: ${alts.join(', ')}. Tone: ${tone}. Write in ${lang}. Return JSON: {"challenge": "...", "message": "..."}`,
      fallbackChallenge: fallback.challenge,
      fallbackMessage: fallback.message,
    });
  }

  // 4. Evening check-ins (2)
  plans.push({
    category: 'evening',
    context: 'evening:reflection',
    prompt: `Camille reaches the evening after holding on all day. Tone: ${tone}. Write in ${lang}. Return JSON: {"challenge": "...", "message": "..."}`,
    fallbackChallenge:
      lang === 'fr'
        ? 'Prendre un instant pour te féliciter de chaque vague traversée aujourd hui.'
        : 'Take a quiet moment to congratulate yourself for every wave you weathered today.',
    fallbackMessage:
      lang === 'fr'
        ? 'Une journée de plus sans fumée. Sois fière de toi avant de t endormir.'
        : 'One more smoke-free day in the books. Be proud of yourself tonight.',
  });

  plans.push({
    category: 'evening',
    context: 'evening:gratitude',
    prompt: `Camille prepares for rest. Encourage restful sleep and self-compassion. Tone: ${tone}. Write in ${lang}. Return JSON: {"challenge": "...", "message": "..."}`,
    fallbackChallenge:
      lang === 'fr'
        ? 'Poser les mains sur le ventre et écouter 5 respirations calmes.'
        : 'Rest your hands on your belly and observe 5 calm breaths.',
    fallbackMessage:
      lang === 'fr'
        ? 'Ton corps s est régénéré toute la journée. Repose-toi en paix, tu as été formidable.'
        : 'Your lungs regenerated all day. Rest peacefully, you did amazing.',
  });

  // 5. Ensure batch size reaches at least targetBatchSize
  let extraIndex = 0;
  while (plans.length < targetBatchSize) {
    extraIndex++;
    const fallback = buildPersonalizedFallback(profile, 'craving');
    plans.push({
      category: 'craving',
      context: `craving:extra_${extraIndex}`,
      prompt: `Camille needs immediate craving support. Focus on quick distraction. Tone: ${tone}. Write in ${lang}. Return JSON: {"challenge": "...", "message": "..."}`,
      fallbackChallenge: fallback.challenge,
      fallbackMessage: fallback.message,
    });
  }

  return plans;
}

/**
 * Generates a full daily batch, validating each item with Zod and safety filters before storing.
 */
export async function generateDailyBatch(
  profile: Profile,
  onProgress?: (current: number, total: number) => void,
): Promise<PregeneratedMessage[]> {
  const plans = buildBatchPlans(profile);
  const results: PregeneratedMessage[] = [];
  const now = Date.now();

  for (let i = 0; i < plans.length; i++) {
    const item = plans[i];
    if (onProgress) {
      onProgress(i + 1, plans.length);
    }

    let challenge = item.fallbackChallenge;
    let message = item.fallbackMessage;

    try {
      const rawOutput = await generateMotivation(item.prompt);
      const validated = validateModelOutput(rawOutput, profile.language);
      if (validated.sanitized?.challenge && validated.sanitized?.message) {
        challenge = validated.sanitized.challenge;
        message = validated.sanitized.message;
      }
    } catch (_err) {
      // Offline fallback: Use the personalized fallback in her voice
    }

    const pregenMsg: PregeneratedMessage = {
      id: `pregen-${now}-${i}-${Math.random().toString(36).substring(2, 6)}`,
      context: item.context,
      tone: profile.tone,
      language: profile.language,
      challenge,
      message,
      createdTs: now,
      shownCount: 0,
      category: item.category,
      used: false,
    };

    await addPregeneratedMessage(pregenMsg);
    results.push(pregenMsg);
  }

  return results;
}

/**
 * Triggers batch generation automatically if last batch is older than 20 hours.
 */
export function shouldTriggerAutomaticBatch(lastBatchTs: number | null): boolean {
  if (!lastBatchTs) return true;
  const elapsedMs = Date.now() - lastBatchTs;
  // Trigger if older than 20 hours (20 * 60 * 60 * 1000 = 72,000,000 ms)
  return elapsedMs > 20 * 60 * 60 * 1000;
}

// Background quiet refill flag to avoid concurrent refill runs
let isQuietRefilling = false;

/**
 * Quietly refills stock in the background when stock is low (Step 9).
 */
export async function refillQuietlyIfNeeded(profile: Profile): Promise<boolean> {
  if (isQuietRefilling) return false;

  try {
    const unusedCraving = await getUnusedPregenerated('craving');
    // If stock of craving messages is low (<= 2)
    if (unusedCraving.length <= 2) {
      const status = await checkModelStatus();
      if (status.ollama === 'ok') {
        isQuietRefilling = true;
        generateDailyBatch(profile)
          .then(() => {
            localStorage.setItem('tb_last_batch_ts', Date.now().toString());
          })
          .catch(() => {})
          .finally(() => {
            isQuietRefilling = false;
          });
        return true;
      }
    }
  } catch {
    // Non-blocking
  }
  return false;
}

/**
 * Serves the next pregenerated message from local storage with zero latency.
 * If offline or cache is exhausted, builds a personalized fallback in her voice.
 */
export async function getNextPregeneratedMessage(
  category: 'morning' | 'risk_window' | 'craving' | 'evening',
  profileOrLang?: Profile | 'fr' | 'en',
  langFallback: 'fr' | 'en' = 'fr',
): Promise<{ challenge: string; message: string; fromCache: boolean; isFallback?: boolean }> {
  let profile: Profile | null = null;
  let language: 'fr' | 'en' = langFallback;

  if (profileOrLang && typeof profileOrLang === 'object') {
    profile = profileOrLang;
    language = profile.language || 'fr';
  } else if (typeof profileOrLang === 'string') {
    language = profileOrLang;
  }

  try {
    const unused = await getUnusedPregenerated(category);
    if (unused.length > 0) {
      const selected = unused[0];
      await markPregeneratedUsed(selected.id);

      // Check for quiet refill in background if profile is known
      if (profile) {
        refillQuietlyIfNeeded(profile).catch(() => {});
      } else {
        getStoredProfile()
          .then((stored) => {
            if (stored) refillQuietlyIfNeeded(stored).catch(() => {});
          })
          .catch(() => {});
      }

      return {
        challenge: selected.challenge,
        message: selected.message,
        fromCache: true,
      };
    }
  } catch (_err) {
    // IndexedDB error or unavailable
  }

  // If cache is empty or offline, generate personalized fallback
  if (!profile) {
    try {
      profile = await getStoredProfile();
    } catch {
      // ignore
    }
  }

  if (profile) {
    const fallback = buildPersonalizedFallback(profile, category);
    return {
      challenge: fallback.challenge,
      message: fallback.message,
      fromCache: false,
      isFallback: true,
    };
  }

  const standardFallback = getRandomFallback(language);
  return {
    challenge: standardFallback.challenge,
    message: standardFallback.message,
    fromCache: false,
    isFallback: true,
  };
}
