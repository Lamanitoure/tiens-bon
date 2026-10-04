import { useState } from 'react';
import { setStoredProfile } from '../db/index.ts';
import { t } from '../i18n/index.ts';
import { type Profile, ProfileSchema } from '../schemas/profile.ts';
import { CheckIcon } from './icons/CheckIcon.tsx';
import { PenIcon } from './icons/PenIcon.tsx';
import { TrashIcon } from './icons/TrashIcon.tsx';
import { XIcon } from './icons/XIcon.tsx';
import { PWAInstallButton } from './PWAInstallButton.tsx';

interface ProfileEditorProps {
  profile: Profile;
  onProfileUpdated: (updated: Profile) => void;
  onDeleteAll: () => Promise<void>;
}

export function ProfileEditor({ profile, onProfileUpdated, onDeleteAll }: ProfileEditorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [tone, setTone] = useState(profile.tone);
  const [unitsPerDay, setUnitsPerDay] = useState(profile.unitsPerDay.toString());
  const [unitPrice, setUnitPrice] = useState(profile.unitPrice.toString());
  const [currency, setCurrency] = useState(profile.currency);
  const [goalLabel, setGoalLabel] = useState(profile.savingsGoal.label);
  const [goalAmount, setGoalAmount] = useState(profile.savingsGoal.amount.toString());
  const [helplineLabel, setHelplineLabel] = useState(profile.helpline.label);
  const [helplineContact, setHelplineContact] = useState(profile.helpline.contact);
  const [supportLabel, setSupportLabel] = useState(profile.supportPerson?.label ?? '');
  const [supportContact, setSupportContact] = useState(profile.supportPerson?.contact ?? '');
  const [reasonsText, setReasonsText] = useState(profile.reasons.join('\n'));
  const [alternativesText, setAlternativesText] = useState(profile.alternatives.join('\n'));
  const [phrasesText, setPhrasesText] = useState(profile.phrases.join('\n'));

  const [savedNotice, setSavedNotice] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteSuccessMsg, setDeleteSuccessMsg] = useState<string | null>(null);

  const handleSave = async () => {
    setValidationError(null);
    setSavedNotice(null);

    const reasons = reasonsText
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);
    const alternatives = alternativesText
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);
    const phrases = phrasesText
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);

    const candidate: Profile = {
      ...profile,
      tone: tone.trim(),
      unitsPerDay: Number(unitsPerDay),
      unitPrice: Number(unitPrice),
      currency: currency.trim() || '€',
      savingsGoal: {
        label: goalLabel.trim(),
        amount: Number(goalAmount),
      },
      helpline: {
        label: helplineLabel.trim(),
        contact: helplineContact.trim(),
      },
      supportPerson:
        supportLabel.trim() && supportContact.trim()
          ? {
              label: supportLabel.trim(),
              contact: supportContact.trim(),
            }
          : undefined,
      reasons,
      alternatives,
      phrases,
    };

    const parsed = ProfileSchema.safeParse(candidate);
    if (!parsed.success) {
      setValidationError(parsed.error.issues.map((i) => i.message).join(', '));
      return;
    }

    await setStoredProfile(parsed.data);
    onProfileUpdated(parsed.data);
    setSavedNotice(t('profileEditor.savedSuccess'));
    setIsOpen(false);
  };

  const handleConfirmDeleteAll = async () => {
    await onDeleteAll();
    setConfirmDelete(false);
    setDeleteSuccessMsg(t('deleteAll.deletedSuccess'));
  };

  return (
    <div className="space-y-4">
      {/* PWA Install shortcut card */}
      <PWAInstallButton forceShow={true} />

      {/* Customize Profile Card */}
      <section className="card space-y-3 border-stone-200 dark:border-stone-700">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-bold text-stone-900 dark:text-stone-50">
            {t('profileEditor.wizardTitle')}
          </h4>
          <button
            type="button"
            onClick={() => setIsOpen((prev) => !prev)}
            className="btn-secondary !w-auto text-xs py-1.5 px-3 cursor-pointer flex items-center gap-1.5"
          >
            {isOpen ? (
              <span>{t('common.cancel')}</span>
            ) : (
              <>
                <PenIcon className="w-3.5 h-3.5 shrink-0" />
                <span>{t('profileEditor.editBtn')}</span>
              </>
            )}
          </button>
        </div>

        {savedNotice && (
          <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-900 dark:text-emerald-200 text-xs border border-emerald-200 dark:border-emerald-800 flex items-center gap-1.5">
            <CheckIcon className="w-3.5 h-3.5 shrink-0" />
            <span>{savedNotice}</span>
          </div>
        )}

        {isOpen && (
          <div className="space-y-3 pt-2 border-t border-stone-200 dark:border-stone-800 text-xs">
            <label className="block space-y-1">
              <span className="font-semibold">{t('profileEditor.toneLabel')}</span>
              <input
                type="text"
                value={tone}
                onChange={(e) => setTone(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800"
              />
            </label>

            <div className="grid grid-cols-3 gap-2">
              <label className="block space-y-1">
                <span className="font-semibold">{t('profileEditor.unitsPerDayLabel')}</span>
                <input
                  type="number"
                  value={unitsPerDay}
                  onChange={(e) => setUnitsPerDay(e.target.value)}
                  className="w-full px-2.5 py-2 rounded-lg border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800"
                />
              </label>
              <label className="block space-y-1">
                <span className="font-semibold">{t('profileEditor.unitPriceLabel')}</span>
                <input
                  type="number"
                  step="0.05"
                  value={unitPrice}
                  onChange={(e) => setUnitPrice(e.target.value)}
                  className="w-full px-2.5 py-2 rounded-lg border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800"
                />
              </label>
              <label className="block space-y-1">
                <span className="font-semibold">{t('profileEditor.currencyLabel')}</span>
                <input
                  type="text"
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="w-full px-2.5 py-2 rounded-lg border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800"
                />
              </label>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <label className="block space-y-1">
                <span className="font-semibold">{t('profileEditor.goalLabel')}</span>
                <input
                  type="text"
                  value={goalLabel}
                  onChange={(e) => setGoalLabel(e.target.value)}
                  className="w-full px-2.5 py-2 rounded-lg border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800"
                />
              </label>
              <label className="block space-y-1">
                <span className="font-semibold">{t('profileEditor.goalAmountLabel')}</span>
                <input
                  type="number"
                  value={goalAmount}
                  onChange={(e) => setGoalAmount(e.target.value)}
                  className="w-full px-2.5 py-2 rounded-lg border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800"
                />
              </label>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <label className="block space-y-1">
                <span className="font-semibold">{t('profileEditor.helplineLabel')}</span>
                <input
                  type="text"
                  value={helplineLabel}
                  onChange={(e) => setHelplineLabel(e.target.value)}
                  className="w-full px-2.5 py-2 rounded-lg border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800"
                />
              </label>
              <label className="block space-y-1">
                <span className="font-semibold">{t('profileEditor.helplineContact')}</span>
                <input
                  type="text"
                  value={helplineContact}
                  onChange={(e) => setHelplineContact(e.target.value)}
                  className="w-full px-2.5 py-2 rounded-lg border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800"
                />
              </label>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <label className="block space-y-1">
                <span className="font-semibold">{t('profileEditor.supportLabel')}</span>
                <input
                  type="text"
                  value={supportLabel}
                  onChange={(e) => setSupportLabel(e.target.value)}
                  className="w-full px-2.5 py-2 rounded-lg border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800"
                />
              </label>
              <label className="block space-y-1">
                <span className="font-semibold">{t('profileEditor.supportContact')}</span>
                <input
                  type="text"
                  value={supportContact}
                  onChange={(e) => setSupportContact(e.target.value)}
                  className="w-full px-2.5 py-2 rounded-lg border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800"
                />
              </label>
            </div>

            <label className="block space-y-1">
              <span className="font-semibold">{t('profileEditor.reasonsLabel')}</span>
              <textarea
                rows={3}
                value={reasonsText}
                onChange={(e) => setReasonsText(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800"
              />
            </label>

            <label className="block space-y-1">
              <span className="font-semibold">{t('profileEditor.alternativesLabel')}</span>
              <textarea
                rows={3}
                value={alternativesText}
                onChange={(e) => setAlternativesText(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800"
              />
            </label>

            <label className="block space-y-1">
              <span className="font-semibold">{t('profileEditor.phrasesLabel')}</span>
              <textarea
                rows={4}
                value={phrasesText}
                onChange={(e) => setPhrasesText(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800"
              />
            </label>

            {validationError && (
              <div className="p-2 rounded-lg bg-rose-50 dark:bg-rose-950/60 text-rose-800 dark:text-rose-200 text-xs border border-rose-200 dark:border-rose-800 flex items-center gap-1.5">
                <XIcon className="w-3.5 h-3.5 shrink-0" />
                <span>{validationError}</span>
              </div>
            )}

            <button
              type="button"
              onClick={handleSave}
              className="btn-primary w-full py-2.5 text-xs font-bold cursor-pointer min-h-[44px]"
            >
              {t('common.save')}
            </button>
          </div>
        )}
      </section>

      {/* Delete Everything Section (Section 5 Item 20) */}
      <section className="card space-y-3 border-stone-200 dark:border-stone-700">
        <div className="space-y-1">
          <h4 className="text-xs font-bold text-stone-900 dark:text-stone-50">
            {t('deleteAll.title')}
          </h4>
          <p className="text-[11px] text-stone-500 dark:text-stone-400 leading-relaxed">
            {t('deleteAll.desc')}
          </p>
        </div>

        {deleteSuccessMsg && (
          <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-900 dark:text-emerald-200 text-xs border border-emerald-200 dark:border-emerald-800 flex items-center gap-1.5">
            <CheckIcon className="w-3.5 h-3.5 shrink-0" />
            <span>{deleteSuccessMsg}</span>
          </div>
        )}

        {!confirmDelete ? (
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            className="btn-secondary text-xs py-2.5 w-full text-rose-800 dark:text-rose-300 border-rose-200 dark:border-rose-900 cursor-pointer min-h-[42px] flex items-center justify-center gap-1.5"
          >
            <TrashIcon className="w-4 h-4 shrink-0" />
            <span>{t('deleteAll.deleteBtn')}</span>
          </button>
        ) : (
          <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 space-y-2.5">
            <p className="text-xs text-rose-900 dark:text-rose-200 font-medium">
              {t('deleteAll.confirmPrompt')}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleConfirmDeleteAll}
                className="btn-primary !bg-rose-800 hover:!bg-rose-900 text-xs py-2 flex-1 cursor-pointer min-h-[40px]"
              >
                {t('deleteAll.confirmYes')}
              </button>
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                className="btn-secondary !w-auto text-xs py-2 px-3 cursor-pointer min-h-[40px]"
              >
                {t('common.cancel')}
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
