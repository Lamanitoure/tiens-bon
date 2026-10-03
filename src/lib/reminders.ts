import type { PregeneratedMessage } from '../schemas/pregenerated.ts';
import type { Profile, RiskWindow } from '../schemas/profile.ts';
import { activeConfig } from './config.ts';
import { buildPersonalizedFallback } from './pregeneration.ts';

export interface ScheduledReminder {
  riskWindowLabel: string;
  riskTime: string;
  reminderTime: string;
  leadTimeMinutes: number;
  notificationTitle: string;
  notificationBody: string;
  fullMessage: string;
  alternative: string;
}

/**
 * Calculates reminder time = risk window time minus lead time (Step 14).
 * Handles 24h format and wraps across midnight properly (e.g. 00:05 - 10 min = 23:55).
 */
export function calculateReminderTime(riskTime: string, leadTimeMinutes = 10): string {
  const parts = riskTime.split(':');
  const hours = parseInt(parts[0], 10);
  const minutes = parseInt(parts[1], 10);

  if (Number.isNaN(hours) || Number.isNaN(minutes)) {
    return riskTime;
  }

  const totalMinutes = hours * 60 + minutes;
  // Modulo 1440 for 24 hours (with + 1440 to avoid negative numbers)
  const reminderMinutes = (totalMinutes - leadTimeMinutes + 1440) % 1440;

  const remHours = Math.floor(reminderMinutes / 60);
  const remMins = reminderMinutes % 60;

  return `${remHours.toString().padStart(2, '0')}:${remMins.toString().padStart(2, '0')}`;
}

/**
 * Builds reminder notification payload respecting Discreet Mode (Section 5 Item 19 & Step 14).
 * INVARIANT: In discreet mode, lock-screen text is neutral so that anyone seeing her
 * screen learns nothing about cravings or smoking. The full message appears inside the app.
 */
export function buildReminderNotification(
  profile: Profile,
  window: RiskWindow,
  leadTimeMinutes: number,
  discreetMode: boolean,
  pregenMsg?: PregeneratedMessage | null,
): {
  title: string;
  body: string;
  fullMessage: string;
  alternative: string;
} {
  const isEn = profile.language === 'en';

  // Choose an alternative or random fallback
  const alt =
    profile.alternatives.length > 0
      ? profile.alternatives[Math.floor(Math.random() * profile.alternatives.length)]
      : isEn
        ? 'Drink a glass of cold water and breathe'
        : "Boire un grand verre d'eau fraîche et respirer";

  // Full message in her voice for display inside the app
  let fullMessage: string;
  if (pregenMsg?.message) {
    fullMessage = pregenMsg.message;
  } else {
    const fallback = buildPersonalizedFallback(profile, 'craving');
    fullMessage = fallback.message;
  }

  if (discreetMode) {
    // Neutral lock-screen text (Security Section 5 Item 19)
    return {
      title: 'Tiens Bon',
      body: isEn
        ? 'A gentle pause is scheduled for you.'
        : 'Un petit instant de pause prévu pour toi.',
      fullMessage,
      alternative: alt,
    };
  }

  // Non-discreet mode: personalized notification mentioning the window and alternative in her voice
  const bodyText = isEn
    ? `In ${leadTimeMinutes} min (${window.label}): remember your alternative: ${alt}.`
    : `Dans ${leadTimeMinutes} min (${window.label}) : pense à ton alternative : ${alt}.`;

  return {
    title: 'Tiens Bon',
    body: bodyText,
    fullMessage,
    alternative: alt,
  };
}

/**
 * Computes all scheduled reminders from her profile's risk windows.
 */
export function getScheduledReminders(
  profile: Profile,
  leadTimeMinutes?: number,
  discreetMode?: boolean,
  batch?: PregeneratedMessage[],
): ScheduledReminder[] {
  const effectiveLead = leadTimeMinutes ?? activeConfig.app.reminderLeadTimeMinutes ?? 10;
  const effectiveDiscreet = discreetMode ?? profile.discreetMode ?? true;

  return profile.riskWindows.map((rw) => {
    const reminderTime = calculateReminderTime(rw.time, effectiveLead);
    const matchedPregen = batch?.find(
      (m) =>
        m.context.toLowerCase().includes(rw.label.toLowerCase()) ||
        rw.label.toLowerCase().includes(m.context.toLowerCase()),
    );

    const notif = buildReminderNotification(
      profile,
      rw,
      effectiveLead,
      effectiveDiscreet,
      matchedPregen,
    );

    return {
      riskWindowLabel: rw.label,
      riskTime: rw.time,
      reminderTime,
      leadTimeMinutes: effectiveLead,
      notificationTitle: notif.title,
      notificationBody: notif.body,
      fullMessage: notif.fullMessage,
      alternative: notif.alternative,
    };
  });
}

/**
 * Trigger local notification via Service Worker registration (or Notification API fallback).
 */
export async function sendLocalNotification(options: {
  title: string;
  body: string;
  tag?: string;
  data?: Record<string, unknown>;
}): Promise<boolean> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return false;
  }

  let permission = Notification.permission;
  if (permission === 'default') {
    permission = await Notification.requestPermission();
  }

  if (permission !== 'granted') {
    return false;
  }

  // Prefer ServiceWorker showNotification if available
  if ('serviceWorker' in navigator) {
    try {
      const reg = await navigator.serviceWorker.ready;
      if (reg && 'showNotification' in reg) {
        await reg.showNotification(options.title, {
          body: options.body,
          icon: '/icon.svg',
          badge: '/icon.svg',
          tag: options.tag || 'tiens-bon-reminder',
          data: options.data,
        });
        return true;
      }
    } catch {
      // fallback to constructor
    }
  }

  try {
    new Notification(options.title, {
      body: options.body,
      icon: '/icon.svg',
      tag: options.tag || 'tiens-bon-reminder',
    });
    return true;
  } catch {
    return false;
  }
}
