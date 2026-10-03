import { describe, expect, it } from 'vitest';
import { validateConfigurations } from '../src/lib/config.ts';
import {
  AppConfigSchema,
  DistressConfigSchema,
  SafetyConfigSchema,
} from '../src/schemas/config.ts';

describe('Configuration validation tests', () => {
  it('validates active config files successfully', () => {
    const configResult = validateConfigurations();
    expect(configResult.isValid).toBe(true);
    expect(configResult.errors.length).toBe(0);
    expect(configResult.app.challengeDurationSeconds).toBe(180);
    expect(configResult.distress.words.fr.length).toBeGreaterThan(0);
    expect(configResult.distress.words.en.length).toBeGreaterThan(0);
  });

  it('rejects an invalid app config missing mandatory fields', () => {
    const invalidApp = {
      defaultLanguage: 'fr',
      // missing supportedLanguages, challengeDurationSeconds, etc.
    };
    const result = AppConfigSchema.safeParse(invalidApp);
    expect(result.success).toBe(false);
  });

  it('rejects a safety config with empty blockedPatterns', () => {
    const invalidSafety = {
      blockedPatterns: [''], // empty string not allowed
      disallowedWords: [],
    };
    const result = SafetyConfigSchema.safeParse(invalidSafety);
    expect(result.success).toBe(false);
  });

  it('rejects a distress config missing a supported language', () => {
    const invalidDistress = {
      words: {
        fr: ['suicide'],
        // missing en
      },
    };
    const result = DistressConfigSchema.safeParse(invalidDistress);
    expect(result.success).toBe(false);
  });
});
