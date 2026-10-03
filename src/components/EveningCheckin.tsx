import { useId, useState } from 'react';
import { addEvent } from '../db/index.ts';
import { t } from '../i18n/index.ts';
import { extractCheckin } from '../lib/checkin.ts';
import type { EventRecord } from '../schemas/events.ts';
import type { Profile } from '../schemas/profile.ts';
import { checkDistress } from '../security/safety.ts';

interface EveningCheckinProps {
  profile: Profile;
  onSaved: (savedEvent: EventRecord) => void;
  onCancel?: () => void;
}

export function EveningCheckin({ profile, onSaved, onCancel }: EveningCheckinProps) {
  const triggerInputId = useId();
  const emotionInputId = useId();
  const notesInputId = useId();
  const [userText, setUserText] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [distressDetected, setDistressDetected] = useState(false);

  // Correction & review state
  const [hasExtracted, setHasExtracted] = useState(false);
  const [editableTrigger, setEditableTrigger] = useState('');
  const [editableEmotion, setEditableEmotion] = useState('');
  const [editableOutcome, setEditableOutcome] = useState<'resisted' | 'smoked' | 'unknown'>(
    'resisted',
  );
  const [editableNotes, setEditableNotes] = useState('');
  const [isSaved, setIsSaved] = useState(false);

  const handleTextChange = (val: string) => {
    setUserText(val);
    // Distress check by code first (Section 4 & Section 8 invariant)
    const distress = checkDistress(val, profile.language);
    setDistressDetected(distress.isDistress);
  };

  const handleAnalyze = async () => {
    // Re-verify distress before any network / model call
    const distress = checkDistress(userText, profile.language);
    if (distress.isDistress) {
      setDistressDetected(true);
      return;
    }

    if (!userText.trim()) return;

    setIsAnalyzing(true);
    try {
      const extracted = await extractCheckin(userText);
      setEditableTrigger(extracted.trigger || 'Journée générale');
      setEditableEmotion(extracted.emotion || 'Calme');
      setEditableOutcome(extracted.outcome || 'resisted');
      setEditableNotes(userText.trim());
      setHasExtracted(true);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSaveToJournal = async () => {
    const record: EventRecord = {
      id: `evt-checkin-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      ts: Date.now(),
      type: 'checkin',
      trigger: editableTrigger.trim() || undefined,
      emotion: editableEmotion.trim() || undefined,
      note: editableNotes.trim() || undefined,
      debrief: {
        outcome: editableOutcome,
        rawInput: userText.trim(),
      },
    };

    await addEvent(record);
    setIsSaved(true);
    onSaved(record);
  };

  const handleResetForNew = () => {
    setUserText('');
    setHasExtracted(false);
    setIsSaved(false);
    setDistressDetected(false);
  };

  // 1. Distress Alert Screen if distress words detected (Section 4 & 8)
  if (distressDetected) {
    return (
      <div className="card space-y-4 p-5 bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-800 text-stone-900 dark:text-stone-100 animate-fade-in">
        <div className="flex items-center gap-2.5 text-amber-900 dark:text-amber-300 font-bold">
          <span className="text-2xl">🤝</span>
          <span>{t('checkin.distressTitle')}</span>
        </div>
        <p className="text-xs text-amber-950 dark:text-amber-200 leading-relaxed">
          {t('checkin.distressMsg')}
        </p>

        {/* Fixed Helpline & Support Person Cards */}
        <div className="space-y-2 pt-1">
          <div className="p-3 bg-white dark:bg-stone-900 rounded-xl border border-amber-200 dark:border-amber-800 flex items-center justify-between text-xs">
            <div>
              <span className="font-bold text-stone-800 dark:text-stone-200 block">
                {profile.helpline.label}
              </span>
              <span className="text-emerald-800 dark:text-emerald-400 font-extrabold text-sm">
                {profile.helpline.contact}
              </span>
            </div>
            <a
              href={`tel:${profile.helpline.contact.replace(/\s+/g, '')}`}
              className="btn-primary text-xs py-1.5 px-3 !w-auto"
            >
              Appeler
            </a>
          </div>

          {profile.supportPerson && (
            <div className="p-3 bg-white dark:bg-stone-900 rounded-xl border border-amber-200 dark:border-amber-800 flex items-center justify-between text-xs">
              <div>
                <span className="font-bold text-stone-800 dark:text-stone-200 block">
                  {profile.supportPerson.label}
                </span>
                <span className="text-emerald-800 dark:text-emerald-400 font-extrabold text-sm">
                  {profile.supportPerson.contact}
                </span>
              </div>
              <a
                href={`tel:${profile.supportPerson.contact.replace(/\s+/g, '')}`}
                className="btn-secondary text-xs py-1.5 px-3 !w-auto"
              >
                Contacter
              </a>
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={() => setDistressDetected(false)}
          className="btn-secondary text-xs py-2 w-full mt-2 cursor-pointer"
        >
          Retour à la saisie
        </button>
      </div>
    );
  }

  // 2. Saved Success View
  if (isSaved) {
    return (
      <div className="card space-y-4 p-5 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-center animate-fade-in text-xs">
        <div className="text-3xl">🌱</div>
        <div className="space-y-1">
          <h4 className="font-bold text-emerald-950 dark:text-emerald-200 text-sm">
            {t('checkin.savedSuccess')}
          </h4>
          <p className="text-emerald-800 dark:text-emerald-300/90 leading-relaxed">
            Ta journée est consignée avec bienveillance dans ton journal. Chaque pas compte.
          </p>
        </div>
        <button
          type="button"
          onClick={handleResetForNew}
          className="btn-primary text-xs py-2.5 px-4 cursor-pointer min-h-[40px]"
        >
          {t('checkin.editAgain')}
        </button>
      </div>
    );
  }

  // 3. Review & Edit Screen after AI extraction (Step 15: show result and let her correct it)
  if (hasExtracted) {
    return (
      <div className="card space-y-4 p-5 bg-white dark:bg-stone-900 border-stone-200 dark:border-stone-800 animate-fade-in text-xs">
        <div className="space-y-1 pb-2 border-b border-stone-200 dark:border-stone-800">
          <h4 className="font-bold text-stone-900 dark:text-stone-50 flex items-center gap-1.5 text-sm">
            <span>✏️</span>
            <span>{t('checkin.reviewTitle')}</span>
          </h4>
          <p className="text-[11px] text-stone-500 dark:text-stone-400">
            Ajuste ce que tu souhaites avant d'enregistrer dans ton journal.
          </p>
        </div>

        {/* Outcome Selector */}
        <div className="space-y-1.5">
          <span className="font-semibold text-stone-700 dark:text-stone-300 block">
            {t('checkin.outcomeLabel')}
          </span>
          <div className="grid grid-cols-3 gap-1.5">
            <button
              type="button"
              onClick={() => setEditableOutcome('resisted')}
              className={`p-2 rounded-xl text-center font-bold transition-all cursor-pointer border min-h-[38px] ${
                editableOutcome === 'resisted'
                  ? 'bg-emerald-800 text-white border-emerald-800 shadow-xs'
                  : 'bg-stone-50 dark:bg-stone-800 text-stone-700 dark:text-stone-300 border-stone-200 dark:border-stone-700'
              }`}
            >
              {t('checkin.outcomeResisted')}
            </button>
            <button
              type="button"
              onClick={() => setEditableOutcome('smoked')}
              className={`p-2 rounded-xl text-center font-bold transition-all cursor-pointer border min-h-[38px] ${
                editableOutcome === 'smoked'
                  ? 'bg-stone-800 text-white border-stone-800 shadow-xs'
                  : 'bg-stone-50 dark:bg-stone-800 text-stone-700 dark:text-stone-300 border-stone-200 dark:border-stone-700'
              }`}
            >
              {t('checkin.outcomeSmoked')}
            </button>
            <button
              type="button"
              onClick={() => setEditableOutcome('unknown')}
              className={`p-2 rounded-xl text-center font-bold transition-all cursor-pointer border min-h-[38px] ${
                editableOutcome === 'unknown'
                  ? 'bg-amber-700 text-white border-amber-700 shadow-xs'
                  : 'bg-stone-50 dark:bg-stone-800 text-stone-700 dark:text-stone-300 border-stone-200 dark:border-stone-700'
              }`}
            >
              {t('checkin.outcomeUnknown')}
            </button>
          </div>
        </div>

        {/* Trigger input */}
        <div className="space-y-1">
          <label
            htmlFor={triggerInputId}
            className="font-semibold text-stone-700 dark:text-stone-300 block"
          >
            {t('checkin.triggerLabel')}
          </label>
          <input
            id={triggerInputId}
            type="text"
            value={editableTrigger}
            onChange={(e) => setEditableTrigger(e.target.value)}
            className="w-full px-3 py-2 text-xs rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-900 dark:text-stone-100"
          />
        </div>

        {/* Emotion input */}
        <div className="space-y-1">
          <label
            htmlFor={emotionInputId}
            className="font-semibold text-stone-700 dark:text-stone-300 block"
          >
            {t('checkin.emotionLabel')}
          </label>
          <input
            id={emotionInputId}
            type="text"
            value={editableEmotion}
            onChange={(e) => setEditableEmotion(e.target.value)}
            className="w-full px-3 py-2 text-xs rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-900 dark:text-stone-100"
          />
        </div>

        {/* Notes input */}
        <div className="space-y-1">
          <label
            htmlFor={notesInputId}
            className="font-semibold text-stone-700 dark:text-stone-300 block"
          >
            {t('checkin.notesLabel')}
          </label>
          <textarea
            id={notesInputId}
            rows={3}
            value={editableNotes}
            onChange={(e) => setEditableNotes(e.target.value)}
            className="w-full px-3 py-2 text-xs rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-900 dark:text-stone-100"
          />
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2 pt-1">
          <button
            type="button"
            onClick={handleSaveToJournal}
            className="btn-primary text-xs py-3 flex-1 cursor-pointer flex justify-center items-center gap-1.5 min-h-[44px]"
          >
            <span>✓</span>
            <span>{t('checkin.saveBtn')}</span>
          </button>
          <button
            type="button"
            onClick={() => setHasExtracted(false)}
            className="btn-secondary text-xs py-3 px-4 cursor-pointer min-h-[44px]"
          >
            {t('common.back')}
          </button>
        </div>
      </div>
    );
  }

  // 4. Initial Check-in Input Screen (2-minute free text)
  return (
    <div className="card space-y-4 p-5 bg-white dark:bg-stone-900 border-stone-200 dark:border-stone-800 text-xs">
      <div className="space-y-1">
        <h3 className="text-sm font-bold text-stone-900 dark:text-stone-50 flex items-center gap-1.5">
          <span>🌙</span>
          <span>{t('checkin.title')}</span>
        </h3>
        <p className="text-[11px] text-stone-500 dark:text-stone-400 font-medium leading-relaxed">
          {t('checkin.subtitle')}
        </p>
      </div>

      <div className="space-y-1.5">
        <textarea
          rows={4}
          maxLength={1500}
          value={userText}
          onChange={(e) => handleTextChange(e.target.value)}
          placeholder={t('checkin.promptPlaceholder')}
          className="w-full p-3 text-xs rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-900 dark:text-stone-100 focus:bg-white dark:focus:bg-stone-900 leading-relaxed"
        />
        <div className="flex justify-between text-[10px] text-stone-400">
          <span>Temps conseillé : 2 minutes</span>
          <span>{userText.length} / 1500</span>
        </div>
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleAnalyze}
          disabled={isAnalyzing || !userText.trim()}
          className="btn-primary text-xs py-3 flex-1 cursor-pointer flex items-center justify-center gap-2 min-h-[44px] disabled:opacity-50"
        >
          <span>{isAnalyzing ? '⏳' : '🤖'}</span>
          <span>{isAnalyzing ? t('checkin.analyzing') : t('checkin.extractBtn')}</span>
        </button>

        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="btn-secondary text-xs py-3 px-4 cursor-pointer min-h-[44px]"
          >
            {t('common.cancel')}
          </button>
        )}
      </div>
    </div>
  );
}
