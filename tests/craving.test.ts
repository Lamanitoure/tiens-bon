import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import demoProfile from '../demo/profile.demo.json';
import { addEvent, getAllEvents, resetDatabase, setStoredProfile } from '../src/db/index.ts';
import { getAvailableContextChips, suggestContextFromTime } from '../src/lib/craving.ts';
import { getNextPregeneratedMessage } from '../src/lib/pregeneration.ts';
import { computeUserStats } from '../src/lib/stats.ts';
import type { EventRecord } from '../src/schemas/events.ts';
import type { Profile } from '../src/schemas/profile.ts';

describe('The craving screen (Step 10)', () => {
  const profile = demoProfile as unknown as Profile;

  beforeEach(async () => {
    await resetDatabase();
    await setStoredProfile(profile);
  });

  it('suggests the right context based on proximity to personal risk windows', () => {
    // profile.riskWindows has:
    // { label: "Café du matin", time: "08:15" }
    // { label: "Pause de milieu de matinée", time: "10:30" }
    // { label: "Fin du déjeuner", time: "13:45" }
    // { label: "Décompression fin de journée", time: "18:30" }

    // Test time: 08:20 (within 5 minutes of Café du matin)
    const morningDate = new Date(2026, 9, 4, 8, 20);
    const suggestedMorning = suggestContextFromTime(profile, morningDate);
    expect(suggestedMorning).toBe('Café du matin');

    // Test time: 13:50 (within 5 minutes of Fin du déjeuner)
    const lunchDate = new Date(2026, 9, 4, 13, 50);
    const suggestedLunch = suggestContextFromTime(profile, lunchDate);
    expect(suggestedLunch).toBe('Fin du déjeuner');

    // Test time: 18:25 (within 5 minutes of Décompression fin de journée)
    const eveningDate = new Date(2026, 9, 4, 18, 25);
    const suggestedEvening = suggestContextFromTime(profile, eveningDate);
    expect(suggestedEvening).toBe('Décompression fin de journée');

    // Test time: 15:30 (not near any window, in afternoon)
    const afternoonDate = new Date(2026, 9, 4, 15, 30);
    const suggestedAfternoon = suggestContextFromTime(profile, afternoonDate);
    expect(suggestedAfternoon).toBe('Pause de l’après-midi');
  });

  it('provides quick trigger chips including her risk windows and common triggers', () => {
    const chips = getAvailableContextChips(profile);
    expect(chips.length).toBeGreaterThanOrEqual(5);

    // Contains her customized risk window labels
    expect(chips).toContain('Café du matin');
    expect(chips).toContain('Fin du déjeuner');

    // Contains common contextual triggers
    expect(chips).toContain('Coup de stress');
  });

  it('resolves instant challenge and message in under 100 ms completely offline', async () => {
    const start = performance.now();
    const result = await getNextPregeneratedMessage('craving', profile);
    const elapsed = performance.now() - start;

    expect(elapsed).toBeLessThan(100);
    expect(result.challenge).toBeTruthy();
    expect(result.message).toBeTruthy();
    expect(profile.phrases).toContain(result.message);
  });

  it('computes stats correctly when cravings are resisted', () => {
    const fixedNow = new Date('2026-10-04T12:00:00.000Z').getTime();
    const events: EventRecord[] = [
      { id: 'ev1', ts: fixedNow - 3600000 * 2, type: 'resisted', trigger: 'coffee' },
      { id: 'ev2', ts: fixedNow - 3600000, type: 'resisted', trigger: 'break' },
    ];

    const stats = computeUserStats(profile, events, fixedNow);
    expect(stats.resistedCount).toBe(2);
    expect(stats.relapseCount).toBe(0);
    expect(stats.avoidedCigarettes).toBeGreaterThanOrEqual(2);
    expect(stats.moneySaved).toBeGreaterThan(0);
  });

  it('resets current streak upon relapse without wiping historical count', () => {
    const fixedNow = new Date('2026-10-04T12:00:00.000Z').getTime();
    const events: EventRecord[] = [
      { id: 'ev1', ts: fixedNow - 3600000 * 20, type: 'resisted' },
      { id: 'ev2', ts: fixedNow - 3600000 * 10, type: 'resisted' },
      { id: 'ev3', ts: fixedNow - 3600000 * 2, type: 'relapse' },
      { id: 'ev4', ts: fixedNow - 3600000 * 1, type: 'resisted' },
    ];

    const stats = computeUserStats(profile, events, fixedNow);
    expect(stats.resistedCount).toBe(3);
    expect(stats.relapseCount).toBe(1);
    expect(stats.streakHours).toBe(2);
  });

  it('logs resisted and relapse events directly into IndexedDB with context', async () => {
    await addEvent({
      id: 'craving-1',
      ts: Date.now(),
      type: 'resisted',
      trigger: 'Café du matin',
    });

    await addEvent({
      id: 'craving-2',
      ts: Date.now() + 1000,
      type: 'relapse',
      trigger: 'Soirée entre amis',
    });

    const all = await getAllEvents();
    expect(all.length).toBe(2);
    expect(all[0].type).toBe('resisted');
    expect(all[0].trigger).toBe('Café du matin');
    expect(all[1].type).toBe('relapse');
    expect(all[1].trigger).toBe('Soirée entre amis');
  });
});
