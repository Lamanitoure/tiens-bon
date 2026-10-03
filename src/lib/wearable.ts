import { getStoredToken } from './api.ts';

export interface WearableTriggerResponse {
  status: 'ready' | 'error';
  session?: 'craving';
  timestamp?: number;
  id?: string;
  message?: string;
  error?: string;
}

/**
 * Generates the webhook URL to configure on a smartwatch, Tasker, Bixby Routines, or NFC tag (Step 18).
 */
export function getWearableWebhookUrl(token?: string): string {
  const effectiveToken = token || getStoredToken();
  const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
  return `${origin}/api/trigger/craving?token=${encodeURIComponent(effectiveToken)}`;
}

/**
 * Checks URL parameters for smartwatch or shortcut deep link trigger (e.g. `/?trigger=craving`).
 * Clears the parameter seamlessly after detection.
 */
export function detectUrlTrigger(): boolean {
  if (typeof window === 'undefined') return false;

  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('trigger') === 'craving') {
    urlParams.delete('trigger');
    const newSearch = urlParams.toString();
    const newUrl =
      window.location.pathname + (newSearch ? `?${newSearch}` : '') + window.location.hash;
    window.history.replaceState({}, '', newUrl);
    return true;
  }

  return false;
}

/**
 * Triggers the craving flow via HTTP endpoint (Step 18).
 * Can be called from watch simulation or external automation.
 */
export async function triggerWearableCraving(
  token?: string,
  source = 'test',
): Promise<WearableTriggerResponse> {
  const effectiveToken = token || getStoredToken();

  try {
    const res = await fetch(`/api/trigger/craving?source=${encodeURIComponent(source)}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${effectiveToken}`,
      },
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'HTTP error' }));
      return { status: 'error', error: err.detail || 'Erreur lors du déclenchement montre' };
    }

    const data = await res.json();
    return data;
  } catch (e) {
    return { status: 'error', error: String(e) };
  }
}

/**
 * Polls the backend to see if a smartwatch has triggered a craving session.
 */
export async function checkActiveTrigger(
  token?: string,
): Promise<{ active: boolean; id?: string; context?: string }> {
  const effectiveToken = token || getStoredToken();
  if (!effectiveToken) return { active: false };

  try {
    const res = await fetch('/api/trigger/status', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${effectiveToken}`,
      },
    });

    if (!res.ok) return { active: false };

    const data = await res.json();
    if (data.activeTrigger && data.activeTrigger.type === 'craving') {
      return {
        active: true,
        id: data.activeTrigger.id,
        context: data.activeTrigger.context,
      };
    }

    return { active: false };
  } catch {
    return { active: false };
  }
}

/**
 * Acknowledges/consumes an active trigger so it doesn't repeatedly re-launch.
 */
export async function consumeActiveTrigger(token?: string): Promise<void> {
  const effectiveToken = token || getStoredToken();
  if (!effectiveToken) return;

  try {
    await fetch('/api/trigger/consume', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${effectiveToken}`,
      },
    });
  } catch {
    // Ignore network hiccups on consume
  }
}
