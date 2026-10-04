import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import demoProfile from '../demo/profile.demo.json';
import {
  clearAllEvents,
  getAllEvents,
  getStoredProfile,
  resetDatabase,
  setStoredProfile,
} from '../src/db/index.ts';
import {
  createInitialUserProfile,
  getDemoProfile,
  isDemoProfile,
} from '../src/lib/profile.ts';
import { computeUserStats } from '../src/lib/stats.ts';
import { ProfileSchema } from '../src/schemas/profile.ts';

describe('Profile Initialization System (Normal vs Demo vs Reset)', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  describe('Normal Mode: First launch & Initial User Profile', () => {
    it('creates an initial user profile with user name, streak 0 and counters 0', () => {
      const now = new Date();
      const profile = createInitialUserProfile('Thomas', 'fr', now.toISOString());

      expect(profile.userName).toBe('Thomas');
      expect(profile.language).toBe('fr');
      // Phrases contain the user name in the first motivation phrase
      expect(profile.phrases[0]).toBe("Allez Thomas, trois minutes et l'envie est passée.");
      expect(profile.phrases.length).toBeGreaterThanOrEqual(10);

      // Verify stats computed on initial profile are strictly 0
      const stats = computeUserStats(profile, [], now.getTime());
      expect(stats.streakDays).toBe(0);
      expect(stats.streakHours).toBe(0);
      expect(stats.avoidedCigarettes).toBe(0);
      expect(stats.resistedCount).toBe(0);
      expect(stats.relapseCount).toBe(0);
      expect(stats.moneySaved).toBe(0);
      expect(stats.savingsGoalProgress).toBe(0);
    });

    it('preserves all other prefilled fields according to current application policy', () => {
      const profile = createInitialUserProfile('Sarah', 'fr');

      // Schema validity
      expect(ProfileSchema.safeParse(profile).success).toBe(true);

      // Current application policy defaults
      expect(profile.unitsPerDay).toBe(15);
      expect(profile.unitPrice).toBe(0.6);
      expect(profile.currency).toBe('€');
      expect(profile.habitLabel).toBe('cigarettes');
      expect(profile.discreetMode).toBe(true);
      expect(profile.helpline.label).toBe('Tabac Info Service');
      expect(profile.helpline.contact).toBe('3989');
      expect(profile.savingsGoal.label).toBe('Voyage en train dans les Alpes');
      expect(profile.savingsGoal.amount).toBe(600);

      // Reasons, alternatives, and risk windows must be populated
      expect(profile.reasons.length).toBeGreaterThanOrEqual(4);
      expect(profile.alternatives.length).toBeGreaterThanOrEqual(4);
      expect(profile.riskWindows.length).toBeGreaterThanOrEqual(4);
      expect(profile.interests.length).toBeGreaterThanOrEqual(4);
    });

    it('supports English language policy when requested', () => {
      const profile = createInitialUserProfile('Emma', 'en');
      expect(profile.userName).toBe('Emma');
      expect(profile.language).toBe('en');
      expect(profile.phrases[0]).toBe('Hold on Emma, three minutes and this wave will pass.');
      expect(profile.savingsGoal.label).toBe('Train trip through the Alps');
    });

    it('detects that normal profile is NOT a demo profile', () => {
      const profile = createInitialUserProfile('Alexandre', 'fr');
      expect(isDemoProfile(profile)).toBe(false);
    });
  });

  describe('Demo Mode: Fictional Camille Profile', () => {
    it('preserves the demo profile intact from demo/profile.demo.json', () => {
      const demo = getDemoProfile();
      expect(demo.quitDate).toBe('2026-10-01T08:00:00.000Z');
      expect(demo.phrases[0]).toContain('Camille');
      expect(isDemoProfile(demo)).toBe(true);
    });

    it('computes demo statistics matching the 3-day / 50+ cigarettes demo experience', () => {
      const demo = getDemoProfile();
      // On 2026-10-04, 3+ days have elapsed from 2026-10-01
      const simulatedNow = new Date('2026-10-04T16:00:00.000Z').getTime();
      const stats = computeUserStats(demo, [], simulatedNow);

      expect(stats.streakDays).toBe(3);
      expect(stats.avoidedCigarettes).toBeGreaterThanOrEqual(50);
      expect(stats.moneySaved).toBeGreaterThan(0);
    });
  });

  describe('Reset / Delete All: returns to initial user state, not demo', () => {
    it('wipes database and allows creating a fresh user profile starting at 0', async () => {
      // 1. Store a profile
      const userProfile = createInitialUserProfile('Marc', 'fr');
      await setStoredProfile(userProfile);
      expect(await getStoredProfile()).not.toBeNull();

      // 2. Wipe database (simulating reset)
      await resetDatabase();
      expect(await getStoredProfile()).toBeNull();
      expect((await getAllEvents()).length).toBe(0);

      // 3. New profile created after reset
      const freshUser = createInitialUserProfile('Nadia', 'fr');
      expect(freshUser.userName).toBe('Nadia');
      expect(isDemoProfile(freshUser)).toBe(false);

      const stats = computeUserStats(freshUser, []);
      expect(stats.streakDays).toBe(0);
      expect(stats.avoidedCigarettes).toBe(0);
      expect(stats.moneySaved).toBe(0);
    });
  });
});
