import type { Profile } from '../schemas/profile.ts';
import { getStoredToken } from './api.ts';
import { buildRecapPrompt, type WeeklyStats } from './recap.ts';

/**
 * Generates an optional short encouraging weekly recap via Gemma (Step 16).
 * Uses local deterministic fallback if model is unreachable or offline.
 */
export async function generateWeeklyRecap(stats: WeeklyStats, profile: Profile): Promise<string> {
  const isEn = profile.language === 'en';
  const defaultFallback = isEn
    ? `You successfully navigated ${stats.resistedCount} cravings this week and saved ${stats.savingsToDate} ${stats.currency}. Every step forward builds your lasting freedom.`
    : `Tu as surmonté avec succès ${stats.resistedCount} envies cette semaine et économisé ${stats.savingsToDate} ${stats.currency}. Chaque victoire consolide ta liberté durable.`;

  const token = getStoredToken();
  if (!token) {
    return defaultFallback;
  }

  const prompt = buildRecapPrompt(stats, profile);

  try {
    const res = await fetch('/api/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        prompt,
        expected_format: 'recap',
      }),
    });

    if (!res.ok) {
      return defaultFallback;
    }

    const data = await res.json();
    if (typeof data.message === 'string' && data.message.trim().length > 0) {
      return data.message.trim();
    }

    return defaultFallback;
  } catch {
    return defaultFallback;
  }
}
