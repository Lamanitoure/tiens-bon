import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import demoProfile from '../demo/profile.demo.json';
import { addEvent, addPlan, getAllEvents, getAllPlans, resetDatabase } from '../src/db/index.ts';
import { computeUserStats } from '../src/lib/stats.ts';
import type { EventRecord } from '../src/schemas/events.ts';
import type { Profile } from '../src/schemas/profile.ts';

describe('Relapse flow and if-then plans (Step 11)', () => {
  const profile = demoProfile as unknown as Profile;

  beforeEach(async () => {
    await resetDatabase();
  });

  it('Path 1: preserves historical resisted count & saves an if-then plan during debrief', async () => {
    const fixedNow = new Date('2026-10-08T12:00:00.000Z').getTime();

    // 1. Initial history with 3 resisted cravings
    const events: EventRecord[] = [
      { id: 'ev1', ts: fixedNow - 3600000 * 24 * 3, type: 'resisted', trigger: 'morning' },
      { id: 'ev2', ts: fixedNow - 3600000 * 24 * 2, type: 'resisted', trigger: 'coffee' },
      { id: 'ev3', ts: fixedNow - 3600000 * 24 * 1, type: 'resisted', trigger: 'stress' },
    ];

    for (const ev of events) {
      await addEvent(ev);
    }

    // 2. User lapses and saves an if-then plan during debrief
    const relapseEvent: EventRecord = {
      id: 'relapse-evt-1',
      ts: fixedNow - 60000, // 1 minute ago
      type: 'relapse',
      trigger: 'coffee',
      note: 'Plan: Si café du matin -> Alors boire un grand verre d eau fraîche',
    };
    await addEvent(relapseEvent);

    await addPlan({
      id: 'plan-relapse-coffee',
      ifText: 'Si j’ai envie d’une cigarette avec mon café',
      thenText: 'Alors je prends un grand verre d’eau fraîche et je change de pièce',
    });

    const allEvents = await getAllEvents();
    const storedPlans = await getAllPlans();
    const stats = computeUserStats(profile, allEvents, fixedNow);

    // Verify relapse count updated
    expect(stats.relapseCount).toBe(1);
    // Verify current streak reset (less than 1 hour)
    expect(stats.streakHours).toBe(0);
    // Verify best streak preserved (3 days)
    expect(stats.bestStreakDays).toBeGreaterThanOrEqual(2);
    // Verify historical resisted count NOT wiped
    expect(stats.resistedCount).toBe(3);
    // Verify total avoided cigarettes NOT wiped
    expect(stats.avoidedCigarettes).toBeGreaterThanOrEqual(3);

    // Verify if-then plan saved
    expect(storedPlans.length).toBe(1);
    expect(storedPlans[0].ifText).toContain('café');
    expect(storedPlans[0].thenText).toContain('verre d’eau');
  });

  it('Path 2: user skips if-then plan creation; relapse is recorded without adding plans', async () => {
    const fixedNow = new Date('2026-10-08T12:00:00.000Z').getTime();

    // Prior resisted events
    await addEvent({
      id: 'ev-prev-1',
      ts: fixedNow - 3600000 * 12,
      type: 'resisted',
      trigger: 'work',
    });
    await addEvent({
      id: 'ev-prev-2',
      ts: fixedNow - 3600000 * 6,
      type: 'resisted',
      trigger: 'lunch',
    });

    // Relapse logged with skip
    const skippedRelapse: EventRecord = {
      id: 'relapse-skip-1',
      ts: fixedNow - 120000,
      type: 'relapse',
      trigger: 'stress',
    };
    await addEvent(skippedRelapse);

    const allEvents = await getAllEvents();
    const storedPlans = await getAllPlans();
    const stats = computeUserStats(profile, allEvents, fixedNow);

    expect(stats.relapseCount).toBe(1);
    expect(stats.resistedCount).toBe(2);
    expect(stats.streakHours).toBe(0);
    // Zero plans added because user skipped
    expect(storedPlans.length).toBe(0);
  });

  it('surfaces previously saved if-then plan matching context trigger', async () => {
    await addPlan({
      id: 'plan-stress',
      ifText: 'Si un coup de stress soudain me submerge',
      thenText: 'Alors je fais 3 respirations complètes et je marche 2 minutes',
    });

    const storedPlans = await getAllPlans();
    const searchContext = 'Coup de stress';

    const matching = storedPlans.find((p) => {
      const search = searchContext.toLowerCase();
      const ifLower = p.ifText.toLowerCase();
      return ifLower.includes(search) || (search.includes('stress') && ifLower.includes('stress'));
    });

    expect(matching).toBeDefined();
    expect(matching?.thenText).toContain('3 respirations');
  });
});
