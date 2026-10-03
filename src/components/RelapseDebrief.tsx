import { useEffect, useState } from 'react';
import { addPlan } from '../db/index.ts';
import { t } from '../i18n/index.ts';
import { generateMotivation } from '../lib/api.ts';
import type { Profile } from '../schemas/profile.ts';
import { getRandomFallback, validateModelOutput } from '../security/safety.ts';

interface RelapseDebriefProps {
  profile: Profile;
  onFinish: (debriefData: {
    trigger: string;
    missingSupport?: string;
    note?: string;
    planSaved?: boolean;
  }) => void;
}

export function RelapseDebrief({ profile, onFinish }: RelapseDebriefProps) {
  const [selectedTrigger, setSelectedTrigger] = useState<string>('coffee');
  const [selectedMissing, setSelectedMissing] = useState<string>('time');
  const [planIf, setPlanIf] = useState<string>('');
  const [planThen, setPlanThen] = useState<string>('');
  const [consolidationNote, setConsolidationNote] = useState<string>('');
  const [encouragementPhrase, setEncouragementPhrase] = useState<string>('');

  useEffect(() => {
    // 1. Pick authentic encouragement phrase from profile
    if (profile.phrases && profile.phrases.length > 0) {
      setEncouragementPhrase(profile.phrases[Math.floor(Math.random() * profile.phrases.length)]);
    }

    // 2. Fetch consolidation note from Gemma or fallback
    const fallback = getRandomFallback(profile.language);
    setConsolidationNote(fallback.message);

    (async () => {
      try {
        const prompt = `Camille had a slip and smoked. Write a warm 2-sentence non-guilt message encouraging her to restart gently. Tone: ${profile.tone}. Return JSON: {"challenge": "Take a deep breath and drink water", "message": "..."}`;
        const output = await generateMotivation(prompt);
        const validated = validateModelOutput(output, profile.language);
        if (validated.sanitized?.message) {
          setConsolidationNote(validated.sanitized.message);
        }
      } catch (_err) {
        // use fallback without network
      }
    })();
  }, [profile]);

  const handleSelectTrigger = (triggerKey: string) => {
    setSelectedTrigger(triggerKey);
    if (!planIf) {
      const triggerLabel = t(`relapse.triggers.${triggerKey}`);
      setPlanIf(`Si je me retrouve dans la situation : ${triggerLabel}`);
    }
  };

  const handleSaveAndRestart = async () => {
    let planSaved = false;
    if (planIf.trim() && planThen.trim()) {
      try {
        await addPlan({
          id: `plan-${Date.now()}`,
          ifText: planIf.trim(),
          thenText: planThen.trim(),
        });
        planSaved = true;
      } catch (_err) {
        // ignore
      }
    }

    onFinish({
      trigger: selectedTrigger,
      missingSupport: selectedMissing,
      note: planThen ? `Plan: Si ${planIf} -> Alors ${planThen}` : undefined,
      planSaved,
    });
  };

  const handleSkip = () => {
    onFinish({
      trigger: selectedTrigger,
    });
  };

  const triggersList = [
    { key: 'coffee', label: t('relapse.triggers.coffee') },
    { key: 'alcohol', label: t('relapse.triggers.alcohol') },
    { key: 'stress', label: t('relapse.triggers.stress') },
    { key: 'argument', label: t('relapse.triggers.argument') },
    { key: 'boredom', label: t('relapse.triggers.boredom') },
    { key: 'social', label: t('relapse.triggers.social') },
    { key: 'other', label: t('relapse.triggers.other') },
  ];

  const missingList = [
    { key: 'time', label: t('relapse.missing.time') },
    { key: 'support', label: t('relapse.missing.support') },
    { key: 'place', label: t('relapse.missing.place') },
    { key: 'alternative', label: t('relapse.missing.alternative') },
  ];

  return (
    <div className="card space-y-6 p-6 bg-white border-stone-200 text-stone-900 shadow-md">
      {/* Compassionate Header */}
      <div className="space-y-2 border-b border-stone-200 pb-4">
        <div className="flex items-center gap-2.5">
          <span className="text-2xl">🌱</span>
          <div>
            <h3 className="text-base font-bold text-stone-900">{t('relapse.title')}</h3>
            <p className="text-xs text-stone-500 font-medium">{t('relapse.subtitle')}</p>
          </div>
        </div>
        <p className="text-xs text-stone-700 leading-relaxed bg-stone-50 p-3 rounded-xl border border-stone-200/80">
          {t('relapse.message')}
        </p>
      </div>

      {/* Consolidation Note */}
      {consolidationNote && (
        <div className="p-3.5 bg-emerald-50/70 border border-emerald-200/80 rounded-xl space-y-1">
          <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-900">
            Un mot pour souffler
          </div>
          <p className="text-xs text-stone-800 italic leading-relaxed">« {consolidationNote} »</p>
        </div>
      )}

      {/* Step 1: Trigger Selection */}
      <div className="space-y-2">
        <h4 className="text-xs font-bold text-stone-900 block">{t('relapse.step1Title')}</h4>
        <div className="flex flex-wrap gap-2">
          {triggersList.map((trig) => (
            <button
              key={trig.key}
              type="button"
              onClick={() => handleSelectTrigger(trig.key)}
              className={`text-xs px-3 py-1.5 rounded-lg border font-medium transition-all cursor-pointer ${
                selectedTrigger === trig.key
                  ? 'bg-emerald-800 text-white border-emerald-800 shadow-xs'
                  : 'bg-stone-50 text-stone-700 border-stone-300 hover:bg-stone-100'
              }`}
            >
              {trig.label}
            </button>
          ))}
        </div>
      </div>

      {/* Step 2: What was missing */}
      <div className="space-y-2">
        <h4 className="text-xs font-bold text-stone-900 block">{t('relapse.step2Title')}</h4>
        <div className="flex flex-col gap-1.5">
          {missingList.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setSelectedMissing(item.key)}
              className={`text-xs text-left px-3 py-2 rounded-lg border transition-all cursor-pointer ${
                selectedMissing === item.key
                  ? 'bg-emerald-50 text-emerald-950 border-emerald-300 font-semibold'
                  : 'bg-stone-50 text-stone-700 border-stone-200 hover:bg-stone-100'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* Step 3: If/Then Plan Adjustment */}
      <div className="space-y-3 pt-1 border-t border-stone-100">
        <h4 className="text-xs font-bold text-stone-900 block">{t('relapse.step3Title')}</h4>

        <div className="space-y-1">
          <label htmlFor="plan-if-input" className="text-[11px] font-semibold text-stone-600 block">
            {t('relapse.planIfLabel')}
          </label>
          <input
            id="plan-if-input"
            type="text"
            value={planIf}
            onChange={(e) => setPlanIf(e.target.value)}
            placeholder={t('relapse.planIfPlaceholder')}
            className="w-full px-3 py-2 text-xs rounded-lg border border-stone-300 bg-stone-50 text-stone-900 focus:bg-white"
          />
        </div>

        <div className="space-y-1">
          <label
            htmlFor="plan-then-input"
            className="text-[11px] font-semibold text-stone-600 block"
          >
            {t('relapse.planThenLabel')}
          </label>
          <input
            id="plan-then-input"
            type="text"
            value={planThen}
            onChange={(e) => setPlanThen(e.target.value)}
            placeholder={t('relapse.planThenPlaceholder')}
            className="w-full px-3 py-2 text-xs rounded-lg border border-stone-300 bg-stone-50 text-stone-900 focus:bg-white"
          />
        </div>
      </div>

      {/* Personal Voice Phrase */}
      {encouragementPhrase && (
        <blockquote className="text-xs italic text-stone-600 border-l-2 border-emerald-700 pl-3 py-1">
          « {encouragementPhrase} »
        </blockquote>
      )}

      {/* Actions */}
      <div className="space-y-2 pt-2">
        <button
          type="button"
          onClick={handleSaveAndRestart}
          className="btn-primary text-xs py-3 w-full cursor-pointer flex justify-center items-center gap-1.5"
        >
          <span>🚀</span> {t('relapse.saveAndRestart')}
        </button>

        <button
          type="button"
          onClick={handleSkip}
          className="btn-secondary text-xs py-2 w-full text-stone-600 border-transparent hover:bg-stone-100 cursor-pointer"
        >
          {t('relapse.skipDebrief')}
        </button>
      </div>
    </div>
  );
}
