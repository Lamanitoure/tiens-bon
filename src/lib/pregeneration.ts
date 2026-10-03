import {
  addPregeneratedMessage,
  getUnusedPregenerated,
  markPregeneratedUsed,
} from '../db/index.ts';
import type { PregeneratedMessage } from '../schemas/pregenerated.ts';
import type { Profile } from '../schemas/profile.ts';
import { getRandomFallback, validateModelOutput } from '../security/safety.ts';
import { generateMotivation } from './api.ts';

export interface BatchItemPlan {
  category: 'morning' | 'risk_window' | 'craving' | 'evening';
  context: string;
  prompt: string;
  fallbackChallenge: string;
  fallbackMessage: string;
}

export function buildBatchPlans(profile: Profile): BatchItemPlan[] {
  const plans: BatchItemPlan[] = [];
  const lang = profile.language;
  const tone = profile.tone;
  const reasons = profile.reasons.join(', ');
  const alts = profile.alternatives;

  // 1. Morning motivation (1)
  plans.push({
    category: 'morning',
    context: 'morning',
    prompt: `You are helping Camille wake up and start her smoke-free day with calm confidence. Her core reasons: ${reasons}. Tone: ${tone}. Write in ${lang}. Return JSON: {"challenge": "...", "message": "..."}`,
    fallbackChallenge:
      lang === 'fr'
        ? 'Boire un grand verre d eau tiède et respirer profondément à la fenêtre.'
        : 'Drink a tall glass of warm water and take 3 deep breaths at the window.',
    fallbackMessage:
      lang === 'fr'
        ? 'Une nouvelle journée commence, chaque respiration libre est une victoire pour toi.'
        : 'A new day begins, every clean breath is a victory for you.',
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

  // 3. Generic craving responses (6 varied responses)
  const cravingPrompts = [
    {
      context: 'craving:sensory',
      focus: 'sensory anchor (drinking ice water, washing hands in cool water)',
      challengeFr:
        'Boire un grand verre d eau glacée lentement en observant la sensation de fraîcheur.',
      msgFr: 'Sens cette fraîcheur pure descendre. Ton corps te remercie de chaque gorgée.',
    },
    {
      context: 'craving:movement',
      focus: 'movement anchor (stretching shoulders, walking briskly)',
      challengeFr: 'Faire 10 rotations lentes des épaules et étirer les bras vers le ciel.',
      msgFr:
        'Décharge la tension musculaire. L envie n est qu une vague passagère qui va redescendre.',
    },
    {
      context: 'craving:distraction',
      focus: 'puzzle or mental engagement (counting 5 objects of green color)',
      challengeFr: 'Identifier 5 objets de couleur verte autour de toi et observer leurs détails.',
      msgFr: 'Ton cerveau se reconnecte au présent. Tu es maître de ton attention.',
    },
    {
      context: 'craving:connection',
      focus: 'support or writing a gentle thought',
      challengeFr: 'Écrire un mot doux à une personne que tu aimes ou noter ta fierté du jour.',
      msgFr: 'Chaque envie surmontée consolide ta liberté et protège ceux qui comptent pour toi.',
    },
    {
      context: 'craving:breath',
      focus: 'calming 4-7-8 breathing',
      challengeFr: 'Faire 4 cycles de respiration lente : inspire sur 4, expire sur 6.',
      msgFr: 'Ton rythme cardiaque s apaise. Tu es en sécurité, l envie s éloigne.',
    },
    {
      context: 'craving:comfort',
      focus: 'comfort tea or warm infusion',
      challengeFr:
        'Préparer une infusion ou un thé chaud et savourer la première gorgée sans hâte.',
      msgFr: 'Offre-toi ce moment de réconfort sans fumée. Tu mérites cette douceur.',
    },
  ];

  for (const cp of cravingPrompts) {
    plans.push({
      category: 'craving',
      context: cp.context,
      prompt: `Camille is experiencing a strong urge right now. Focus: ${cp.focus}. Tone: ${tone}. Write in ${lang}. Return JSON: {"challenge": "...", "message": "..."}`,
      fallbackChallenge: cp.challengeFr,
      fallbackMessage: cp.msgFr,
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

  return plans;
}

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
      // Offline fallback: Use the safe pre-tested fallback
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

export function shouldTriggerAutomaticBatch(lastBatchTs: number | null): boolean {
  if (!lastBatchTs) return true;
  const elapsedMs = Date.now() - lastBatchTs;
  // Trigger if older than 20 hours (20 * 60 * 60 * 1000 = 72,000,000 ms)
  return elapsedMs > 20 * 60 * 60 * 1000;
}

export async function getNextPregeneratedMessage(
  category: 'morning' | 'risk_window' | 'craving' | 'evening',
  language: 'fr' | 'en' = 'fr',
): Promise<{ challenge: string; message: string; fromCache: boolean }> {
  try {
    const unused = await getUnusedPregenerated(category);
    if (unused.length > 0) {
      const selected = unused[0];
      await markPregeneratedUsed(selected.id);
      return {
        challenge: selected.challenge,
        message: selected.message,
        fromCache: true,
      };
    }
  } catch (_err) {
    // ignore
  }

  const fallback = getRandomFallback(language);
  return {
    challenge: fallback.challenge,
    message: fallback.message,
    fromCache: false,
  };
}
