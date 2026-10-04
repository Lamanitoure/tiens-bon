import { useState } from 'react';
import { t } from '../i18n/index.ts';
import type { LockSettings } from '../schemas/settings.ts';
import {
  disableAppPinLock,
  enableAppPinLock,
  PIN_REGEX,
  verifyPinAgainstSettings,
} from '../security/pin-lock.ts';
import { AlertTriangleIcon } from './icons/AlertTriangleIcon.tsx';
import { CheckIcon } from './icons/CheckIcon.tsx';
import { LockIcon } from './icons/LockIcon.tsx';

interface AppPinLockCardProps {
  lockSettings: LockSettings | undefined;
  onLockSettingsChanged: (next: LockSettings) => void;
  onLockNow: () => void;
}

export function AppPinLockCard({
  lockSettings,
  onLockSettingsChanged,
  onLockNow,
}: AppPinLockCardProps) {
  const [pinInput, setPinInput] = useState('');
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const isEnabled = Boolean(lockSettings?.enabled);

  const handleEnable = async () => {
    setErrorMsg(null);
    setStatusMsg(null);
    if (!PIN_REGEX.test(pinInput.trim())) {
      setErrorMsg(t('pinLock.invalidPinFormat'));
      return;
    }
    try {
      const next = await enableAppPinLock(pinInput.trim());
      setPinInput('');
      onLockSettingsChanged(next);
      setStatusMsg(t('pinLock.enabledSuccess'));
    } catch {
      setErrorMsg(t('pinLock.invalidPinFormat'));
    }
  };

  const handleDisable = async () => {
    setErrorMsg(null);
    setStatusMsg(null);
    await disableAppPinLock();
    onLockSettingsChanged({ enabled: false });
    setStatusMsg(t('pinLock.disabledSuccess'));
  };

  return (
    <section className="card space-y-3 border-stone-200 dark:border-stone-700">
      <div className="space-y-1">
        <h4 className="text-xs font-bold text-stone-900 dark:text-stone-50 flex items-center gap-1.5">
          <LockIcon className="w-4 h-4 text-emerald-700 dark:text-emerald-400 shrink-0" />
          <span>{t('pinLock.title')}</span>
        </h4>
        <p className="text-[11px] text-stone-600 dark:text-stone-300 leading-relaxed">
          {t('pinLock.subtitle')}
        </p>
      </div>

      <div className="p-2.5 rounded-xl bg-stone-100 dark:bg-stone-800/80 text-[11px] text-stone-600 dark:text-stone-300 leading-relaxed space-y-1">
        <p>{t('pinLock.honestNote')}</p>
        <p className="font-semibold text-amber-900 dark:text-amber-300 flex items-start gap-1.5">
          <AlertTriangleIcon className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          <span>{t('pinLock.warningForgotten')}</span>
        </p>
      </div>

      {!isEnabled ? (
        <div className="flex gap-2">
          <input
            type="password"
            inputMode="numeric"
            maxLength={8}
            value={pinInput}
            onChange={(e) => setPinInput(e.target.value.replace(/\D/g, ''))}
            placeholder={t('pinLock.pinPlaceholder')}
            aria-label={t('pinLock.pinPlaceholder')}
            className="flex-1 px-3 py-2 text-xs rounded-lg border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-900 dark:text-stone-100"
          />
          <button
            type="button"
            onClick={handleEnable}
            className="btn-primary !w-auto text-xs py-2 px-3 shrink-0 cursor-pointer min-h-[40px]"
          >
            {t('pinLock.enableBtn')}
          </button>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onLockNow}
            className="btn-primary text-xs py-2.5 px-3 flex-1 cursor-pointer min-h-[40px] flex items-center justify-center gap-1.5"
          >
            <LockIcon className="w-3.5 h-3.5 shrink-0" />
            <span>{t('pinLock.lockNowBtn')}</span>
          </button>
          <button
            type="button"
            onClick={handleDisable}
            className="btn-secondary !w-auto text-xs py-2.5 px-3 cursor-pointer min-h-[40px]"
          >
            {t('pinLock.disableBtn')}
          </button>
        </div>
      )}

      {statusMsg && (
        <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-900 dark:text-emerald-200 text-xs border border-emerald-200 dark:border-emerald-800 flex items-center gap-1.5">
          <CheckIcon className="w-3.5 h-3.5 shrink-0" />
          <span>{statusMsg}</span>
        </div>
      )}
      {errorMsg && (
        <div className="p-2 rounded-lg bg-rose-50 dark:bg-rose-950/60 text-rose-900 dark:text-rose-200 text-xs border border-rose-200 dark:border-rose-800">
          {errorMsg}
        </div>
      )}
    </section>
  );
}

interface AppPinUnlockOverlayProps {
  lockSettings: LockSettings;
  onUnlocked: () => void;
  onResetAllData: () => Promise<void>;
}

export function AppPinUnlockOverlay({
  lockSettings,
  onUnlocked,
  onResetAllData,
}: AppPinUnlockOverlayProps) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);

  const handleUnlock = async () => {
    setError(null);
    const ok = await verifyPinAgainstSettings(pin.trim(), lockSettings);
    if (ok) {
      setPin('');
      onUnlocked();
    } else {
      setError(t('pinLock.wrongPin'));
    }
  };

  return (
    <main className="min-h-screen bg-stone-100 dark:bg-stone-950 flex items-center justify-center p-6 text-stone-900 dark:text-stone-100">
      <div className="card max-w-sm w-full p-6 space-y-4 shadow-md border-stone-200 dark:border-stone-800">
        <div className="text-center space-y-1">
          <div className="w-12 h-12 rounded-2xl bg-emerald-800 text-white flex items-center justify-center font-bold text-lg mx-auto shadow-sm">
            <LockIcon className="w-6 h-6" />
          </div>
          <h1 className="text-lg font-bold pt-2">{t('pinLock.unlockTitle')}</h1>
          <p className="text-xs text-stone-500 dark:text-stone-400">
            {t('pinLock.unlockSubtitle')}
          </p>
        </div>

        <div className="space-y-2">
          <input
            type="password"
            inputMode="numeric"
            maxLength={8}
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleUnlock();
              }
            }}
            placeholder={t('pinLock.pinPlaceholder')}
            aria-label={t('pinLock.pinPlaceholder')}
            className="w-full px-3 py-3 text-center tracking-widest text-base font-bold rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800"
          />

          {error && (
            <div className="p-2 text-center rounded-lg bg-rose-50 dark:bg-rose-950/60 text-rose-800 dark:text-rose-200 text-xs border border-rose-200 dark:border-rose-800">
              {error}
            </div>
          )}

          <button
            type="button"
            onClick={handleUnlock}
            className="btn-primary w-full py-3 text-xs font-bold cursor-pointer min-h-[48px]"
          >
            {t('pinLock.unlockBtn')}
          </button>
        </div>

        <div className="pt-2 border-t border-stone-200 dark:border-stone-800 text-center">
          {!confirmReset ? (
            <button
              type="button"
              onClick={() => setConfirmReset(true)}
              className="text-[11px] text-stone-500 hover:text-stone-800 dark:hover:text-stone-200 underline cursor-pointer"
            >
              {t('pinLock.forgotResetPrompt')}
            </button>
          ) : (
            <div className="space-y-2 pt-1">
              <p className="text-[11px] text-rose-800 dark:text-rose-300">
                {t('deleteAll.confirmPrompt')}
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={onResetAllData}
                  className="btn-primary !bg-rose-800 hover:!bg-rose-900 text-xs py-2 flex-1 cursor-pointer"
                >
                  {t('deleteAll.confirmYes')}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmReset(false)}
                  className="btn-secondary !w-auto text-xs py-2 px-3 cursor-pointer"
                >
                  {t('common.cancel')}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
