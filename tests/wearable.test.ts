import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  checkActiveTrigger,
  consumeActiveTrigger,
  detectUrlTrigger,
  getWearableWebhookUrl,
  triggerWearableCraving,
} from '../src/lib/wearable.ts';

describe('Step 18: Smartwatch & wearable trigger endpoint', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  describe('Webhook URL generator & Deep linking', () => {
    it('generates webhook URL with encoded security token', () => {
      const url = getWearableWebhookUrl('secret-token-123');
      expect(url).toContain('/api/trigger/craving?token=secret-token-123');
    });

    it('detects ?trigger=craving deep link from smartwatch and clears search param', () => {
      // Mock window.location and history.replaceState
      const replaceStateSpy = vi.spyOn(window.history, 'replaceState');
      delete (window as unknown as { location?: unknown }).location;
      window.location = new URL(
        'https://tiens-bon.app/?trigger=craving&utm_source=watch',
      ) as unknown as Location;

      const detected = detectUrlTrigger();
      expect(detected).toBe(true);
      expect(replaceStateSpy).toHaveBeenCalled();
    });

    it('returns false when ?trigger=craving is not present', () => {
      delete (window as unknown as { location?: unknown }).location;
      window.location = new URL('https://tiens-bon.app/?tab=journal') as unknown as Location;

      const detected = detectUrlTrigger();
      expect(detected).toBe(false);
    });
  });

  describe('triggerWearableCraving API call', () => {
    it('invokes GET /api/trigger/craving with Bearer auth and parses ready status', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          status: 'ready',
          session: 'craving',
          timestamp: 1700000000000,
          id: 'trig-test-1',
          message: 'Craving flow readied for user.',
        }),
      } as unknown as Response);

      const res = await triggerWearableCraving('valid-token', 'smartwatch_button');
      expect(res.status).toBe('ready');
      expect(res.session).toBe('craving');
      expect(res.id).toBe('trig-test-1');
    });

    it('returns error when endpoint returns 401 unauthorized', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({
          detail: 'Invalid access token.',
        }),
      } as unknown as Response);

      const res = await triggerWearableCraving('bad-token');
      expect(res.status).toBe('error');
      expect(res.error).toBe('Invalid access token.');
    });
  });

  describe('checkActiveTrigger and consumeActiveTrigger lifecycle', () => {
    it('checks active trigger from smartwatch button press', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          activeTrigger: {
            id: 'trig-watch-42',
            type: 'craving',
            timestamp: Date.now(),
            source: 'bixby_routine',
          },
        }),
      } as unknown as Response);

      const status = await checkActiveTrigger('valid-token');
      expect(status.active).toBe(true);
      expect(status.id).toBe('trig-watch-42');
    });

    it('consumes trigger so it does not repeat', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ status: 'consumed' }),
      } as unknown as Response);

      await consumeActiveTrigger('valid-token');
      expect(fetchSpy).toHaveBeenCalledWith(
        '/api/trigger/consume',
        expect.objectContaining({ method: 'POST' }),
      );
    });
  });
});
