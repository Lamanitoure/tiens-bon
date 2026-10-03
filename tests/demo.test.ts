import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { getAllPregenerated, resetDatabase } from '../src/db/index.ts';
import {
  ensureDemoPregeneratedSeeded,
  getValidatedBundledDemoMessages,
} from '../src/lib/demo-mode.ts';

describe('Step 20: Public Demo Bundled Gemma Messages', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it('validates all bundled demo messages in demo/pregenerated.demo.json', () => {
    const messages = getValidatedBundledDemoMessages();
    expect(messages.length).toBeGreaterThanOrEqual(10);
    const hasFr = messages.some((m) => m.language === 'fr');
    const hasEn = messages.some((m) => m.language === 'en');
    expect(hasFr).toBe(true);
    expect(hasEn).toBe(true);
  });

  it('seeds bundled demo messages into IndexedDB when cache is empty', async () => {
    const count = await ensureDemoPregeneratedSeeded();
    expect(count).toBeGreaterThanOrEqual(10);

    const stored = await getAllPregenerated();
    expect(stored.length).toBe(count);

    // Calling again should not duplicate entries
    const countSecond = await ensureDemoPregeneratedSeeded();
    expect(countSecond).toBe(count);
  });
});
