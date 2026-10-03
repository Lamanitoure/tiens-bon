import { useState } from 'react';
import { getLanguage, t } from '../i18n/index.ts';
import { activeConfig } from '../lib/config.ts';

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
    <section className="card space-y-3 border-emerald-200/80 dark:border-emerald-800/70 bg-white dark:bg-stone-900 p-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h3 className="text-xs font-bold text-stone-900 dark:text-stone-50 flex items-center gap-1.5">
            <span>🩺</span>
            <span>{t('facts.title')}</span>
          </h3>
          <p className="text-[11px] text-stone-500 dark:text-stone-400 mt-0.5">
            {t('facts.subtitle')}
          </p>
        </div>
        {factsForLang.length > 1 && (
          <button
            type="button"
            onClick={handleNext}
            className="btn-secondary !w-auto text-[11px] py-1.5 px-2.5 shrink-0 cursor-pointer"
          >
            ↻ {t('facts.nextFact')}
          </button>
        )}
      </div>

      <blockquote className="p-3 rounded-xl bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200/60 dark:border-emerald-800/60 text-xs text-stone-800 dark:text-stone-200 leading-relaxed font-medium">
        « {currentFact.text} »
      </blockquote>

      <div className="flex items-center justify-between text-[11px] text-stone-500 dark:text-stone-400">
        <span>
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
        <span className="font-mono text-[10px]">
          {(index % factsForLang.length) + 1}/{factsForLang.length}
        </span>
      </div>
    </section>
  );
}
