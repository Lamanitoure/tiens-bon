import { type ChangeEvent, useState } from 'react';
import { addImage } from '../db/index.ts';
import { t } from '../i18n/index.ts';
import { sanitizeAndEncodeImage } from '../lib/images.ts';
import type { ImageKind, ImageRecord } from '../schemas/images.ts';

interface ImageUploaderProps {
  onImageAdded: (newImage: ImageRecord) => void;
  onCancel: () => void;
}

export function ImageUploader({ onImageAdded, onCancel }: ImageUploaderProps) {
  const [caption, setCaption] = useState('');
  const [kind, setKind] = useState<ImageKind>('motivating');
  const [isLovedOne, setIsLovedOne] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    setErrorMsg(null);
    const selected = e.target.files?.[0];
    if (!selected) return;

    setIsProcessing(true);

    try {
      // Re-encode through canvas immediately to preview and strip EXIF
      const processed = await sanitizeAndEncodeImage(selected);
      setPreviewUrl(processed.dataUrl);
    } catch (err) {
      setPreviewUrl(null);
      setErrorMsg(err instanceof Error ? err.message : t('common.error'));
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSave = async () => {
    if (!previewUrl) {
      setErrorMsg(t('gallery.uploadPrompt'));
      return;
    }
    if (!caption.trim()) {
      setErrorMsg(t('gallery.captionLabel'));
      return;
    }

    setIsProcessing(true);
    setErrorMsg(null);

    try {
      const record: ImageRecord = {
        id: `img-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        kind,
        caption: caption.trim(),
        dataUrl: previewUrl,
        createdTs: Date.now(),
        isLovedOne: isLovedOne || undefined,
      };

      await addImage(record);
      onImageAdded(record);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : t('common.error'));
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="p-4 bg-stone-50 dark:bg-stone-800/80 rounded-2xl border border-stone-200 dark:border-stone-700 space-y-4 animate-fade-in text-xs">
      <div className="flex items-center justify-between pb-2 border-b border-stone-200 dark:border-stone-700">
        <h4 className="font-bold text-stone-900 dark:text-stone-100 flex items-center gap-1.5">
          <span>📷</span>
          <span>{t('gallery.addPhoto')}</span>
        </h4>
        <button
          type="button"
          onClick={onCancel}
          className="text-stone-500 hover:text-stone-800 dark:hover:text-stone-200 cursor-pointer font-bold px-2 py-1"
        >
          ✕
        </button>
      </div>

      {errorMsg && (
        <div className="p-2.5 rounded-lg bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800 font-medium">
          {errorMsg}
        </div>
      )}

      {/* File input */}
      <div className="space-y-1">
        <label
          htmlFor="image-file-input"
          className="font-semibold text-stone-700 dark:text-stone-300 block"
        >
          1. {t('gallery.uploadPrompt')}
        </label>
        <input
          id="image-file-input"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={handleFileChange}
          disabled={isProcessing}
          className="w-full text-xs text-stone-600 dark:text-stone-400 file:mr-3 file:py-2 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-emerald-800 file:text-white hover:file:bg-emerald-900 cursor-pointer"
        />
        <p className="text-[10px] text-stone-500 dark:text-stone-400 italic">
          {t('gallery.reEncodedNotice')}
        </p>
      </div>

      {/* Preview if processed */}
      {previewUrl && (
        <div className="relative rounded-xl overflow-hidden border border-stone-200 dark:border-stone-700 max-h-48 flex items-center justify-center bg-stone-950">
          <img
            src={previewUrl}
            alt="Aperçu sélectionné"
            className="w-full h-48 object-cover rounded-xl"
          />
        </div>
      )}

      {/* Caption input */}
      <div className="space-y-1">
        <label
          htmlFor="image-caption-input"
          className="font-semibold text-stone-700 dark:text-stone-300 block"
        >
          2. {t('gallery.captionLabel')}
        </label>
        <input
          id="image-caption-input"
          type="text"
          value={caption}
          maxLength={200}
          onChange={(e) => setCaption(e.target.value)}
          placeholder={t('gallery.captionPlaceholder')}
          className="w-full px-3 py-2 text-xs rounded-xl border border-stone-300 dark:border-stone-600 bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100"
        />
      </div>

      {/* Kind selector */}
      <div className="space-y-1.5">
        <span className="font-semibold text-stone-700 dark:text-stone-300 block">
          3. {t('gallery.kindLabel')}
        </span>
        <div className="grid grid-cols-2 gap-1.5">
          {(['motivating', 'calm', 'goal', 'deterrent'] as ImageKind[]).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setKind(k)}
              className={`p-2 rounded-xl text-left font-medium transition-all cursor-pointer border ${
                kind === k
                  ? 'bg-emerald-800 text-white border-emerald-800 font-bold shadow-xs'
                  : 'bg-white dark:bg-stone-900 text-stone-700 dark:text-stone-300 border-stone-200 dark:border-stone-700 hover:bg-stone-100 dark:hover:bg-stone-800'
              }`}
            >
              {t(`gallery.kinds.${k}`)}
            </button>
          ))}
        </div>
      </div>

      {/* Loved one checkbox */}
      <div className="p-2.5 rounded-xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 space-y-1">
        <label className="flex items-center gap-2 cursor-pointer font-semibold text-amber-950 dark:text-amber-200">
          <input
            type="checkbox"
            checked={isLovedOne}
            onChange={(e) => setIsLovedOne(e.target.checked)}
            className="accent-amber-700 rounded"
          />
          <span>{t('gallery.lovedOneLabel')}</span>
        </label>
        <p className="text-[10px] text-amber-800/90 dark:text-amber-300/80 leading-snug">
          {t('gallery.lovedOneNote')}
        </p>
      </div>

      {/* Actions */}
      <div className="flex gap-2 pt-1">
        <button
          type="button"
          onClick={handleSave}
          disabled={isProcessing || !previewUrl || !caption.trim()}
          className="btn-primary text-xs py-2.5 flex-1 cursor-pointer disabled:opacity-50 min-h-[40px] flex items-center justify-center gap-1.5"
        >
          <span>✓</span>
          <span>{isProcessing ? t('common.loading') : t('common.save')}</span>
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="btn-secondary text-xs py-2.5 px-4 cursor-pointer min-h-[40px]"
        >
          {t('common.cancel')}
        </button>
      </div>
    </div>
  );
}
