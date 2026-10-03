import en from './en.json';
import fr from './fr.json';

export type Language = 'fr' | 'en';

const translations: Record<Language, typeof fr> = {
  fr,
  en,
};

let currentLang: Language = 'fr';
const listeners = new Set<(lang: Language) => void>();

export function getLanguage(): Language {
  return currentLang;
}

export function setLanguage(lang: Language): void {
  if (lang !== 'fr' && lang !== 'en') return;
  currentLang = lang;
  try {
    localStorage.setItem('tb_language', lang);
  } catch {
    // localStorage might be unavailable
  }
  for (const listener of listeners) {
    listener(lang);
  }
}

export function initLanguage(fallback: Language = 'fr'): Language {
  try {
    const saved = localStorage.getItem('tb_language');
    if (saved === 'fr' || saved === 'en') {
      currentLang = saved;
      return saved;
    }
  } catch {
    // ignore
  }
  currentLang = fallback;
  return fallback;
}

export function subscribeLanguage(callback: (lang: Language) => void): () => void {
  listeners.add(callback);
  return () => {
    listeners.delete(callback);
  };
}

export function t(path: string, params?: Record<string, string | number>): string {
  const keys = path.split('.');
  // biome-ignore lint/suspicious/noExplicitAny: generic nested lookup
  let current: any = translations[currentLang] || translations.fr;

  for (const key of keys) {
    if (current && typeof current === 'object' && key in current) {
      current = current[key];
    } else {
      // Fallback to French if missing
      // biome-ignore lint/suspicious/noExplicitAny: generic nested lookup
      let fallbackCurrent: any = translations.fr;
      for (const k of keys) {
        if (fallbackCurrent && typeof fallbackCurrent === 'object' && k in fallbackCurrent) {
          fallbackCurrent = fallbackCurrent[k];
        } else {
          return path;
        }
      }
      current = fallbackCurrent;
      break;
    }
  }

  if (typeof current !== 'string') {
    return path;
  }

  let result = current;
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      result = result.replace(new RegExp(`{${k}}`, 'g'), String(v));
    }
  }

  return result;
}
