import { describe, expect, it } from 'vitest';
import demoProfile from '../demo/profile.demo.json';
import {
  CheckinExtractionSchema,
  CravingOutputSchema,
  EventSchema,
  ProfileSchema,
} from '../src/schemas/index.ts';

describe('Zod Schemas validation', () => {
  it('validates the fictional demo profile successfully', () => {
    const result = ProfileSchema.safeParse(demoProfile);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.language).toBe('fr');
      expect(result.data.helpline.label).toBe('Tabac Info Service');
      expect(result.data.phrases.length).toBeGreaterThanOrEqual(10);
    }
  });

  it('rejects a profile without the required helpline (Section 4 & 7)', () => {
    // Clone and remove helpline
    const invalidProfile = { ...demoProfile } as Record<string, unknown>;
    delete invalidProfile.helpline;

    const result = ProfileSchema.safeParse(invalidProfile);
    expect(result.success).toBe(false);
  });

  it('rejects a profile with extra unexpected fields due to .strict() (Item 14)', () => {
    const invalidProfile = {
      ...demoProfile,
      unexpectedField: 'forbidden',
    };

    const result = ProfileSchema.safeParse(invalidProfile);
    expect(result.success).toBe(false);
  });

  it('rejects invalid risk window time formats', () => {
    const invalidProfile = {
      ...demoProfile,
      riskWindows: [{ label: 'Morning', time: '25:99' }],
    };

    const result = ProfileSchema.safeParse(invalidProfile);
    expect(result.success).toBe(false);
  });

  it('validates event schema correctly', () => {
    const validEvent = {
      id: 'evt-12345',
      ts: Date.now(),
      type: 'craving',
      trigger: 'coffee',
    };
    const result = EventSchema.safeParse(validEvent);
    expect(result.success).toBe(true);

    const invalidEvent = {
      id: 'evt-12345',
      ts: Date.now(),
      type: 'invalid_type',
    };
    expect(EventSchema.safeParse(invalidEvent).success).toBe(false);
  });

  it('validates model outputs (CravingOutput and CheckinExtraction)', () => {
    const validCraving = {
      challenge: 'Take 5 deep breaths and drink a glass of water.',
      message: 'Hold on, you have got this.',
    };
    expect(CravingOutputSchema.safeParse(validCraving).success).toBe(true);

    const validCheckin = {
      trigger: 'stressful call',
      emotion: 'anxious',
      outcome: 'resisted',
    };
    expect(CheckinExtractionSchema.safeParse(validCheckin).success).toBe(true);
  });
});
