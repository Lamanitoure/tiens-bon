import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import demoProfile from '../demo/profile.demo.json';
import {
  clearPregenerated,
  getAllPregenerated,
  getUnusedPregenerated,
  resetDatabase,
  setStoredProfile,
} from '../src/db/index.ts';
import * as apiModule from '../src/lib/api.ts';
import {
  buildBatchPlans,
  buildPersonalizedFallback,
  generateDailyBatch,
  getNextPregeneratedMessage,
  refillQuietlyIfNeeded,
  shouldTriggerAutomaticBatch,
} from '../src/lib/pregeneration.ts';
import type { Profile } from '../src/schemas/profile.ts';

describe('Pre-generation and offline fallback (Step 9)', () => {
  const profile = demoProfile as unknown as Profile;

  beforeEach(async () => {
    await resetDatabase();
    await clearPregenerated();
    await setStoredProfile(profile);
    vi.restoreAllMocks();
  });

  it('builds a full batch plan covering morning, all risk windows, config contexts, and evening', () => {
    const plans = buildBatchPlans(profile);

    // Batch size must be at least config default (10)
    expect(plans.length).toBeGreaterThanOrEqual(10);

    const categories = plans.map((p) => p.category);
    expect(categories).toContain('morning');
    expect(categories).toContain('risk_window');
    expect(categories).toContain('craving');
    expect(categories).toContain('evening');

    // Risk windows count match profile
    const riskWindowPlans = plans.filter((p) => p.category === 'risk_window');
    expect(riskWindowPlans.length).toBe(profile.riskWindows.length);

    // Plans have valid fallback challenge and message
    for (const plan of plans) {
      expect(plan.fallbackChallenge.length).toBeGreaterThan(0);
      expect(plan.fallbackMessage.length).toBeGreaterThan(0);
    }
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

  it('serves next pregenerated message from local storage and marks it as used', async () => {
    await generateDailyBatch(profile);

    const initialUnused = await getUnusedPregenerated('craving');
    expect(initialUnused.length).toBeGreaterThan(0);

    const first = await getNextPregeneratedMessage('craving', profile);
    expect(first.fromCache).toBe(true);
    expect(first.challenge).toBeTruthy();
    expect(first.message).toBeTruthy();

    const remainingUnused = await getUnusedPregenerated('craving');
    expect(remainingUnused.length).toBe(initialUnused.length - 1);
  });

  it('builds fallback message using her own phrases and alternatives when offline (Section 8 Step 9)', () => {
    const fallback = buildPersonalizedFallback(profile, 'craving');

    expect(fallback.challenge).toBeTruthy();
    expect(fallback.message).toBeTruthy();

    // The message must be one of her own phrases from her profile
    expect(profile.phrases).toContain(fallback.message);

    // The challenge must be one of her own alternatives
    expect(profile.alternatives).toContain(fallback.challenge);
  });

  it('returns a personalized message in her voice even with network off and airplane mode (cache empty)', async () => {
    const result = await getNextPregeneratedMessage('craving', profile);

    // Cache was empty, so result is not from cache
    expect(result.fromCache).toBe(false);
    expect(result.isFallback).toBe(true);

    // Result is personalized in her voice
    expect(profile.phrases).toContain(result.message);
    expect(profile.alternatives).toContain(result.challenge);
  });

  it('evaluates automatic batch trigger rules (older than 20 hours or absent)', () => {
    expect(shouldTriggerAutomaticBatch(null)).toBe(true);

    const twoHoursAgo = Date.now() - 2 * 60 * 60 * 1000;
    expect(shouldTriggerAutomaticBatch(twoHoursAgo)).toBe(false);

    const twentyOneHoursAgo = Date.now() - 21 * 60 * 60 * 1000;
    expect(shouldTriggerAutomaticBatch(twentyOneHoursAgo)).toBe(true);
  });

  it('triggers quiet background refill when unused craving messages are low and model is reachable', async () => {
    // Mock checkModelStatus to return ok
    vi.spyOn(apiModule, 'checkModelStatus').mockResolvedValue({
      ollama: 'ok',
      model: 'gemma2:2b',
    });

    // Currently 0 pregenerated messages in store (low stock)
    const refilled = await refillQuietlyIfNeeded(profile);
    expect(refilled).toBe(true);
  });
});
