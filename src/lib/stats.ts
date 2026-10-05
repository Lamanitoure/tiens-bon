import type { EventRecord } from '../schemas/events.ts';
import type { Profile } from '../schemas/profile.ts';

export interface UserStats {
  resistedCount: number;
  relapseCount: number;
  streakDays: number;
  streakHours: number;
  streakMinutes: number;
  bestStreakDays: number;
  avoidedCigarettes: number;
  moneySaved: number;
  savingsGoalProgress: number; // 0 to 100
}

export function computeUserStats(
  profile: Profile | null,
  events: EventRecord[],
  nowTs: number = Date.now(),
): UserStats {
  if (!profile) {
    return {
      resistedCount: 0,
      relapseCount: 0,
      streakDays: 0,
      streakHours: 0,
      streakMinutes: 0,
      bestStreakDays: 0,
      avoidedCigarettes: 0,
      moneySaved: 0,
      savingsGoalProgress: 0,
    };
  }

  const sortedEvents = [...events].sort((a, b) => a.ts - b.ts);
  let resistedCount = 0;
  let relapseCount = 0;
  let lastRelapseTs: number | null = null;

  for (const ev of sortedEvents) {
    if (ev.type === 'resisted') {
      resistedCount++;
    } else if (ev.type === 'relapse') {
      relapseCount++;
      lastRelapseTs = ev.ts;
    } else if (ev.type === 'checkin') {
      if (ev.debrief?.outcome === 'resisted') {
        resistedCount++;
      } else if (ev.debrief?.outcome === 'smoked') {
        relapseCount++;
        lastRelapseTs = ev.ts;
      }
    }
  }

  const quitDateTs = new Date(profile.quitDate).getTime() || nowTs;
  const streakStartTs = lastRelapseTs ? Math.max(lastRelapseTs, quitDateTs) : quitDateTs;
  const streakMs = Math.max(0, nowTs - streakStartTs);

  const totalMinutes = Math.floor(streakMs / (1000 * 60));
  const streakHours = Math.floor(totalMinutes / 60);
  const streakDays = Math.floor(streakHours / 24);
  const streakMinutes = totalMinutes % 60;

  // Best streak calculation
  let bestStreakMs = streakMs;
  let currentRunStart = quitDateTs;

  for (const ev of sortedEvents) {
    const isSlip =
      ev.type === 'relapse' || (ev.type === 'checkin' && ev.debrief?.outcome === 'smoked');
    if (isSlip) {
      const runDuration = Math.max(0, ev.ts - currentRunStart);
      if (runDuration > bestStreakMs) {
        bestStreakMs = runDuration;
      }
      currentRunStart = ev.ts;
    }
  }
  const lastRun = Math.max(0, nowTs - currentRunStart);
  if (lastRun > bestStreakMs) {
    bestStreakMs = lastRun;
  }
  const bestStreakDays = Math.max(streakDays, Math.floor(bestStreakMs / (1000 * 60 * 60 * 24)));

  // Avoided cigarettes calculation:
  // Base rate from quitDate minus any relapses, with at least resisted cravings count.
  const elapsedDaysFromQuit = Math.max(0, (nowTs - quitDateTs) / (1000 * 60 * 60 * 24));
  const expectedPuffed = Math.round(elapsedDaysFromQuit * profile.unitsPerDay);
  const avoidedCigarettes = Math.max(resistedCount, expectedPuffed - relapseCount);

  // Money saved
  const moneySaved = Math.max(0, Math.round(avoidedCigarettes * profile.unitPrice * 100) / 100);

  // Savings goal progress
  const target = profile.savingsGoal.amount || 1;
  const savingsGoalProgress = Math.min(100, Math.round((moneySaved / target) * 100));

  return {
    resistedCount,
    relapseCount,
    streakDays,
    streakHours,
    streakMinutes,
    bestStreakDays,
    avoidedCigarettes,
    moneySaved,
    savingsGoalProgress,
  };
}
