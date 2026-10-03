import type { EventRecord } from '../schemas/events.ts';
import type { Profile } from '../schemas/profile.ts';
import { activeConfig } from './config.ts';
import { calculateReminderTime } from './reminders.ts';

export interface WeeklyStats {
  totalEvents: number;
  resistedCount: number;
  relapseCount: number;
  resistedRate: number;
  topTriggers: Array<{ trigger: string; count: number }>;
  savingsToDate: number;
  currency: string;
  goalProgress: number;
  daysSinceQuit: number;
}

export interface ProposedRiskWindow {
  time: string;
  reminderTime: string;
  label: string;
  count: number;
  rationale: string;
}

/**
 * Computes weekly aggregation of events (Step 16).
 * Calculates resisted count, top triggers, savings to date against goal.
 */
export function computeWeeklyStats(
  events: EventRecord[],
  profile: Profile,
  now = Date.now(),
): WeeklyStats {
  const oneWeekAgo = now - 7 * 24 * 60 * 60 * 1000;
  const weeklyEvents = events.filter((e) => e.ts >= oneWeekAgo);

  let resistedCount = 0;
  let relapseCount = 0;
  const triggerMap: Record<string, number> = {};

  for (const evt of weeklyEvents) {
    if (evt.type === 'resisted') {
      resistedCount++;
    } else if (evt.type === 'relapse') {
      relapseCount++;
    } else if (evt.type === 'checkin') {
      if (evt.debrief?.outcome === 'resisted') {
        resistedCount++;
      } else if (evt.debrief?.outcome === 'smoked') {
        relapseCount++;
      }
    }

    if (evt.trigger && evt.trigger.trim().length > 0) {
      const cleanTrigger = evt.trigger.trim();
      triggerMap[cleanTrigger] = (triggerMap[cleanTrigger] || 0) + 1;
    }
  }

  const totalEvents = weeklyEvents.length;
  const totalDecided = resistedCount + relapseCount;
  const resistedRate = totalDecided > 0 ? Math.round((resistedCount / totalDecided) * 100) : 100;

  const topTriggers = Object.entries(triggerMap)
    .map(([trigger, count]) => ({ trigger, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 3);

  // Savings calculation
  const quitTs = new Date(profile.quitDate).getTime();
  const msDiff = Math.max(0, now - quitTs);
  const daysSinceQuit = Math.max(1, Math.floor(msDiff / (1000 * 60 * 60 * 24)));

  const dailyCost = profile.unitsPerDay * profile.unitPrice;
  const rawSavings = daysSinceQuit * dailyCost;
  // Deduct relapses if recorded
  const allRelapses = events.filter(
    (e) => e.type === 'relapse' || (e.type === 'checkin' && e.debrief?.outcome === 'smoked'),
  ).length;
  const estimatedSavings = Math.max(
    0,
    Math.round((rawSavings - allRelapses * profile.unitPrice) * 100) / 100,
  );

  const goalAmount = profile.savingsGoal?.amount || 100;
  const goalProgress = Math.min(100, Math.round((estimatedSavings / goalAmount) * 100));

  return {
    totalEvents,
    resistedCount,
    relapseCount,
    resistedRate,
    topTriggers,
    savingsToDate: estimatedSavings,
    currency: profile.currency || '€',
    goalProgress,
    daysSinceQuit,
  };
}

/**
 * Parses "HH:mm" to total minutes in day.
 */
function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map((x) => parseInt(x, 10));
  if (Number.isNaN(h) || Number.isNaN(m)) return 0;
  return h * 60 + m;
}

/**
 * Detects recurring craving moments at similar hours (Step 16).
 * If a trigger recurs >= minEvents at a similar hour, proposes adding it as a risk window.
 * INVARIANT: Never added silently; returns a list of proposed windows requiring explicit confirmation.
 */
export function detectLearnedRiskWindows(
  events: EventRecord[],
  profile: Profile,
  minEvents?: number,
): ProposedRiskWindow[] {
  const threshold = minEvents ?? activeConfig.app.minEventsBeforeLearnedWindow ?? 5;
  const leadTime = activeConfig.app.reminderLeadTimeMinutes ?? 10;
  const isEn = profile.language === 'en';

  // Group events by hour of the day
  const hourMap: Record<number, { count: number; triggers: Record<string, number> }> = {};

  for (const evt of events) {
    // Only analyze cravings, resisted, or checkins with triggers
    if (
      evt.type === 'relapse' ||
      evt.type === 'resisted' ||
      evt.type === 'craving' ||
      evt.type === 'checkin'
    ) {
      const date = new Date(evt.ts);
      const hour = date.getHours();

      if (!hourMap[hour]) {
        hourMap[hour] = { count: 0, triggers: {} };
      }
      hourMap[hour].count++;

      if (evt.trigger) {
        const trig = evt.trigger.trim();
        hourMap[hour].triggers[trig] = (hourMap[hour].triggers[trig] || 0) + 1;
      }
    }
  }

  const proposals: ProposedRiskWindow[] = [];

  for (const [hourStr, data] of Object.entries(hourMap)) {
    const hour = parseInt(hourStr, 10);
    if (data.count < threshold) continue;

    const proposedTime = `${hour.toString().padStart(2, '0')}:00`;
    const proposedMins = hour * 60;

    // Check if profile.riskWindows already covers this window within 45 minutes
    const alreadyCovered = profile.riskWindows.some((rw) => {
      const rwMins = timeToMinutes(rw.time);
      return Math.abs(rwMins - proposedMins) <= 45;
    });

    if (alreadyCovered) continue;

    // Find the most frequent trigger at this hour
    const topTrig = Object.entries(data.triggers).sort((a, b) => b[1] - a[1])[0]?.[0];
    const label = topTrig
      ? isEn
        ? `${topTrig} (learned)`
        : `${topTrig} (habits observés)`
      : isEn
        ? `Afternoon break (${proposedTime})`
        : `Moment récurrent (${proposedTime})`;

    const reminderTime = calculateReminderTime(proposedTime, leadTime);

    const rationale = isEn
      ? `You often have cravings around ${proposedTime} (${data.count} times). Want a reminder at ${reminderTime}?`
      : `Tu as souvent des envies vers ${proposedTime} (${data.count} fois). Veux-tu ajouter un rappel à ${reminderTime} ?`;

    proposals.push({
      time: proposedTime,
      reminderTime,
      label,
      count: data.count,
      rationale,
    });
  }

  return proposals;
}

/**
 * Builds the prompt template for the optional short encouraging weekly recap (config/prompts/recap.txt).
 */
export function buildRecapPrompt(stats: WeeklyStats, profile: Profile): string {
  const hardest =
    stats.topTriggers.length > 0
      ? stats.topTriggers.map((t) => `${t.trigger} (${t.count})`).join(', ')
      : 'moments imprévus';

  return (
    'Given numbers computed by code, write a short recap in her tone starting with what worked.\n' +
    `Resisted: ${stats.resistedCount}\n` +
    `Money saved: ${stats.savingsToDate} ${stats.currency}\n` +
    `Hardest moments: ${hardest}\n` +
    'Rules: Start with what worked. Use the numbers exactly as given and never add or change a number.\n' +
    `Tone: ${profile.tone}. Write in ${profile.language}. At most 3 sentences.\n` +
    'No medical advice, no reproach.'
  );
}
