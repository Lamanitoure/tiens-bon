import { useState } from 'react';
import { t } from '../i18n/index.ts';
import { getStoredToken } from '../lib/api.ts';
import { getWearableWebhookUrl, triggerWearableCraving } from '../lib/wearable.ts';

interface WearableManagerProps {
  onTriggered: () => void;
}

export function WearableManager({ onTriggered }: WearableManagerProps) {
  const token = getStoredToken();
  const webhookUrl = getWearableWebhookUrl(token);

  const [copied, setCopied] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(webhookUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch {
      // Fallback
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    }
  };

  const handleTestTrigger = async () => {
    setIsTesting(true);
    setTestResult(null);

    try {
      const res = await triggerWearableCraving(token, 'watch_test');
      if (res.status === 'ready') {
        setTestResult(t('wearable.testSuccess'));
        setTimeout(() => {
          onTriggered();
        }, 500);
      } else {
        setTestResult(`❌ ${res.error || 'Erreur de déclenchement'}`);
      }
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div className="card space-y-4 p-5 bg-white dark:bg-stone-900 border-stone-200 dark:border-stone-800 text-xs">
      <div className="space-y-1">
        <h3 className="text-sm font-bold text-stone-900 dark:text-stone-50 flex items-center gap-2">
          <span>⌚</span>
          <span>{t('wearable.title')}</span>
        </h3>
        <p className="text-[11px] text-stone-500 dark:text-stone-400 font-medium leading-relaxed">
          {t('wearable.subtitle')}
        </p>
      </div>

      {/* Webhook URL Field */}
      <div className="space-y-1.5">
        <span className="font-semibold text-stone-700 dark:text-stone-300 block">
          {t('wearable.endpointUrlLabel')}
        </span>
        <div className="flex gap-2">
          <input
            type="text"
            readOnly
            value={webhookUrl}
            className="flex-1 px-3 py-2 text-xs rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-100 dark:bg-stone-800 text-stone-800 dark:text-stone-200 font-mono select-all"
          />
          <button
            type="button"
            onClick={handleCopy}
            className="btn-secondary text-xs px-3.5 py-2 cursor-pointer shrink-0 min-h-[38px]"
          >
            {copied ? `✓ ${t('wearable.copied')}` : t('wearable.copyUrl')}
          </button>
        </div>
      </div>

      {/* Test Button */}
      <div>
        <button
          type="button"
          onClick={handleTestTrigger}
          disabled={isTesting}
          className="btn-primary text-xs py-2.5 px-4 w-full cursor-pointer flex items-center justify-center gap-2 min-h-[42px] disabled:opacity-50"
        >
          <span>{isTesting ? '⏳' : '⌚'}</span>
          <span>{isTesting ? t('wearable.testing') : t('wearable.testBtn')}</span>
        </button>
      </div>

      {testResult && (
        <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-300 dark:border-emerald-800 text-emerald-950 dark:text-emerald-200 font-semibold text-center animate-fade-in text-xs">
          {testResult}
        </div>
      )}

      {/* Setup instructions */}
      <div className="space-y-2 pt-2 border-t border-stone-200 dark:border-stone-800 text-stone-600 dark:text-stone-400">
        <h4 className="font-bold text-stone-800 dark:text-stone-200 text-xs">
          {t('wearable.instructionsTitle')}
        </h4>
        <ul className="space-y-1.5 list-disc pl-4 text-[11px] leading-relaxed">
          <li>{t('wearable.instruction1')}</li>
          <li>{t('wearable.instruction2')}</li>
          <li>{t('wearable.instruction3')}</li>
        </ul>
      </div>
    </div>
  );
}
