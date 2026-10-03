import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { getSettings, resetDatabase } from '../src/db/index.ts';
import {
  createPinLockSettings,
  decryptPayloadWithPin,
  disableAppPinLock,
  enableAppPinLock,
  encryptPayloadWithPin,
  verifyPinAgainstSettings,
} from '../src/security/pin-lock.ts';

describe('Step 19: Optional Web Crypto PIN App Lock', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it('creates PBKDF2 + AES-GCM lock settings and verifies the correct PIN', async () => {
    const settings = await createPinLockSettings('2468');
    expect(settings.enabled).toBe(true);
    expect(settings.salt).toBeTruthy();
    expect(settings.iv).toBeTruthy();
    expect(settings.verifier).toBeTruthy();

    const isValid = await verifyPinAgainstSettings('2468', settings);
    expect(isValid).toBe(true);

    const isWrong = await verifyPinAgainstSettings('1357', settings);
    expect(isWrong).toBe(false);
  });

  it('rejects non-numeric or out-of-range PINs', async () => {
    await expect(createPinLockSettings('12')).rejects.toThrow(/4 to 8 digits/);
    await expect(createPinLockSettings('abcd')).rejects.toThrow(/4 to 8 digits/);
  });

  it('encrypts and decrypts a JSON payload with a PIN using AES-GCM', async () => {
    const sample = JSON.stringify({ secret: 'Camille journal note' });
    const encrypted = await encryptPayloadWithPin(sample, '123456');
    const decrypted = await decryptPayloadWithPin(encrypted, '123456');
    expect(decrypted).toBe(sample);

    await expect(decryptPayloadWithPin(encrypted, '654321')).rejects.toThrow();
  });

  it('persists and disables PIN lock settings in IndexedDB', async () => {
    const enabled = await enableAppPinLock('4321');
    expect(enabled.enabled).toBe(true);

    const stored = await getSettings();
    expect(stored?.lockSettings?.enabled).toBe(true);

    await disableAppPinLock();
    const afterDisable = await getSettings();
    expect(afterDisable?.lockSettings?.enabled).toBe(false);
  });
});
