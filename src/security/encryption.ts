import { type EventRecord, EventSchema, type Profile, ProfileSchema } from '../schemas/index.ts';

export const BACKUP_VERSION = 'TIENS_BON_V1';
const PBKDF2_ITERATIONS = 600_000;

export interface EncryptedBackupPackage {
  version: string;
  salt: string; // base64
  iv: string; // base64
  hmac: string; // base64
  ciphertext: string; // base64
}

export interface BackupData {
  profile: Profile;
  events: EventRecord[];
  exportedAt: number;
}

// Helpers for Base64 encoding/decoding in browser & tests
function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

// Derive keys from password and salt using PBKDF2
async function deriveKeys(
  password: string,
  salt: Uint8Array,
): Promise<{ aesKey: CryptoKey; hmacKey: CryptoKey }> {
  const enc = new TextEncoder();
  const passwordKey = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, [
    'deriveKey',
  ]);

  // Derive AES-GCM 256-bit key
  const aesKey = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt as BufferSource,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    passwordKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );

  // Derive HMAC key using modified salt
  const hmacSalt = new Uint8Array(salt.length + 1);
  hmacSalt.set(salt, 0);
  hmacSalt[salt.length] = 0x01;

  const hmacKey = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: hmacSalt as BufferSource,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    passwordKey,
    { name: 'HMAC', hash: 'SHA-256', length: 256 },
    false,
    ['sign', 'verify'],
  );

  return { aesKey, hmacKey };
}

/**
 * Encrypt backup data with a user password.
 * AES-GCM 256-bit, PBKDF2 600,000 iterations, random salt, random 96-bit IV, HMAC-SHA256 signature.
 */
export async function encryptBackup(
  data: BackupData,
  password: string,
): Promise<EncryptedBackupPackage> {
  if (!password || password.length < 6) {
    throw new Error('Password must be at least 6 characters long.');
  }

  // Ensure data conforms to schemas before export
  ProfileSchema.parse(data.profile);
  for (const ev of data.events) {
    EventSchema.parse(ev);
  }

  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12)); // 96-bit IV
  const { aesKey, hmacKey } = await deriveKeys(password, salt);

  const jsonString = JSON.stringify(data);
  const enc = new TextEncoder();
  const ciphertextBuffer = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    aesKey,
    enc.encode(jsonString),
  );

  const saltB64 = uint8ArrayToBase64(salt);
  const ivB64 = uint8ArrayToBase64(iv);
  const ciphertextB64 = uint8ArrayToBase64(new Uint8Array(ciphertextBuffer));

  // Compute HMAC over version + salt + iv + ciphertext
  const signPayload = `${BACKUP_VERSION}.${saltB64}.${ivB64}.${ciphertextB64}`;
  const hmacBuffer = await crypto.subtle.sign('HMAC', hmacKey, enc.encode(signPayload));
  const hmacB64 = uint8ArrayToBase64(new Uint8Array(hmacBuffer));

  return {
    version: BACKUP_VERSION,
    salt: saltB64,
    iv: ivB64,
    hmac: hmacB64,
    ciphertext: ciphertextB64,
  };
}

/**
 * Decrypt backup package, verifying version, HMAC signature, schema validation,
 * and rejection of any external URLs (Security Section 8 Item 3).
 */
export async function decryptBackup(
  pkg: EncryptedBackupPackage,
  password: string,
): Promise<BackupData> {
  if (!pkg || typeof pkg !== 'object') {
    throw new Error('Invalid backup format.');
  }

  // 1. Version check
  if (pkg.version !== BACKUP_VERSION) {
    throw new Error(`Unsupported backup version: '${pkg.version}'. Expected '${BACKUP_VERSION}'.`);
  }

  const salt = base64ToUint8Array(pkg.salt);
  const iv = base64ToUint8Array(pkg.iv);
  const ciphertext = base64ToUint8Array(pkg.ciphertext);
  const expectedHmac = base64ToUint8Array(pkg.hmac);

  const { aesKey, hmacKey } = await deriveKeys(password, salt);

  // 2. Verify HMAC signature before attempting decryption
  const enc = new TextEncoder();
  const signPayload = `${pkg.version}.${pkg.salt}.${pkg.iv}.${pkg.ciphertext}`;
  const computedHmacBuffer = await crypto.subtle.sign('HMAC', hmacKey, enc.encode(signPayload));
  const computedHmac = new Uint8Array(computedHmacBuffer);

  if (computedHmac.length !== expectedHmac.length) {
    throw new Error('Invalid password or corrupted backup payload.');
  }

  let match = 0;
  for (let i = 0; i < computedHmac.length; i++) {
    match |= computedHmac[i] ^ expectedHmac[i];
  }
  if (match !== 0) {
    throw new Error('Invalid password or corrupted backup payload.');
  }

  // 3. Decrypt ciphertext
  let decryptedBuffer: ArrayBuffer;
  try {
    decryptedBuffer = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: iv as BufferSource },
      aesKey,
      ciphertext as BufferSource,
    );
  } catch (_err) {
    throw new Error('Decryption failed.');
  }

  const dec = new TextDecoder();
  const jsonStr = dec.decode(decryptedBuffer);

  // 4. Security check: Reject external URLs anywhere in the JSON (Section 8 item 3)
  if (/https?:\/\//i.test(jsonStr)) {
    throw new Error('Security rejection: External URLs are not allowed in backup payload.');
  }

  const parsed = JSON.parse(jsonStr);

  // 5. Schema validation
  const validatedProfile = ProfileSchema.parse(parsed.profile);
  const validatedEvents: EventRecord[] = [];
  if (Array.isArray(parsed.events)) {
    for (const ev of parsed.events) {
      validatedEvents.push(EventSchema.parse(ev));
    }
  }

  return {
    profile: validatedProfile,
    events: validatedEvents,
    exportedAt: parsed.exportedAt || Date.now(),
  };
}
