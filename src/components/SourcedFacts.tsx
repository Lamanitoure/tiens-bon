import { useState } from 'react';
import { getLanguage, t } from '../i18n/index.ts';
import { activeConfig } from '../lib/config.ts';
import { ExpandableText } from './ExpandableText.tsx';
import { RefreshIcon } from './icons/RefreshIcon.tsx';
import { StethoscopeIcon } from './icons/StethoscopeIcon.tsx';

export function SourcedFacts() {
  const lang = getLanguage();
  const factsForLang = activeConfig.facts.filter((f) => f.language === lang);
  const [index, setIndex] = useState(0);

  if (factsForLang.length === 0) return null;

  const currentFact = factsForLang[index % factsForLang.length];

  const handleNext = () => {
    setIndex((prev) => (prev + 1) % factsForLang.length);
  };

  return (
    <section className="card space-y-2.5 border-emerald-200/80 dark:border-emerald-800/70 bg-white dark:bg-stone-900 p-4">
      <div className="space-y-1">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-xs font-bold text-stone-900 dark:text-stone-50 flex items-center gap-1.5 min-w-0">
            <StethoscopeIcon className="w-4 h-4 text-emerald-700 dark:text-emerald-400 shrink-0" />
            <span className="truncate">{t('facts.title')}</span>
          </h3>

          {factsForLang.length > 1 && (
            <button
              type="button"
              onClick={handleNext}
              className="px-2.5 py-1 rounded-lg border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 hover:bg-stone-100 dark:hover:bg-stone-700 text-[11px] font-semibold text-stone-700 dark:text-stone-200 shrink-0 cursor-pointer flex items-center gap-1 whitespace-nowrap"
            >
              <RefreshIcon className="w-3 h-3 shrink-0" />
              <span>{lang === 'fr' ? 'Autre' : 'Next'}</span>
            </button>
          )}
        </div>

        <ExpandableText
          text={t('facts.subtitle')}
          maxChars={52}
          className="text-[11px] text-stone-500 dark:text-stone-400"
        />
      </div>

      <blockquote className="p-3 rounded-xl bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200/60 dark:border-emerald-800/60 text-xs text-stone-800 dark:text-stone-200 leading-relaxed font-medium">
        « {currentFact.text} »
      </blockquote>

      <div className="flex items-center justify-between text-[11px] text-stone-500 dark:text-stone-400">
        <span className="truncate mr-2">
          {t('facts.sourcePrefix')}{' '}
          <a
            href={currentFact.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-emerald-800 dark:text-emerald-400 underline hover:text-emerald-900"
          >
            {currentFact.sourceName}
          </a>
        </span>
        <span className="font-mono tabular-nums text-[10px] shrink-0">
          {(index % factsForLang.length) + 1}/{factsForLang.length}
        </span>
      </div>
    </section>
  );
}
