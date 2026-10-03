import { describe, expect, it } from 'vitest';
import { z } from 'zod';

describe('Tooling foundation', () => {
  it('runs Vitest with happy-dom and validates Zod schemas', () => {
    const testSchema = z.object({
      appName: z.string(),
      version: z.string(),
    });

    const parsed = testSchema.safeParse({
      appName: 'Tiens Bon',
      version: '0.1.0',
    });

    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.appName).toBe('Tiens Bon');
    }
  });
});
