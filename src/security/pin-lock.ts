import { getSettings, setSettings } from '../db/index.ts';
import { getLanguage } from '../i18n/index.ts';
import type { LockSettings } from '../schemas/settings.ts';

const PIN_PBKDF2_ITERATIONS = 100_000;
const PIN_VERIFIER_PLAINTEXT = 'TIENS_BON_PIN_VERIFIED_V1';

export const PIN_REGEX = /^\d{4,8}$/;

function uint8ToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToUint8(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export async function derivePinKey(pin: string, salt: Uint8Array): Promise<CryptoKey> {
  if (!PIN_REGEX.test(pin)) {
    throw new Error('PIN must be 4 to 8 digits.');
  }
  const enc = new TextEncoder();
  const baseKey = await crypto.subtle.importKey('raw', enc.encode(pin), 'PBKDF2', false, [
    'deriveKey',
  ]);
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt as BufferSource,
      iterations: PIN_PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

export async function createPinLockSettings(pin: string): Promise<LockSettings> {
  if (!PIN_REGEX.test(pin)) {
    throw new Error('PIN must be 4 to 8 digits.');
  }
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await derivePinKey(pin, salt);

  const enc = new TextEncoder();
  const cipherBuf = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv as BufferSource },
    key,
    enc.encode(PIN_VERIFIER_PLAINTEXT),
  );

  return {
    enabled: true,
    salt: uint8ToBase64(salt),
    iv: uint8ToBase64(iv),
    verifier: uint8ToBase64(new Uint8Array(cipherBuf)),
  };
}

export async function verifyPinAgainstSettings(
  pin: string,
  lockSettings: LockSettings,
): Promise<boolean> {
  if (
    !lockSettings.enabled ||
    !lockSettings.salt ||
    !lockSettings.iv ||
    !lockSettings.verifier ||
    !PIN_REGEX.test(pin)
  ) {
    return false;
  }

  try {
    const salt = base64ToUint8(lockSettings.salt);
    const iv = base64ToUint8(lockSettings.iv);
    const verifierBytes = base64ToUint8(lockSettings.verifier);
    const key = await derivePinKey(pin, salt);

    const plainBuf = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: iv as BufferSource },
      key,
      verifierBytes as BufferSource,
    );
    const dec = new TextDecoder();
    return dec.decode(plainBuf) === PIN_VERIFIER_PLAINTEXT;
  } catch {
    return false;
  }
}

export async function encryptPayloadWithPin(
  payloadJson: string,
  pin: string,
): Promise<{ salt: string; iv: string; ciphertext: string }> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await derivePinKey(pin, salt);
  const enc = new TextEncoder();
  const cipherBuf = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv as BufferSource },
    key,
    enc.encode(payloadJson),
  );
  return {
    salt: uint8ToBase64(salt),
    iv: uint8ToBase64(iv),
    ciphertext: uint8ToBase64(new Uint8Array(cipherBuf)),
  };
}

export async function decryptPayloadWithPin(
  pkg: { salt: string; iv: string; ciphertext: string },
  pin: string,
): Promise<string> {
  const salt = base64ToUint8(pkg.salt);
  const iv = base64ToUint8(pkg.iv);
  const ciphertext = base64ToUint8(pkg.ciphertext);
  const key = await derivePinKey(pin, salt);
  const plainBuf = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: iv as BufferSource },
    key,
    ciphertext as BufferSource,
  );
  return new TextDecoder().decode(plainBuf);
}

export async function enableAppPinLock(pin: string): Promise<LockSettings> {
  const lockSettings = await createPinLockSettings(pin);
  const current = await getSettings();
  await setSettings({
    language: current?.language ?? getLanguage(),
    discreetMode: current?.discreetMode ?? true,
    tokenReference: current?.tokenReference,
    lockSettings,
  });
  return lockSettings;
}

export async function disableAppPinLock(): Promise<void> {
  const current = await getSettings();
  await setSettings({
    language: current?.language ?? getLanguage(),
    discreetMode: current?.discreetMode ?? true,
    tokenReference: current?.tokenReference,
    lockSettings: { enabled: false },
  });
}
