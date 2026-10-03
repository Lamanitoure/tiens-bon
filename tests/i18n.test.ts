import { describe, expect, it } from 'vitest';
import en from '../src/i18n/en.json';
import fr from '../src/i18n/fr.json';
import { getLanguage, initLanguage, setLanguage, t } from '../src/i18n/index.ts';

function getDeepKeys(obj: Record<string, unknown>, prefix = ''): string[] {
  let keys: string[] = [];
  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      keys = keys.concat(getDeepKeys(value as Record<string, unknown>, fullKey));
    } else {
      keys.push(fullKey);
    }
  }
  return keys.sort();
}

describe('i18n system and parity tests', () => {
  it('has complete key parity between French and English translations', () => {
    const frKeys = getDeepKeys(fr);
    const enKeys = getDeepKeys(en);

    expect(frKeys).toEqual(enKeys);
  });

  it('translates correctly with parameters and language switching', () => {
    initLanguage('fr');
    expect(getLanguage()).toBe('fr');
    expect(t('app.name')).toBe('Tiens Bon');

    setLanguage('en');
    expect(getLanguage()).toBe('en');
    expect(t('nav.home')).toBe('Home');

    // Switch back to French
    setLanguage('fr');
    expect(t('nav.home')).toBe('Accueil');
  });

  it('defines the app name in i18n data only', () => {
    expect(fr.app.name).toBe('Tiens Bon');
    expect(en.app.name).toBe('Tiens Bon');
  });
});
