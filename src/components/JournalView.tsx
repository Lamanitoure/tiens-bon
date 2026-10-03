import { useState } from 'react';
import { t } from '../i18n/index.ts';
import type { EventRecord } from '../schemas/events.ts';
import type { Profile } from '../schemas/profile.ts';
import { EveningCheckin } from './EveningCheckin.tsx';

interface JournalViewProps {
  profile: Profile;
  events: EventRecord[];
  onEventAdded: (newEvent: EventRecord) => void;
}

export function JournalView({ profile, events, onEventAdded }: JournalViewProps) {
  const [filter, setFilter] = useState<'all' | 'checkin' | 'resisted' | 'relapse'>('all');
  const [showCheckinForm, setShowCheckinForm] = useState(false);

  const filteredEvents = events
    .slice()
    .reverse()
    .filter((e) => {
      if (filter === 'all') return true;
      if (filter === 'checkin') return e.type === 'checkin';
      if (filter === 'resisted') return e.type === 'resisted';
      if (filter === 'relapse') return e.type === 'relapse';
      return true;
    });

  const handleCheckinSaved = (saved: EventRecord) => {
    setShowCheckinForm(false);
    onEventAdded(saved);
  };

  const getEventBadge = (evt: EventRecord) => {
    switch (evt.type) {
      case 'checkin':
        return {
          label: '🌙 Bilan de soirée',
          className:
            'bg-indigo-100 dark:bg-indigo-950/60 text-indigo-900 dark:text-indigo-200 border-indigo-200 dark:border-indigo-800',
        };
      case 'resisted':
        return {
          label: '🌱 Envie surmontée',
          className:
            'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-900 dark:text-emerald-200 border-emerald-200 dark:border-emerald-800',
        };
      case 'relapse':
        return {
          label: '⚠️ Rechute passagère',
          className:
            'bg-stone-200 dark:bg-stone-800 text-stone-900 dark:text-stone-300 border-stone-300 dark:border-stone-700',
        };
      default:
        return {
          label: 'Événement',
          className: 'bg-stone-100 text-stone-800 border-stone-200',
        };
    }
  };

  return (
    <div className="space-y-4">
      {/* Evening Check-in Trigger or Active Form (Step 15) */}
      {!showCheckinForm ? (
        <div className="card p-5 bg-gradient-to-r from-emerald-800 to-teal-900 text-white space-y-3 shadow-md">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold flex items-center gap-2">
              <span>🌙</span>
              <span>{t('checkin.title')}</span>
            </h3>
            <span className="text-[10px] font-semibold bg-white/20 px-2 py-0.5 rounded-full backdrop-blur-xs">
              2 min
            </span>
          </div>
          <p className="text-xs text-emerald-100/90 leading-relaxed">{t('checkin.subtitle')}</p>
          <button
            type="button"
            onClick={() => setShowCheckinForm(true)}
            className="w-full py-3 px-4 rounded-xl bg-white text-emerald-950 font-bold text-xs shadow-xs hover:bg-emerald-50 active:scale-95 transition-all cursor-pointer min-h-[44px] flex items-center justify-center gap-1.5"
          >
            <span>✍️</span>
            <span>{t('journalView.newCheckin')}</span>
          </button>
        </div>
      ) : (
        <EveningCheckin
          profile={profile}
          onSaved={handleCheckinSaved}
          onCancel={() => setShowCheckinForm(false)}
        />
      )}

      {/* Journal Timeline Card */}
      <div className="card space-y-4 p-5 bg-white dark:bg-stone-900 border-stone-200 dark:border-stone-800">
        <div className="flex items-center justify-between border-b border-stone-200 dark:border-stone-800 pb-2">
          <h3 className="text-sm font-bold text-stone-900 dark:text-stone-50 flex items-center gap-2">
            <span>📖</span>
            <span>{t('journalView.title')}</span>
          </h3>
          <span className="badge-status">
            {filteredEvents.length} {filteredEvents.length > 1 ? 'entrées' : 'entrée'}
          </span>
        </div>

        {/* Filter Chips */}
        <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none text-xs">
          {(
            [
              { key: 'all', label: t('journalView.filterAll') },
              { key: 'checkin', label: t('journalView.filterCheckins') },
              { key: 'resisted', label: t('journalView.filterCravings') },
              { key: 'relapse', label: t('journalView.filterRelapses') },
            ] as const
          ).map((btn) => (
            <button
              key={btn.key}
              type="button"
              onClick={() => setFilter(btn.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer shrink-0 min-h-[32px] ${
                filter === btn.key
                  ? 'bg-emerald-800 text-white shadow-xs'
                  : 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 hover:bg-stone-200 dark:hover:bg-stone-700'
              }`}
            >
              {btn.label}
            </button>
          ))}
        </div>

        {/* Event List */}
        {filteredEvents.length === 0 ? (
          <div className="py-8 text-center space-y-2 border border-dashed border-stone-200 dark:border-stone-800 rounded-2xl">
            <div className="text-3xl">🌱</div>
            <p className="text-xs text-stone-500 dark:text-stone-400 font-medium">
              {t('journalView.empty')}
            </p>
          </div>
        ) : (
          <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
            {filteredEvents.map((evt) => {
              const badge = getEventBadge(evt);
              const outcome = evt.debrief?.outcome;

              return (
                <div
                  key={evt.id}
                  className="p-3.5 rounded-2xl border border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-800/40 text-xs space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${badge.className}`}
                    >
                      {badge.label}
                    </span>
                    <span className="text-[10px] text-stone-500 dark:text-stone-400">
                      {new Date(evt.ts).toLocaleString(
                        profile.language === 'fr' ? 'fr-FR' : 'en-US',
                        {
                          hour: '2-digit',
                          minute: '2-digit',
                          day: '2-digit',
                          month: 'short',
                        },
                      )}
                    </span>
                  </div>

                  {/* Checkin specifics */}
                  {evt.type === 'checkin' && (
                    <div className="space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2 text-[11px]">
                        {outcome && (
                          <span
                            className={`px-2 py-0.5 rounded font-bold ${
                              outcome === 'resisted'
                                ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300'
                                : outcome === 'smoked'
                                  ? 'bg-stone-200 dark:bg-stone-700 text-stone-800 dark:text-stone-200'
                                  : 'bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300'
                            }`}
                          >
                            {outcome === 'resisted'
                              ? '🌱 Résisté'
                              : outcome === 'smoked'
                                ? '⚠️ Fumé'
                                : '❓ Partagé'}
                          </span>
                        )}
                        {evt.trigger && (
                          <span className="text-stone-700 dark:text-stone-300 font-semibold">
                            📍 {evt.trigger}
                          </span>
                        )}
                        {evt.emotion && (
                          <span className="text-stone-600 dark:text-stone-400 italic">
                            🎭 {evt.emotion}
                          </span>
                        )}
                      </div>

                      {evt.note && (
                        <p className="text-xs text-stone-700 dark:text-stone-300 bg-white dark:bg-stone-900 p-2.5 rounded-xl border border-stone-200/60 dark:border-stone-700/60 italic leading-relaxed">
                          « {evt.note} »
                        </p>
                      )}
                    </div>
                  )}

                  {/* Resisted or Relapse specifics */}
                  {evt.type !== 'checkin' && (
                    <div className="space-y-1">
                      {evt.trigger && (
                        <p className="text-xs font-semibold text-stone-900 dark:text-stone-100">
                          {evt.trigger}
                        </p>
                      )}
                      {evt.note && (
                        <p className="text-[11px] italic text-stone-500 dark:text-stone-400">
                          « {evt.note} »
                        </p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
