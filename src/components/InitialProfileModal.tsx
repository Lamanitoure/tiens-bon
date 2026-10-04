import { type FormEvent, useState } from 'react';
import { t } from '../i18n/index.ts';
import { FlagFrIcon, FlagGbIcon, HeartHandshakeIcon, ShieldIcon } from './icons/index.ts';

interface InitialProfileModalProps {
  onProfileCreated: (userName: string) => Promise<void>;
  currentLang: string;
  onToggleLang: () => void;
}

export function InitialProfileModal({
  onProfileCreated,
  currentLang,
  onToggleLang,
}: InitialProfileModalProps) {
  const [nameInput, setNameInput] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const trimmed = nameInput.trim();
    if (!trimmed) {
      setErrorMsg(t('welcome.nameRequired'));
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMsg(null);
      await onProfileCreated(trimmed);
    } catch (_err) {
      setErrorMsg(t('common.error'));
      setIsSubmitting(false);
    }
  };

  return (
    <main className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-sm animate-fade-in">
      <div className="card max-w-sm w-full p-6 space-y-5 bg-white dark:bg-stone-900 border-stone-200 dark:border-stone-800 shadow-xl rounded-2xl relative">
        {/* Language switch button at top right */}
        <div className="flex justify-end">
          <button
            type="button"
            onClick={onToggleLang}
            className="px-2.5 py-1.5 rounded-full text-xs font-semibold border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-800 dark:text-stone-100 flex items-center gap-1.5 cursor-pointer hover:bg-stone-100 dark:hover:bg-stone-700"
            aria-label="Switch language"
          >
            {currentLang === 'fr' ? (
              <>
                <FlagGbIcon className="w-3.5 h-2.5 shrink-0" />
                <span>EN</span>
              </>
            ) : (
              <>
                <FlagFrIcon className="w-3.5 h-2.5 shrink-0" />
                <span>FR</span>
              </>
            )}
          </button>
        </div>

        {/* Emblem & Welcome Header */}
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-2xl bg-emerald-800 text-white flex items-center justify-center font-bold text-lg mx-auto shadow-sm">
            <HeartHandshakeIcon className="w-6 h-6" />
          </div>
          <h1 className="text-xl font-bold text-stone-900 dark:text-stone-50">
            {t('welcome.title')}
          </h1>
          <p className="text-xs text-stone-600 dark:text-stone-400 leading-relaxed">
            {t('welcome.subtitle')}
          </p>
        </div>

        {/* Name input form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label
              htmlFor="user-name-input"
              className="block text-xs font-semibold text-stone-700 dark:text-stone-300"
            >
              {t('welcome.namePrompt')}
            </label>
            <input
              id="user-name-input"
              type="text"
              maxLength={50}
              value={nameInput}
              onChange={(e) => {
                setNameInput(e.target.value);
                if (errorMsg) setErrorMsg(null);
              }}
              placeholder={t('welcome.namePlaceholder')}
              className="w-full px-3.5 py-3 text-sm rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-900 dark:text-stone-100 focus:bg-white dark:focus:bg-stone-900 focus:outline-none focus:ring-2 focus:ring-emerald-700"
            />
            {errorMsg && (
              <p className="text-xs text-rose-600 dark:text-rose-400 font-medium">{errorMsg}</p>
            )}
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="btn-primary w-full py-3.5 text-xs font-bold cursor-pointer min-h-[48px] rounded-xl flex items-center justify-center"
          >
            {isSubmitting ? t('common.loading') : t('welcome.startBtn')}
          </button>
        </form>

        {/* Privacy Note */}
        <div className="pt-2 border-t border-stone-200 dark:border-stone-800 flex items-center gap-2 text-[11px] text-stone-500 dark:text-stone-400">
          <ShieldIcon className="w-4 h-4 text-emerald-700 dark:text-emerald-400 shrink-0" />
          <span>{t('welcome.privacyNote')}</span>
        </div>
      </div>
    </main>
  );
}
