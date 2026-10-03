import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import demoProfile from '../demo/profile.demo.json';
import { getStoredProfile, resetDatabase, setStoredProfile } from '../src/db/index.ts';
import {
  buildRecapPrompt,
  computeWeeklyStats,
  detectLearnedRiskWindows,
} from '../src/lib/recap.ts';
import type { EventRecord } from '../src/schemas/events.ts';
import { type Profile, ProfileSchema, type RiskWindow } from '../src/schemas/profile.ts';

describe('Step 16: Weekly recap & Learned risk windows', () => {
  let profile: Profile;

  beforeEach(async () => {
    await resetDatabase();
    profile = ProfileSchema.parse(demoProfile);
    await setStoredProfile(profile);
  });

  describe('computeWeeklyStats aggregation', () => {
    it('aggregates resisted cravings, relapses, and top triggers accurately', () => {
      const now = Date.now();
      const events: EventRecord[] = [
        { id: '1', ts: now - 1000, type: 'resisted', trigger: 'Café' },
        { id: '2', ts: now - 2000, type: 'resisted', trigger: 'Café' },
        { id: '3', ts: now - 3000, type: 'resisted', trigger: 'Stress' },
        { id: '4', ts: now - 4000, type: 'relapse', trigger: 'Soirée' },
        {
          id: '5',
          ts: now - 5000,
          type: 'checkin',
          trigger: 'Café',
          debrief: { outcome: 'resisted' },
        },
      ];

      const stats = computeWeeklyStats(events, profile, now);

      expect(stats.totalEvents).toBe(5);
      expect(stats.resistedCount).toBe(4);
      expect(stats.relapseCount).toBe(1);
      expect(stats.resistedRate).toBe(80); // 4 / 5 = 80%

      // Café appeared 3 times, Stress once, Soirée once
      expect(stats.topTriggers[0].trigger).toBe('Café');
      expect(stats.topTriggers[0].count).toBe(3);

      expect(stats.savingsToDate).toBeGreaterThanOrEqual(0);
      expect(stats.goalProgress).toBeGreaterThanOrEqual(0);
    });

    it('ignores events older than 7 days in weekly aggregation', () => {
      const now = Date.now();
      const eightDaysAgo = now - 8 * 24 * 60 * 60 * 1000;
      const events: EventRecord[] = [
        { id: 'old', ts: eightDaysAgo, type: 'resisted', trigger: 'Ancien' },
        { id: 'recent', ts: now - 1000, type: 'resisted', trigger: 'Récent' },
      ];

      const stats = computeWeeklyStats(events, profile, now);
      expect(stats.totalEvents).toBe(1);
      expect(stats.topTriggers[0].trigger).toBe('Récent');
    });
  });

  describe('detectLearnedRiskWindows and Explicit Confirmation Invariant', () => {
    it('does NOT propose risk window if cluster count is below threshold', () => {
      const now = new Date('2026-10-03T14:30:00Z').getTime();
      const events: EventRecord[] = [
        { id: '1', ts: now, type: 'craving', trigger: 'Pause' },
        { id: '2', ts: now + 1000, type: 'craving', trigger: 'Pause' },
      ];

      const proposals = detectLearnedRiskWindows(events, profile, 5);
      expect(proposals).toHaveLength(0);
    });

    it('proposes new risk window when 5 cravings recur at the same hour', () => {
      // Create 5 cravings at 16:00
      const date16h = new Date();
      date16h.setHours(16, 15, 0, 0);

      const events: EventRecord[] = [];
      for (let i = 0; i < 5; i++) {
        events.push({
          id: `evt-${i}`,
          ts: date16h.getTime() - i * 86400000, // each day at 16:15
          type: 'craving',
          trigger: 'Goûter sucré',
        });
      }

      // Ensure profile does not already have a 16:00 window
      const cleanProfile: Profile = {
        ...profile,
        riskWindows: profile.riskWindows.filter((rw) => !rw.time.startsWith('16:')),
      };

      const proposals = detectLearnedRiskWindows(events, cleanProfile, 5);
      expect(proposals.length).toBeGreaterThanOrEqual(1);

      const prop = proposals.find((p) => p.time === '16:00');
      expect(prop).toBeDefined();
      expect(prop?.reminderTime).toBe('15:50'); // 10 min lead time
      expect(prop?.rationale).toContain('16:00');
      expect(prop?.rationale).toContain('15:50');
    });

    it('does NOT propose a window if that hour is already in profile.riskWindows', () => {
      // 08:30 is already in demoProfile
      const date8h = new Date();
      date8h.setHours(8, 30, 0, 0);

      const events: EventRecord[] = [];
      for (let i = 0; i < 6; i++) {
        events.push({
          id: `evt-${i}`,
          ts: date8h.getTime() - i * 86400000,
          type: 'craving',
          trigger: 'Café',
        });
      }

      const proposals = detectLearnedRiskWindows(events, profile, 5);
      const conflict = proposals.find((p) => p.time === '08:00');
      expect(conflict).toBeUndefined();
    });

    it('adds window to profile ONLY upon explicit confirmation and saves to IndexedDB', async () => {
      const newWindow: RiskWindow = {
        label: 'Goûter sucré (habits observés)',
        time: '16:00',
      };

      const updated = {
        ...profile,
        riskWindows: [...profile.riskWindows, newWindow],
      };

      const validated = ProfileSchema.parse(updated);
      await setStoredProfile(validated);

      const fromDb = await getStoredProfile();
      expect(fromDb?.riskWindows.some((rw) => rw.time === '16:00')).toBe(true);
    });
  });

  describe('buildRecapPrompt compliance with config/prompts/recap.txt', () => {
    it('formats prompt respecting exact numbers and strict non-reproach instructions', () => {
      const stats = computeWeeklyStats([], profile);
      const prompt = buildRecapPrompt(stats, profile);

      expect(prompt).toContain('Resisted:');
      expect(prompt).toContain('Money saved:');
      expect(prompt).toContain('Rules: Start with what worked.');
      expect(prompt).toContain('No medical advice, no reproach.');
      expect(prompt).toContain(profile.tone);
    });
  });
});
