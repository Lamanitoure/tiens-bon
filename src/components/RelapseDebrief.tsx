import { useEffect, useState } from 'react';
import { addPlan, getAllImages } from '../db/index.ts';
import { t } from '../i18n/index.ts';
import { generateMotivation } from '../lib/api.ts';
import { selectImageForRelapse } from '../lib/image-display.ts';
import type { ImageRecord } from '../schemas/images.ts';
import type { Profile } from '../schemas/profile.ts';
import { getRandomFallback, validateModelOutput } from '../security/safety.ts';
import { LeafIcon, RocketIcon } from './icons/index.ts';

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
  const [selectedMissing, setSelectedMissing] = useState<string>('alternative');
  const [planIf, setPlanIf] = useState<string>('Si j’ai envie de fumer avec mon café du matin');
  const [planThen, setPlanThen] = useState<string>(
    'Alors je bois un grand verre d’eau fraîche et je change de pièce',
  );
  const [consolidationNote, setConsolidationNote] = useState<string>('');
  const [encouragementPhrase, setEncouragementPhrase] = useState<string>('');
  const [wantToSavePlan, setWantToSavePlan] = useState<boolean>(true);
  const [calmImage, setCalmImage] = useState<ImageRecord | null>(null);

  useEffect(() => {
    // 0. Load calm-only image (Step 11 & Step 13 display rules)
    getAllImages()
      .then((imgs) => {
        const selected = selectImageForRelapse(imgs);
        setCalmImage(selected);
      })
      .catch(() => {});

    // 1. Pick authentic encouragement phrase from profile
    if (profile.phrases && profile.phrases.length > 0) {
      setEncouragementPhrase(profile.phrases[Math.floor(Math.random() * profile.phrases.length)]);
    }

    // 2. Fetch consolidation note from model or fallback (compassionate & non-guilt)
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
      } catch {
        // use fallback without network
      }
    })();
  }, [profile]);

  const handleSelectTrigger = (triggerKey: string) => {
    setSelectedTrigger(triggerKey);
    const triggerLabel = t(`relapse.triggers.${triggerKey}`);

    // Pre-populate compassionate and realistic if-then plan suggestions
    switch (triggerKey) {
      case 'coffee':
        setPlanIf('Si j’ai envie d’une cigarette avec mon café');
        setPlanThen('Alors je prends un grand verre d’eau fraîche et je change de place');
        break;
      case 'stress':
        setPlanIf('Si un coup de stress soudain me submerge');
        setPlanThen('Alors je fais 3 respirations complètes et je marche 2 minutes');
        break;
      case 'alcohol':
      case 'social':
        setPlanIf('Si je suis en soirée ou en groupe autour de fumeurs');
        setPlanThen('Alors je garde un verre frais à la main et je reste un peu à l’écart');
        break;
      case 'boredom':
        setPlanIf('Si je m’ennuie ou que j’attends');
        setPlanThen('Alors j’occupe mes mains avec une activité ou une courte marche');
        break;
      case 'argument':
        setPlanIf('Si une tension ou une dispute survient');
        setPlanThen('Alors je souffle 3 minutes avant de réagir');
        break;
      default:
        setPlanIf(`Si je me retrouve dans la situation : ${triggerLabel}`);
        setPlanThen('Alors je bois un verre d’eau et je respire profondément');
        break;
    }
  };

  const handleSaveAndRestart = async () => {
    let planSaved = false;
    if (wantToSavePlan && planIf.trim() && planThen.trim()) {
      try {
        await addPlan({
          id: `plan-${Date.now()}`,
          ifText: planIf.trim(),
          thenText: planThen.trim(),
        });
        planSaved = true;
      } catch {
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
      missingSupport: selectedMissing,
      planSaved: false,
    });
  };

  const triggersList = [
    { key: 'coffee', label: t('relapse.triggers.coffee') },
    { key: 'stress', label: t('relapse.triggers.stress') },
    { key: 'social', label: t('relapse.triggers.social') },
    { key: 'alcohol', label: t('relapse.triggers.alcohol') },
    { key: 'argument', label: t('relapse.triggers.argument') },
    { key: 'boredom', label: t('relapse.triggers.boredom') },
    { key: 'other', label: t('relapse.triggers.other') },
  ];

  const missingList = [
    { key: 'alternative', label: t('relapse.missing.alternative') },
    { key: 'support', label: t('relapse.missing.support') },
    { key: 'calm', label: t('relapse.missing.place') },
    { key: 'distraction', label: t('relapse.missing.time') },
  ];

  return (
    <div className="card space-y-5 p-5 bg-white dark:bg-stone-900 border-stone-200 dark:border-stone-800 text-stone-900 dark:text-stone-100 shadow-md">
      {/* Compassionate Header (Anti-alarm, No guilt) */}
      <div className="space-y-2 border-b border-stone-200 dark:border-stone-800 pb-3">
        <div className="flex items-center gap-2.5">
          <LeafIcon className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
          <div>
            <h3 className="text-sm font-bold text-stone-900 dark:text-stone-50">
              {t('relapse.title')}
            </h3>
            <p className="text-[11px] text-stone-500 dark:text-stone-400 font-medium">
              {t('relapse.subtitle')}
            </p>
          </div>
        </div>
        <p className="text-xs text-stone-700 dark:text-stone-300 leading-relaxed bg-stone-50 dark:bg-stone-800/60 p-3 rounded-xl border border-stone-200/80 dark:border-stone-700">
          {t('relapse.message')}
        </p>
      </div>

      {/* Soothing Calm Photo (Step 13: Calm ONLY, never motivating, never loved-one, never deterrent) */}
      {calmImage && (
        <div className="rounded-xl overflow-hidden border border-emerald-200/60 dark:border-emerald-900/60 bg-emerald-50/30 dark:bg-emerald-950/20 p-2.5 space-y-2">
          <div className="relative rounded-lg overflow-hidden h-36 bg-stone-900">
            <img
              src={calmImage.dataUrl}
              alt={calmImage.caption}
              className="w-full h-full object-cover"
            />
            <span className="absolute top-2 left-2 text-[10px] font-bold px-2 py-0.5 rounded-md bg-stone-900/80 text-white backdrop-blur-xs">
              {t('gallery.kinds.calm')}
            </span>
          </div>
          <p className="text-xs font-medium text-stone-800 dark:text-stone-200 italic px-1 leading-snug">
            « {calmImage.caption} »
          </p>
        </div>
      )}

      {/* Encouragement note */}
      {consolidationNote && (
        <div className="p-3 bg-emerald-50/70 dark:bg-emerald-950/40 border border-emerald-200/80 dark:border-emerald-800 rounded-xl space-y-1">
          <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-900 dark:text-emerald-300">
            Un mot pour souffler
          </div>
          <p className="text-xs text-stone-800 dark:text-stone-200 italic leading-relaxed">
            « {consolidationNote} »
          </p>
        </div>
      )}

      {/* Question 1: What happened? (Trigger selection) */}
      <div className="space-y-1.5">
        <span className="text-xs font-bold text-stone-900 dark:text-stone-100 block">
          1. {t('relapse.step1Title')}
        </span>
        <div className="flex flex-wrap gap-1.5">
          {triggersList.map((trig) => (
            <button
              key={trig.key}
              type="button"
              onClick={() => handleSelectTrigger(trig.key)}
              className={`text-xs px-3 py-1.5 rounded-lg border font-medium transition-all cursor-pointer min-h-[34px] ${
                selectedTrigger === trig.key
                  ? 'bg-emerald-800 dark:bg-emerald-700 text-white border-emerald-800 shadow-xs'
                  : 'bg-stone-50 dark:bg-stone-800 text-stone-700 dark:text-stone-300 border-stone-200 dark:border-stone-700 hover:bg-stone-100'
              }`}
            >
              {trig.label}
            </button>
          ))}
        </div>
      </div>

      {/* Question 2: What was missing? (support, distraction, calm, alternative) */}
      <div className="space-y-1.5">
        <span className="text-xs font-bold text-stone-900 dark:text-stone-100 block">
          2. {t('relapse.step2Title')}
        </span>
        <div className="grid grid-cols-2 gap-1.5">
          {missingList.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setSelectedMissing(item.key)}
              className={`text-xs text-left p-2.5 rounded-lg border transition-all cursor-pointer min-h-[38px] ${
                selectedMissing === item.key
                  ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-950 dark:text-emerald-200 border-emerald-300 dark:border-emerald-700 font-semibold'
                  : 'bg-stone-50 dark:bg-stone-800 text-stone-700 dark:text-stone-300 border-stone-200 dark:border-stone-700 hover:bg-stone-100'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* Question 3: What can we try next time? (If/Then Plan) */}
      <div className="space-y-2.5 pt-2 border-t border-stone-200 dark:border-stone-800">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-stone-900 dark:text-stone-100 block">
            3. {t('relapse.step3Title')}
          </span>
          <label className="flex items-center gap-1.5 text-[11px] text-stone-600 dark:text-stone-300 cursor-pointer">
            <input
              type="checkbox"
              checked={wantToSavePlan}
              onChange={(e) => setWantToSavePlan(e.target.checked)}
              className="accent-emerald-700 rounded"
            />
            <span>Enregistrer ce plan</span>
          </label>
        </div>

        {wantToSavePlan && (
          <div className="space-y-2 p-3 bg-stone-50 dark:bg-stone-800/50 rounded-xl border border-stone-200 dark:border-stone-700">
            <div className="space-y-1">
              <label
                htmlFor="plan-if-input"
                className="text-[11px] font-semibold text-stone-600 dark:text-stone-300 block"
              >
                {t('relapse.planIfLabel')}
              </label>
              <input
                id="plan-if-input"
                type="text"
                value={planIf}
                onChange={(e) => setPlanIf(e.target.value)}
                placeholder={t('relapse.planIfPlaceholder')}
                className="w-full px-3 py-2 text-xs rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100"
              />
            </div>

            <div className="space-y-1">
              <label
                htmlFor="plan-then-input"
                className="text-[11px] font-semibold text-stone-600 dark:text-stone-300 block"
              >
                {t('relapse.planThenLabel')}
              </label>
              <input
                id="plan-then-input"
                type="text"
                value={planThen}
                onChange={(e) => setPlanThen(e.target.value)}
                placeholder={t('relapse.planThenPlaceholder')}
                className="w-full px-3 py-2 text-xs rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100"
              />
            </div>
          </div>
        )}
      </div>

      {/* Authentic Voice Phrase */}
      {encouragementPhrase && (
        <blockquote className="text-xs italic text-stone-600 dark:text-stone-300 border-l-2 border-emerald-700 dark:border-emerald-400 pl-3 py-1">
          « {encouragementPhrase} »
        </blockquote>
      )}

      {/* Action Buttons */}
      <div className="space-y-2 pt-1">
        <button
          type="button"
          onClick={handleSaveAndRestart}
          className="btn-primary text-xs py-3 w-full cursor-pointer flex justify-center items-center gap-1.5 min-h-[46px]"
        >
          <RocketIcon className="w-4 h-4" />
          <span>{t('relapse.saveAndRestart')}</span>
        </button>

        <button
          type="button"
          onClick={handleSkip}
          className="btn-secondary text-xs py-2 w-full text-stone-600 dark:text-stone-300 border-transparent hover:bg-stone-100 dark:hover:bg-stone-800 cursor-pointer min-h-[38px]"
        >
          {t('relapse.skipDebrief')}
        </button>
      </div>
    </div>
  );
}
