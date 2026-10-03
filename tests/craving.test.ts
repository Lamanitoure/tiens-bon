import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import demoProfile from '../demo/profile.demo.json';
import { addEvent, getAllEvents, resetDatabase } from '../src/db/index.ts';
import { computeUserStats } from '../src/lib/stats.ts';
import type { EventRecord } from '../src/schemas/events.ts';
import type { Profile } from '../src/schemas/profile.ts';
import { getRandomFallback } from '../src/security/safety.ts';

describe('Craving Workflow & Stats (Step 6)', () => {
  const profile = demoProfile as unknown as Profile;

  beforeEach(async () => {
    await resetDatabase();
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

  it('provides offline fallback challenge and message without server', () => {
    const frFallback = getRandomFallback('fr');
    expect(frFallback.challenge).toBeTruthy();
    expect(frFallback.message).toBeTruthy();

    const enFallback = getRandomFallback('en');
    expect(enFallback.challenge).toBeTruthy();
    expect(enFallback.message).toBeTruthy();
  });

  it('logs resisted and relapse events directly into IndexedDB', async () => {
    await addEvent({
      id: 'craving-1',
      ts: Date.now(),
      type: 'resisted',
      trigger: 'Boire un grand verre d eau',
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
    expect(all[1].type).toBe('relapse');
  });
});
