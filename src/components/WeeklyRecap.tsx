import { useState } from 'react';
import { setStoredProfile } from '../db/index.ts';
import { t } from '../i18n/index.ts';
import {
  computeWeeklyStats,
  detectLearnedRiskWindows,
  type ProposedRiskWindow,
} from '../lib/recap.ts';
import { generateWeeklyRecap } from '../lib/recap-model.ts';
import type { EventRecord } from '../schemas/events.ts';
import { type Profile, ProfileSchema, type RiskWindow } from '../schemas/profile.ts';

interface WeeklyRecapProps {
  events: EventRecord[];
  profile: Profile;
  onProfileUpdated: (updated: Profile) => void;
}

export function WeeklyRecap({ events, profile, onProfileUpdated }: WeeklyRecapProps) {
  const stats = computeWeeklyStats(events, profile);
  const learnedProposals = detectLearnedRiskWindows(events, profile);

  const [dismissedProposals, setDismissedProposals] = useState<string[]>([]);
  const [addedNotice, setAddedNotice] = useState<string | null>(null);

  // Model-generated encouraging note
  const [recapNote, setRecapNote] = useState<string | null>(null);
  const [isGeneratingNote, setIsGeneratingNote] = useState(false);

  const activeProposals = learnedProposals.filter((p) => !dismissedProposals.includes(p.time));

  const handleAcceptProposal = async (proposal: ProposedRiskWindow) => {
    const newWindow: RiskWindow = {
      label: proposal.label,
      time: proposal.time,
    };

    const updatedProfile: Profile = {
      ...profile,
      riskWindows: [...profile.riskWindows, newWindow],
    };

    // Strict validation with Zod
    const validated = ProfileSchema.parse(updatedProfile);
    await setStoredProfile(validated);
    onProfileUpdated(validated);

    setDismissedProposals((prev) => [...prev, proposal.time]);
    setAddedNotice(
      t('recap.windowAddedNotice', {
        label: proposal.label,
        time: proposal.time,
      }),
    );
    setTimeout(() => setAddedNotice(null), 4000);
  };

  const handleDeclineProposal = (time: string) => {
    setDismissedProposals((prev) => [...prev, time]);
  };

  const handleGenerateNote = async () => {
    setIsGeneratingNote(true);
    try {
      const note = await generateWeeklyRecap(stats, profile);
      setRecapNote(note);
    } finally {
      setIsGeneratingNote(false);
    }
  };

  return (
    <div className="card space-y-5 p-5 bg-white dark:bg-stone-900 border-stone-200 dark:border-stone-800 text-xs">
      {/* Header */}
      <div className="space-y-1 pb-2 border-b border-stone-200 dark:border-stone-800">
        <h3 className="text-sm font-bold text-stone-900 dark:text-stone-50 flex items-center gap-2">
          <span>📊</span>
          <span>{t('recap.title')}</span>
        </h3>
        <p className="text-[11px] text-stone-500 dark:text-stone-400 font-medium">
          {t('recap.subtitle')}
        </p>
      </div>

      {/* Aggregate Metrics Grid */}
      <div className="grid grid-cols-2 gap-2.5">
        {/* Resisted Cravings */}
        <div className="p-3.5 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/40 border border-emerald-200/80 dark:border-emerald-800/60 space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-900 dark:text-emerald-300 block">
            {t('recap.cravingsResisted')}
          </span>
          <div className="flex items-baseline gap-1.5">
            <span className="text-xl font-black text-emerald-900 dark:text-emerald-200">
              {stats.resistedCount}
            </span>
            <span className="text-[11px] text-emerald-800 dark:text-emerald-400 font-semibold">
              / {stats.totalEvents} ({stats.resistedRate}%)
            </span>
          </div>
        </div>

        {/* Savings to date */}
        <div className="p-3.5 rounded-2xl bg-stone-50 dark:bg-stone-800/60 border border-stone-200 dark:border-stone-700 space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-stone-600 dark:text-stone-400 block">
            {t('recap.moneySaved')}
          </span>
          <div className="flex items-baseline gap-1.5">
            <span className="text-xl font-black text-stone-900 dark:text-stone-100">
              {stats.savingsToDate} {stats.currency}
            </span>
          </div>
          {/* Progress bar towards goal */}
          <div className="w-full bg-stone-200 dark:bg-stone-700 h-1.5 rounded-full overflow-hidden mt-1">
            <div
              className="bg-emerald-600 h-full rounded-full transition-all duration-500"
              style={{ width: `${stats.goalProgress}%` }}
            />
          </div>
          <span className="text-[9px] text-stone-500 dark:text-stone-400 font-medium block">
            {t('recap.goalProgress', {
              goal: profile.savingsGoal?.label || 'Objectif',
              percent: stats.goalProgress.toString(),
            })}
          </span>
        </div>
      </div>

      {/* Top Recurring Triggers */}
      <div className="space-y-2">
        <h4 className="text-xs font-bold text-stone-800 dark:text-stone-200">
          {t('recap.topTriggers')}
        </h4>
        {stats.topTriggers.length === 0 ? (
          <p className="text-stone-400 italic text-[11px] py-1">{t('recap.noTriggers')}</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {stats.topTriggers.map((trig) => (
              <span
                key={trig.trigger}
                className="px-2.5 py-1 rounded-xl bg-stone-100 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-stone-800 dark:text-stone-200 font-medium text-[11px] flex items-center gap-1.5"
              >
                <span>📍 {trig.trigger}</span>
                <span className="font-bold text-emerald-800 dark:text-emerald-400">
                  ×{trig.count}
                </span>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Learned Risk Windows Section (Step 16: explicit user confirmation required) */}
      {addedNotice && (
        <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200 font-semibold text-center animate-fade-in text-xs">
          {addedNotice}
        </div>
      )}

      {activeProposals.length > 0 && (
        <div className="space-y-2.5 pt-1 border-t border-stone-200 dark:border-stone-800">
          <div className="flex items-center gap-1.5 text-xs font-bold text-amber-900 dark:text-amber-300">
            <span>💡</span>
            <span>{t('recap.learnedWindowsTitle')}</span>
          </div>

          {activeProposals.map((prop) => (
            <div
              key={prop.time}
              className="p-3.5 rounded-2xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/80 space-y-3"
            >
              <p className="text-xs text-amber-950 dark:text-amber-200 font-medium leading-relaxed">
                {prop.rationale}
              </p>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => handleAcceptProposal(prop)}
                  className="btn-primary text-xs py-2 px-3 flex-1 cursor-pointer flex items-center justify-center gap-1.5 min-h-[38px]"
                >
                  <span>✓</span>
                  <span>{t('recap.acceptBtn')}</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleDeclineProposal(prop.time)}
                  className="btn-secondary text-xs py-2 px-3 cursor-pointer min-h-[38px]"
                >
                  {t('recap.declineBtn')}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Optional Short Encouraging Weekly Note (Step 16) */}
      <div className="space-y-2 pt-1 border-t border-stone-200 dark:border-stone-800">
        {!recapNote ? (
          <button
            type="button"
            onClick={handleGenerateNote}
            disabled={isGeneratingNote}
            className="btn-secondary text-xs py-2.5 w-full cursor-pointer flex items-center justify-center gap-2 min-h-[42px] disabled:opacity-50"
          >
            <span>{isGeneratingNote ? '⏳' : '✨'}</span>
            <span>{isGeneratingNote ? t('recap.generating') : t('recap.generateRecapBtn')}</span>
          </button>
        ) : (
          <div className="p-3.5 rounded-2xl bg-emerald-50/50 dark:bg-emerald-950/30 border border-emerald-200/80 dark:border-emerald-800/60 space-y-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-900 dark:text-emerald-300 block">
              {t('recap.encouragementTitle')}
            </span>
            <blockquote className="italic text-xs text-stone-800 dark:text-stone-200 leading-relaxed border-l-2 border-emerald-700 pl-2.5">
              « {recapNote} »
            </blockquote>
          </div>
        )}
      </div>
    </div>
  );
}
