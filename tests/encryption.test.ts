import { describe, expect, it } from 'vitest';
import demoProfile from '../demo/profile.demo.json';
import {
  type BackupData,
  decryptBackup,
  type EncryptedBackupPackage,
  encryptBackup,
} from '../src/security/encryption.ts';

describe('Web Crypto Encrypted Backup (Item 3 & Section 8)', () => {
  const sampleData: BackupData = {
    profile: demoProfile as unknown as BackupData['profile'],
    events: [
      {
        id: 'evt-1',
        ts: Date.now() - 3600000,
        type: 'craving',
        trigger: 'coffee',
      },
      {
        id: 'evt-2',
        ts: Date.now(),
        type: 'resisted',
      },
    ],
    exportedAt: Date.now(),
  };

  const password = 'SuperSecretMasterPassword123!';

  it('performs complete encryption and decryption roundtrip successfully', async () => {
    const encrypted = await encryptBackup(sampleData, password);

    expect(encrypted.version).toBe('TIENS_BON_V1');
    expect(encrypted.salt).toBeTruthy();
    expect(encrypted.iv).toBeTruthy();
    expect(encrypted.hmac).toBeTruthy();
    expect(encrypted.ciphertext).toBeTruthy();

    const restored = await decryptBackup(encrypted, password);
    expect(restored.profile.language).toBe('fr');
    expect(restored.profile.helpline.label).toBe('Tabac Info Service');
    expect(restored.events.length).toBe(2);
    expect(restored.events[0].id).toBe('evt-1');
  });

  it('rejects decryption when given an incorrect password', async () => {
    const encrypted = await encryptBackup(sampleData, password);
    await expect(decryptBackup(encrypted, 'WrongPassword456!')).rejects.toThrow(
      /Invalid password or corrupted backup payload/,
    );
  });

  it('rejects decryption if HMAC signature is tampered with', async () => {
    const encrypted = await encryptBackup(sampleData, password);
    const tampered = { ...encrypted, hmac: 'dGFtcGVyZWRIbWFjVmFsdWU=' };
    await expect(decryptBackup(tampered, password)).rejects.toThrow(
      /Invalid password or corrupted backup payload/,
    );
  });

  it('rejects decryption if version does not match TIENS_BON_V1', async () => {
    const encrypted = await encryptBackup(sampleData, password);
    const wrongVersion: EncryptedBackupPackage = { ...encrypted, version: 'TIENS_BON_V2' };
    await expect(decryptBackup(wrongVersion, password)).rejects.toThrow(
      /Unsupported backup version/,
    );
  });

  it('rejects backup payload containing external URLs (Section 8 item 3)', async () => {
    // Inject external URL into reason
    const maliciousData: BackupData = {
      ...sampleData,
      profile: {
        ...sampleData.profile,
        reasons: ['https://tracking-malware.com/steal-data'],
      },
    };

    const encrypted = await encryptBackup(maliciousData, password);
    await expect(decryptBackup(encrypted, password)).rejects.toThrow(
      /Security rejection: External URLs are not allowed in backup payload/,
    );
  });
});
