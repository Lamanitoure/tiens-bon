import { useEffect, useId, useState } from 'react';
import { getAllPregenerated, setStoredProfile } from '../db/index.ts';
import { t } from '../i18n/index.ts';
import { activeConfig } from '../lib/config.ts';
import {
  getScheduledReminders,
  type ScheduledReminder,
  sendLocalNotification,
} from '../lib/reminders.ts';
import type { PregeneratedMessage } from '../schemas/pregenerated.ts';
import type { Profile } from '../schemas/profile.ts';
import { BellIcon, ClockIcon, EyeOffIcon, SparklesIcon } from './icons/index.ts';

interface RemindersManagerProps {
  profile: Profile;
  onProfileUpdated: (updated: Profile) => void;
  onTriggerReminderBanner?: (reminder: ScheduledReminder) => void;
}

export function RemindersManager({
  profile,
  onProfileUpdated,
  onTriggerReminderBanner,
}: RemindersManagerProps) {
  const discreetToggleId = useId();
  const [isDiscreet, setIsDiscreet] = useState(profile.discreetMode ?? true);
  const [testStatus, setTestStatus] = useState<'idle' | 'success' | 'denied'>('idle');
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [pregenBatch, setPregenBatch] = useState<PregeneratedMessage[]>([]);

  useEffect(() => {
    getAllPregenerated()
      .then((items) => setPregenBatch(items))
      .catch(() => {});
  }, []);

  const leadTime = activeConfig.app.reminderLeadTimeMinutes ?? 10;
  const reminders = getScheduledReminders(profile, leadTime, isDiscreet, pregenBatch);

  const handleToggleDiscreet = async () => {
    const nextVal = !isDiscreet;
    setIsDiscreet(nextVal);
    const updated: Profile = {
      ...profile,
      discreetMode: nextVal,
    };
    try {
      await setStoredProfile(updated);
      onProfileUpdated(updated);
    } catch {
      // ignore
    }
  };

  const handleTestNotification = async (targetRem?: ScheduledReminder) => {
    setTestStatus('idle');
    const rem = targetRem || reminders[0];
    const title = rem ? rem.notificationTitle : 'Tiens Bon';
    const body = rem
      ? rem.notificationBody
      : isDiscreet
        ? 'Un petit instant de pause prévu pour toi.'
        : "Dans 10 min : pense à ton verre d'eau fraîche et respire !";

    if (rem && onTriggerReminderBanner) {
      onTriggerReminderBanner(rem);
    }

    const ok = await sendLocalNotification({
      title,
      body,
      tag: 'tiens-bon-test-reminder',
    });

    setTestStatus(ok ? 'success' : 'denied');
  };

  const handleCopyAlarmLabel = (text: string, index: number) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 2000);
    });
  };

  return (
    <div className="card space-y-5 p-5 bg-white dark:bg-stone-900 border-stone-200 dark:border-stone-800">
      {/* Header */}
      <div className="space-y-1">
        <h3 className="text-sm font-bold text-stone-900 dark:text-stone-50 flex items-center gap-1.5">
          <ClockIcon className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
          <span>{t('reminders.title')}</span>
        </h3>
        <p className="text-[11px] text-stone-500 dark:text-stone-400 font-medium">
          {t('reminders.subtitle', { leadTime: leadTime.toString() })}
        </p>
      </div>

      {/* Discreet Mode Toggle (Security Section 5 Item 19 & Step 14) */}
      <div className="p-3.5 rounded-2xl bg-stone-50 dark:bg-stone-800/60 border border-stone-200 dark:border-stone-700 space-y-2">
        <div className="flex items-center justify-between">
          <label
            htmlFor={discreetToggleId}
            className="text-xs font-bold text-stone-800 dark:text-stone-200 flex items-center gap-1.5 cursor-pointer"
          >
            <EyeOffIcon className="w-4 h-4 text-stone-600 dark:text-stone-400" />
            <span>{t('reminders.discreetModeTitle')}</span>
          </label>
          <input
            id={discreetToggleId}
            type="checkbox"
            checked={isDiscreet}
            onChange={handleToggleDiscreet}
            className="w-5 h-5 accent-emerald-700 cursor-pointer rounded"
          />
        </div>
        <p className="text-[11px] leading-relaxed text-stone-600 dark:text-stone-300">
          {isDiscreet ? t('reminders.discreetModeOn') : t('reminders.discreetModeOff')}
        </p>
      </div>

      {/* Test Notification Button */}
      <div className="space-y-2">
        <button
          type="button"
          onClick={() => handleTestNotification()}
          className="btn-secondary text-xs py-2.5 w-full cursor-pointer flex items-center justify-center gap-2 min-h-[42px]"
        >
          <BellIcon className="w-4 h-4" />
          <span>{t('reminders.testBtn')}</span>
        </button>

        {testStatus === 'success' && (
          <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-xs font-semibold text-center">
            {t('reminders.testSuccess')}
          </div>
        )}

        {testStatus === 'denied' && (
          <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800 text-xs font-medium text-center">
            {t('reminders.testDenied')}
          </div>
        )}
      </div>

      {/* Computed Scheduled Reminders List */}
      <div className="space-y-3">
        <h4 className="text-xs font-bold text-stone-600 dark:text-stone-400">
          Moments programmés ({reminders.length})
        </h4>

        {reminders.length === 0 ? (
          <p className="text-xs text-stone-400 italic py-2">{t('reminders.noWindows')}</p>
        ) : (
          <div className="space-y-3">
            {reminders.map((rem) => (
              <div
                key={rem.riskWindowLabel}
                className="p-3.5 rounded-2xl border border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-800/40 space-y-2.5 text-xs"
              >
                {/* Time comparison line */}
                <div className="flex items-center justify-between pb-1.5 border-b border-stone-200/60 dark:border-stone-700/60">
                  <span className="font-bold text-stone-900 dark:text-stone-100">
                    {rem.riskWindowLabel} ({rem.riskTime})
                  </span>
                  <span className="font-mono tabular-nums font-bold text-emerald-800 dark:text-emerald-400">
                    Rappel à {rem.reminderTime}
                  </span>
                </div>

                {/* Lock screen text preview */}
                <div className="space-y-1">
                  <span className="text-[10px] font-semibold text-stone-500 dark:text-stone-400 block">
                    {t('reminders.lockscreenPreview')}
                  </span>
                  <div className="p-2 rounded-xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 font-mono text-[11px] text-stone-800 dark:text-stone-200">
                    « {rem.notificationBody} »
                  </div>
                </div>

                {/* Inside app message (from Gemma pre-generated batch or personalized fallback) */}
                <div className="space-y-1">
                  <span className="text-[10px] font-semibold text-stone-500 dark:text-stone-400 flex items-center gap-1">
                    <SparklesIcon className="w-3 h-3 text-emerald-700 dark:text-emerald-400" />
                    <span>{t('reminders.appMessagePreview')}</span>
                  </span>
                  <p className="italic text-stone-700 dark:text-stone-300 pl-2 border-l-2 border-emerald-700 dark:border-emerald-500">
                    « {rem.fullMessage} »
                  </p>
                </div>

                <div className="pt-1 flex justify-end">
                  <button
                    type="button"
                    onClick={() => handleTestNotification(rem)}
                    className="text-[11px] font-semibold text-emerald-800 dark:text-emerald-400 underline cursor-pointer hover:opacity-80"
                  >
                    Simuler ce rappel ({rem.reminderTime})
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Plan B: Native Clock Alarms Helper (Step 5c & Step 14) */}
      <div className="p-4 rounded-2xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/80 dark:border-amber-800/60 space-y-3">
        <div className="space-y-1">
          <h4 className="text-xs font-bold text-amber-950 dark:text-amber-200 flex items-center gap-1.5">
            <ClockIcon className="w-4 h-4 text-amber-700 dark:text-amber-400" />
            <span>{t('reminders.planBTitle')}</span>
          </h4>
          <p className="text-[11px] text-amber-900/80 dark:text-amber-300/80 leading-relaxed">
            {t('reminders.planBSubtitle')}
          </p>
        </div>

        <div className="space-y-2">
          {reminders.map((rem, idx) => {
            const alarmLabel = isDiscreet
              ? `Pause de ${rem.reminderTime}`
              : `${rem.riskWindowLabel} : ${rem.alternative}`;

            return (
              <div
                key={rem.reminderTime}
                className="flex items-center justify-between p-2.5 rounded-xl bg-white dark:bg-stone-900 border border-amber-200/60 dark:border-amber-800/40 text-xs"
              >
                <div>
                  <span className="font-mono tabular-nums font-bold text-amber-950 dark:text-amber-200 text-sm">
                    {rem.reminderTime}
                  </span>
                  <span className="text-[11px] text-stone-500 dark:text-stone-400 ml-2">
                    ({alarmLabel})
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => handleCopyAlarmLabel(alarmLabel, idx)}
                  className="text-[11px] px-2.5 py-1 rounded-lg border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200 font-semibold hover:bg-amber-100 cursor-pointer"
                >
                  {copiedIndex === idx ? t('reminders.copied') : t('reminders.copyLabel')}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
