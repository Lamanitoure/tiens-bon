import { useCallback, useEffect, useState } from 'react';
import { addSelfTalk, deleteSelfTalk, getAllSelfTalk } from '../db/index.ts';
import { t } from '../i18n/index.ts';
import type { SelfTalk } from '../schemas/selftalk.ts';

interface FutureSelfMessagesProps {
  onMessagesUpdated?: (messages: SelfTalk[]) => void;
}

export function FutureSelfMessages({ onMessagesUpdated }: FutureSelfMessagesProps) {
  const [messages, setMessages] = useState<SelfTalk[]>([]);
  const [newText, setNewText] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const refreshMessages = useCallback(async () => {
    try {
      const all = await getAllSelfTalk();
      setMessages(all);
      onMessagesUpdated?.(all);
    } catch {
      // ignore
    } finally {
      setIsLoading(false);
    }
  }, [onMessagesUpdated]);

  useEffect(() => {
    refreshMessages();
  }, [refreshMessages]);

  const handleSave = async () => {
    if (!newText.trim()) return;

    try {
      const item: SelfTalk = {
        id: `st-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        text: newText.trim(),
      };
      await addSelfTalk(item);
      setNewText('');
      setIsAdding(false);
      await refreshMessages();
    } catch {
      // ignore
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm(t('selftalk.deleteConfirm'))) return;
    try {
      await deleteSelfTalk(id);
      await refreshMessages();
    } catch {
      // ignore
    }
  };

  return (
    <div className="card space-y-4 p-5 bg-white dark:bg-stone-900 border-stone-200 dark:border-stone-800">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-stone-900 dark:text-stone-50 flex items-center gap-1.5">
            <span>💌</span>
            <span>{t('selftalk.title')}</span>
          </h3>
          <p className="text-[11px] text-stone-500 dark:text-stone-400 font-medium">
            {t('selftalk.subtitle')}
          </p>
        </div>

        <span className="text-[11px] font-mono font-semibold px-2.5 py-1 rounded-full bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 shrink-0">
          {messages.length}
        </span>
      </div>

      {!isAdding ? (
        <button
          type="button"
          onClick={() => setIsAdding(true)}
          className="btn-secondary text-xs py-2.5 w-full cursor-pointer flex items-center justify-center gap-2 min-h-[42px]"
        >
          <span>✍️</span>
          <span>{t('selftalk.addMessage')}</span>
        </button>
      ) : (
        <div className="p-3.5 bg-stone-50 dark:bg-stone-800/60 rounded-2xl border border-stone-200 dark:border-stone-700 space-y-3 animate-fade-in text-xs">
          <label
            htmlFor="self-talk-input"
            className="font-semibold text-stone-800 dark:text-stone-200 block"
          >
            {t('selftalk.addMessage')}
          </label>
          <textarea
            id="self-talk-input"
            rows={3}
            maxLength={500}
            value={newText}
            onChange={(e) => setNewText(e.target.value)}
            placeholder={t('selftalk.placeholder')}
            className="w-full px-3 py-2 text-xs rounded-xl border border-stone-300 dark:border-stone-600 bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleSave}
              disabled={!newText.trim()}
              className="btn-primary text-xs py-2 px-4 cursor-pointer disabled:opacity-50 min-h-[38px]"
            >
              {t('common.save')}
            </button>
            <button
              type="button"
              onClick={() => {
                setIsAdding(false);
                setNewText('');
              }}
              className="btn-secondary text-xs py-2 px-3 cursor-pointer min-h-[38px]"
            >
              {t('common.cancel')}
            </button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="text-center py-4 text-xs text-stone-400">{t('common.loading')}</div>
      ) : messages.length === 0 ? (
        <div className="text-center py-5 border border-dashed border-stone-200 dark:border-stone-800 rounded-2xl text-xs text-stone-400">
          {t('selftalk.empty')}
        </div>
      ) : (
        <div className="space-y-2 pt-1">
          {messages.map((item) => (
            <div
              key={item.id}
              className="p-3 rounded-xl bg-stone-50 dark:bg-stone-800/40 border border-stone-200 dark:border-stone-700 flex items-start justify-between gap-3 text-xs"
            >
              <p className="italic text-stone-800 dark:text-stone-200 leading-relaxed">
                « {item.text} »
              </p>
              <button
                type="button"
                onClick={() => handleDelete(item.id)}
                className="text-[11px] text-stone-400 hover:text-red-600 dark:hover:text-red-400 cursor-pointer shrink-0 p-1"
                aria-label={t('common.delete')}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
