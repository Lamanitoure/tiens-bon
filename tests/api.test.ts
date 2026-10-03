import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  checkModelStatus,
  generateMotivation,
  getStoredToken,
  setStoredToken,
} from '../src/lib/api.ts';

describe('Client API helper tests', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('manages stored token correctly', () => {
    expect(getStoredToken()).toBe('');
    setStoredToken('my-secret-token');
    expect(getStoredToken()).toBe('my-secret-token');
  });

  it('returns unauthorized if no token is stored', async () => {
    const status = await checkModelStatus();
    expect(status.ollama).toBe('unauthorized');
  });

  it('calls /api/status with Bearer token and returns model status', async () => {
    setStoredToken('my-secret-token');
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ ollama: 'ok', model: 'gemma2:2b' }),
    } as unknown as Response);

    const status = await checkModelStatus();
    expect(status.ollama).toBe('ok');
    expect(status.model).toBe('gemma2:2b');
  });

  it('calls /api/generate and validates response with Zod', async () => {
    setStoredToken('my-secret-token');
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        challenge: 'Bois un verre d eau fraîche',
        message: 'Tiens bon, cette envie va passer.',
      }),
    } as unknown as Response);

    const res = await generateMotivation('Urge test prompt');
    expect(res.challenge).toBe('Bois un verre d eau fraîche');
    expect(res.message).toBe('Tiens bon, cette envie va passer.');
  });

  it('rejects model output with invalid schema', async () => {
    setStoredToken('my-secret-token');
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        // missing message
        challenge: 'Bois un verre d eau',
      }),
    } as unknown as Response);

    await expect(generateMotivation('Urge test prompt')).rejects.toThrow(
      /Model output schema error/,
    );
  });
});
