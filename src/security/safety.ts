import fallbackEn from '../../config/fallback/en.json';
import fallbackFr from '../../config/fallback/fr.json';
import { activeConfig } from '../lib/config.ts';
import type { CravingOutput } from '../schemas/model.ts';

function normalizeText(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove diacritics
    .trim();
}

/**
 * Section 8 Item 1: Keyword check by code, before any model call.
 * If distress is detected, immediately stops and shows helpline and support person.
 */
export function checkDistress(
  text: string,
  language: 'fr' | 'en' = 'fr',
): { isDistress: boolean; matchedWord?: string } {
  if (!text?.trim()) {
    return { isDistress: false };
  }

  const normalized = normalizeText(text);
  const wordList = activeConfig.distress.words[language] || activeConfig.distress.words.fr || [];

  for (const rawWord of wordList) {
    const target = normalizeText(rawWord);
    if (!target) continue;

    // Word boundary or substring check for full phrases
    const pattern = new RegExp(`(^|\\b|\\s)${target}(\\b|\\s|$)`, 'i');
    if (pattern.test(normalized) || normalized.includes(target)) {
      return { isDistress: true, matchedWord: rawWord };
    }
  }

  return { isDistress: false };
}

/**
 * Section 8 Item 2: Output safety filter.
 * Rejects percentages, health statistics, drug/medication names, dosages, predictions, or reproach.
 * If rejected, replaces with a fallback template.
 */
export function validateModelOutput(
  output: CravingOutput,
  language: 'fr' | 'en' = 'fr',
): { isValid: boolean; sanitized: CravingOutput; reason?: string } {
  const combinedText = `${output.challenge} ${output.message}`;
  const normalized = normalizeText(combinedText);

  // 1. Percentage check (e.g. 50%, 95 %)
  if (/\b\d{1,3}\s?%/i.test(combinedText)) {
    return getFallbackResponse('Detected percentage in model response', language);
  }

  // 2. Health statistics patterns
  if (/\b(statistic|statistique|risk reduced by|risque reduit de|chances de)\b/i.test(normalized)) {
    return getFallbackResponse('Detected health statistics claim', language);
  }

  // 3. Medication / drug / dosage patterns
  if (
    /\b(mg|milligram|dosage|dose|nicotine|champix|varenicline|bupropion|zyban|patch|gomme)\b/i.test(
      normalized,
    )
  ) {
    return getFallbackResponse('Detected drug or medication recommendation', language);
  }

  // 4. Prediction patterns ("you will", "tu vas")
  if (/\b(you will|tu vas|tu seras|vous allez|vous serez)\b/i.test(normalized)) {
    return getFallbackResponse('Detected predictive statement', language);
  }

  // 5. Reproach / guilt patterns
  if (
    /\b(shame on|fail|failed|disappointed|decu|honte|tu as echoue|tu aurais du|faible|loser|culpabilite|guilt)\b/i.test(
      normalized,
    )
  ) {
    return getFallbackResponse('Detected reproach or guilt-inducing phrase', language);
  }

  return {
    isValid: true,
    sanitized: output,
  };
}

export function getRandomFallback(language: 'fr' | 'en' = 'fr'): CravingOutput {
  const dataset = language === 'en' ? fallbackEn : fallbackFr;
  const messages = dataset.messages;
  const challenges = dataset.challenges;

  const randomMessage = messages[Math.floor(Math.random() * messages.length)];
  const randomChallenge = challenges[Math.floor(Math.random() * challenges.length)];

  return {
    challenge: randomChallenge,
    message: randomMessage,
  };
}

function getFallbackResponse(
  reason: string,
  language: 'fr' | 'en',
): { isValid: boolean; sanitized: CravingOutput; reason: string } {
  return {
    isValid: false,
    sanitized: getRandomFallback(language),
    reason,
  };
}
