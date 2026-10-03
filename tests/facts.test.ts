import { describe, expect, it } from 'vitest';
import factsRaw from '../config/facts.json';
import { activeConfig } from '../src/lib/config.ts';
import { FactSchema, FactsListSchema } from '../src/schemas/facts.ts';

describe('Step 17: Sourced Health Facts', () => {
  it('validates config/facts.json against FactsListSchema', () => {
    const parsed = FactsListSchema.safeParse(factsRaw);
    expect(parsed.success).toBe(true);
    expect(activeConfig.isValid).toBe(true);
    expect(activeConfig.facts.length).toBeGreaterThanOrEqual(4);
  });

  it('requires every fact to have a non-empty official sourceName and https sourceUrl', () => {
    for (const fact of activeConfig.facts) {
      expect(fact.sourceName.trim().length).toBeGreaterThan(2);
      expect(fact.sourceUrl.startsWith('https://')).toBe(true);
    }
  });

  it('provides hand-written sourced facts in both French and English', () => {
    const frFacts = activeConfig.facts.filter((f) => f.language === 'fr');
    const enFacts = activeConfig.facts.filter((f) => f.language === 'en');
    expect(frFacts.length).toBeGreaterThan(0);
    expect(enFacts.length).toBeGreaterThan(0);
  });

  it('rejects a fact without a sourceUrl or with an extra unknown field', () => {
    const missingUrl = FactSchema.safeParse({
      id: 'bad-1',
      language: 'fr',
      text: 'Un fait sans source officielle.',
      sourceName: 'OMS',
    });
    expect(missingUrl.success).toBe(false);

    const extraField = FactSchema.safeParse({
      id: 'bad-2',
      language: 'en',
      text: 'A valid length text for testing strict mode.',
      sourceName: 'WHO',
      sourceUrl: 'https://www.who.int/',
      extra: 'not-allowed',
    });
    expect(extraField.success).toBe(false);
  });
});
