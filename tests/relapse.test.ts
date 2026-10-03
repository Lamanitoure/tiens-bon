import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import demoProfile from '../demo/profile.demo.json';
import { addEvent, addPlan, getAllEvents, getAllPlans, resetDatabase } from '../src/db/index.ts';
import { computeUserStats } from '../src/lib/stats.ts';
import type { EventRecord } from '../src/schemas/events.ts';
import type { Profile } from '../src/schemas/profile.ts';

describe('Relapse Workflow & Non-Guilt Debrief (Step 7)', () => {
  const profile = demoProfile as unknown as Profile;

  beforeEach(async () => {
    await resetDatabase();
  });

  it('preserves best streak and avoided count when relapse occurs', () => {
    const fixedNow = new Date('2026-10-08T12:00:00.000Z').getTime();

    // Several days of resisted cravings, followed by a relapse 10 minutes ago
    const events: EventRecord[] = [
      { id: 'ev1', ts: fixedNow - 3600000 * 24 * 5, type: 'resisted', trigger: 'morning' },
      { id: 'ev2', ts: fixedNow - 3600000 * 24 * 3, type: 'resisted', trigger: 'coffee' },
      { id: 'ev3', ts: fixedNow - 3600000 * 24 * 1, type: 'resisted', trigger: 'stress' },
      {
        id: 'ev4',
        ts: fixedNow - 600000,
        type: 'relapse',
        trigger: 'coffee',
        note: 'Plan: Si café le matin -> Alors boire grand verre d eau',
      },
    ];

    const stats = computeUserStats(profile, events, fixedNow);

    // Current streak is less than 1 hour (relapse 10 mins ago)
    expect(stats.streakHours).toBe(0);
    // Best streak is preserved (at least 4-5 days)
    expect(stats.bestStreakDays).toBeGreaterThanOrEqual(4);
    // Total resisted count is preserved (3 resisted cravings)
    expect(stats.resistedCount).toBe(3);
    // Relapse count is recorded
    expect(stats.relapseCount).toBe(1);
    // Total avoided cigarettes is NOT wiped out
    expect(stats.avoidedCigarettes).toBeGreaterThanOrEqual(3);
  });

  it('saves an If/Then plan created during debrief into IndexedDB', async () => {
    const initialPlans = await getAllPlans();
    expect(initialPlans.length).toBe(0);

    await addPlan({
      id: 'plan-relapse-coffee',
      ifText: 'Si je bois un café le matin après le réveil',
      thenText: 'Alors je prends un grand verre d eau fraîche et je change de pièce',
    });

    const storedPlans = await getAllPlans();
    expect(storedPlans.length).toBe(1);
    expect(storedPlans[0].ifText).toContain('café');
    expect(storedPlans[0].thenText).toContain('verre d eau');
  });

  it('logs relapse event with debrief trigger and note into IndexedDB', async () => {
    const relapseEvent: EventRecord = {
      id: 'relapse-evt-1',
      ts: Date.now(),
      type: 'relapse',
      trigger: 'alcohol',
      note: 'Plan: Si soirée entre amis -> Alors commander un tonic glacé',
    };

    await addEvent(relapseEvent);
    const events = await getAllEvents();
    expect(events.length).toBe(1);
    expect(events[0].type).toBe('relapse');
    expect(events[0].trigger).toBe('alcohol');
    expect(events[0].note).toContain('tonic');
  });
});
