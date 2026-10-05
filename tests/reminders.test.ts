import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import demoProfile from '../demo/profile.demo.json';
import { getStoredProfile, resetDatabase, setStoredProfile } from '../src/db/index.ts';
import {
  buildReminderNotification,
  calculateReminderTime,
  getScheduledReminders,
} from '../src/lib/reminders.ts';
import { type Profile, ProfileSchema } from '../src/schemas/profile.ts';

describe('Step 14: Reminders before risk moments & Discreet mode', () => {
  let profile: Profile;

  beforeEach(async () => {
    await resetDatabase();
    profile = ProfileSchema.parse(demoProfile);
    await setStoredProfile(profile);
  });

  describe('calculateReminderTime calculation (Step 14)', () => {
    it('subtracts lead time correctly within the same hour', () => {
      expect(calculateReminderTime('08:30', 10)).toBe('08:20');
      expect(calculateReminderTime('14:45', 10)).toBe('14:35');
    });

    it('handles hour boundary crossings correctly', () => {
      expect(calculateReminderTime('09:05', 10)).toBe('08:55');
      expect(calculateReminderTime('13:00', 15)).toBe('12:45');
    });

    it('handles midnight rollover across days correctly', () => {
      // 00:05 minus 10 minutes should be 23:55 of the previous day
      expect(calculateReminderTime('00:05', 10)).toBe('23:55');
      // 00:00 minus 10 minutes should be 23:50
      expect(calculateReminderTime('00:00', 10)).toBe('23:50');
      // 00:00 minus 60 minutes should be 23:00
      expect(calculateReminderTime('00:00', 60)).toBe('23:00');
    });

    it('returns original input if time string is invalid', () => {
      expect(calculateReminderTime('invalid', 10)).toBe('invalid');
    });
  });

  describe('buildReminderNotification & Discreet Mode (Security Item 19)', () => {
    const riskWindow = { label: 'Café du matin', time: '08:30' };

    it('in DISCREET mode (default), lock-screen text is strictly neutral with zero smoking/craving keywords', () => {
      const notif = buildReminderNotification(profile, riskWindow, 10, true);

      expect(notif.title).toBe('Tiens Bon');
      // Must NOT contain sensitive keywords on the lock screen
      const forbiddenWords = [
        'cigarette',
        'fumer',
        'smoke',
        'smoking',
        'craving',
        'envie',
        'tabac',
        'nicotine',
        'relapse',
        'rechute',
      ];

      for (const word of forbiddenWords) {
        expect(notif.body.toLowerCase()).not.toContain(word);
        expect(notif.title.toLowerCase()).not.toContain(word);
      }

      // Neutral lock screen text
      expect(notif.body).toMatch(/pause|instant/i);

      // But inside-app fullMessage contains his personal encouragement
      expect(notif.fullMessage).toBeTruthy();
      expect(notif.alternative).toBeTruthy();
    });

    it('in NON-discreet mode, displays the window name and his alternative directly', () => {
      const notif = buildReminderNotification(profile, riskWindow, 10, false);

      expect(notif.body).toContain('Café du matin');
      expect(notif.body).toContain(notif.alternative);
      expect(notif.body).toContain('10 min');
    });

    it('supports English language output appropriately', () => {
      const enProfile: Profile = {
        ...profile,
        language: 'en',
      };

      const discreetEn = buildReminderNotification(enProfile, riskWindow, 10, true);
      expect(discreetEn.body).toBe('A gentle pause is scheduled for you.');

      const openEn = buildReminderNotification(enProfile, riskWindow, 10, false);
      expect(openEn.body).toContain('In 10 min (Café du matin)');
    });
  });

  describe('getScheduledReminders helper', () => {
    it('computes reminder times for all profile risk windows', () => {
      const reminders = getScheduledReminders(profile, 10, true);
      expect(reminders.length).toBe(profile.riskWindows.length);

      for (const rem of reminders) {
        expect(rem.reminderTime).toBeTruthy();
        expect(rem.reminderTime).not.toBe(rem.riskTime);
        expect(rem.notificationBody).toMatch(/pause|instant/i);
      }
    });
  });

  describe('Discreet mode settings persistence in IndexedDB', () => {
    it('persists discreet mode toggle in stored profile', async () => {
      const initial = await getStoredProfile();
      expect(initial?.discreetMode).toBe(true);

      if (initial) {
        await setStoredProfile({
          ...initial,
          discreetMode: false,
        });
      }

      const updated = await getStoredProfile();
      expect(updated?.discreetMode).toBe(false);
    });
  });
});
