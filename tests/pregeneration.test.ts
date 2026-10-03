import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import demoProfile from '../demo/profile.demo.json';
import {
  clearPregenerated,
  getAllPregenerated,
  getUnusedPregenerated,
  resetDatabase,
} from '../src/db/index.ts';
import {
  buildBatchPlans,
  generateDailyBatch,
  getNextPregeneratedMessage,
  shouldTriggerAutomaticBatch,
} from '../src/lib/pregeneration.ts';
import type { Profile } from '../src/schemas/profile.ts';

describe('Batch Pregeneration (Step 8)', () => {
  const profile = demoProfile as unknown as Profile;

  beforeEach(async () => {
    await resetDatabase();
    await clearPregenerated();
  });

  it('builds a full batch plan covering morning, all risk windows, cravings, and evening', () => {
    const plans = buildBatchPlans(profile);

    // Profile has 3 risk windows: 1 morning + 3 risk windows + 6 cravings + 2 evening = 12 items
    expect(plans.length).toBeGreaterThanOrEqual(10);

    const categories = plans.map((p) => p.category);
    expect(categories).toContain('morning');
    expect(categories).toContain('risk_window');
    expect(categories).toContain('craving');
    expect(categories).toContain('evening');

    // Risk windows count match profile
    const riskWindowPlans = plans.filter((p) => p.category === 'risk_window');
    expect(riskWindowPlans.length).toBe(profile.riskWindows.length);
  });

  it('generates and stores batch in IndexedDB pregenerated store', async () => {
    let progressUpdates = 0;
    const batch = await generateDailyBatch(profile, (current, total) => {
      progressUpdates++;
      expect(current).toBeLessThanOrEqual(total);
    });

    expect(batch.length).toBeGreaterThanOrEqual(10);
    expect(progressUpdates).toBe(batch.length);

    const stored = await getAllPregenerated();
    expect(stored.length).toBe(batch.length);

    for (const msg of stored) {
      expect(msg.challenge).toBeTruthy();
      expect(msg.message).toBeTruthy();
      expect(msg.language).toBe(profile.language);
      expect(msg.used).toBe(false);
      expect(msg.shownCount).toBe(0);
    }
  });

  it('serves next pregenerated message and marks it as used', async () => {
    await generateDailyBatch(profile);

    const initialUnused = await getUnusedPregenerated('craving');
    expect(initialUnused.length).toBeGreaterThan(0);

    const first = await getNextPregeneratedMessage('craving', profile.language);
    expect(first.fromCache).toBe(true);
    expect(first.challenge).toBeTruthy();

    const remainingUnused = await getUnusedPregenerated('craving');
    expect(remainingUnused.length).toBe(initialUnused.length - 1);
  });

  it('evaluates automatic batch trigger rules (older than 20 hours or absent)', () => {
    expect(shouldTriggerAutomaticBatch(null)).toBe(true);

    const twoHoursAgo = Date.now() - 2 * 60 * 60 * 1000;
    expect(shouldTriggerAutomaticBatch(twoHoursAgo)).toBe(false);

    const twentyOneHoursAgo = Date.now() - 21 * 60 * 60 * 1000;
    expect(shouldTriggerAutomaticBatch(twentyOneHoursAgo)).toBe(true);
  });
});
