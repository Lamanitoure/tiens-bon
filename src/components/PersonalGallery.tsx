import { useCallback, useEffect, useState } from 'react';
import { deleteImage, getAllImages } from '../db/index.ts';
import { t } from '../i18n/index.ts';
import { activeConfig } from '../lib/config.ts';
import type { ImageRecord } from '../schemas/images.ts';
import { ImageUploader } from './ImageUploader.tsx';

interface PersonalGalleryProps {
  onImagesUpdated?: (images: ImageRecord[]) => void;
}

export function PersonalGallery({ onImagesUpdated }: PersonalGalleryProps) {
  const [images, setImages] = useState<ImageRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showUploader, setShowUploader] = useState(false);
  const maxCount = activeConfig.app.imageLimits?.maxCount ?? 12;

  const refreshImages = useCallback(async () => {
    try {
      const all = await getAllImages();
      setImages(all);
      onImagesUpdated?.(all);
    } catch {
      // ignore
    } finally {
      setIsLoading(false);
    }
  }, [onImagesUpdated]);

  useEffect(() => {
    refreshImages();
  }, [refreshImages]);

  const handleDelete = async (id: string) => {
    if (!window.confirm(t('gallery.deleteConfirm'))) return;
    try {
      await deleteImage(id);
      await refreshImages();
    } catch {
      // ignore
    }
  };

  const handleImageAdded = async (_newImg: ImageRecord) => {
    setShowUploader(false);
    await refreshImages();
  };

  const getKindBadgeClass = (kind: string) => {
    switch (kind) {
      case 'motivating':
        return 'bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950/60 dark:text-amber-200 dark:border-amber-800';
      case 'calm':
        return 'bg-emerald-100 text-emerald-900 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-200 dark:border-emerald-800';
      case 'goal':
        return 'bg-blue-100 text-blue-900 border-blue-300 dark:bg-blue-950/60 dark:text-blue-200 dark:border-blue-800';
      case 'deterrent':
        return 'bg-stone-200 text-stone-900 border-stone-400 dark:bg-stone-800 dark:text-stone-300 dark:border-stone-700';
      default:
        return 'bg-stone-100 text-stone-800 border-stone-300';
    }
  };

  return (
    <div className="card space-y-4 p-5 bg-white dark:bg-stone-900 border-stone-200 dark:border-stone-800">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-stone-900 dark:text-stone-50 flex items-center gap-1.5">
            <span>🖼️</span>
            <span>{t('gallery.title')}</span>
          </h3>
          <p className="text-[11px] text-stone-500 dark:text-stone-400 font-medium">
            {t('gallery.subtitle')}
          </p>
        </div>

        <span className="text-[11px] font-mono font-semibold px-2.5 py-1 rounded-full bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 shrink-0">
          {images.length} / {maxCount}
        </span>
      </div>

      {/* Upload button or Uploader form */}
      {!showUploader ? (
        <button
          type="button"
          onClick={() => setShowUploader(true)}
          disabled={images.length >= maxCount}
          className="btn-primary text-xs py-2.5 w-full cursor-pointer flex items-center justify-center gap-2 min-h-[42px] disabled:opacity-50"
        >
          <span>➕</span>
          <span>{t('gallery.addPhoto')}</span>
        </button>
      ) : (
        <ImageUploader onImageAdded={handleImageAdded} onCancel={() => setShowUploader(false)} />
      )}

      {/* Image list */}
      {isLoading ? (
        <div className="text-center py-6 text-xs text-stone-400 font-medium">
          {t('common.loading')}
        </div>
      ) : images.length === 0 ? (
        <div className="text-center py-6 border border-dashed border-stone-200 dark:border-stone-800 rounded-2xl text-xs text-stone-500 dark:text-stone-400 space-y-1">
          <p className="text-2xl">📷</p>
          <p className="font-semibold">{t('gallery.noImages')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          {images.map((img) => (
            <div
              key={img.id}
              className="group relative rounded-2xl overflow-hidden border border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-800/50 flex flex-col"
            >
              {/* Image thumbnail */}
              <div className="relative h-36 bg-stone-900 overflow-hidden">
                <img
                  src={img.dataUrl}
                  alt={img.caption}
                  loading="lazy"
                  className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                />
                {/* Kind badge */}
                <span
                  className={`absolute top-2 left-2 text-[10px] font-bold px-2 py-0.5 rounded-md border backdrop-blur-xs ${getKindBadgeClass(
                    img.kind,
                  )}`}
                >
                  {t(`gallery.kinds.${img.kind}`)}
                </span>

                {/* Loved one indicator */}
                {img.isLovedOne && (
                  <span
                    className="absolute top-2 right-2 text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-500/90 text-white backdrop-blur-xs shadow-xs"
                    title={t('gallery.lovedOneNote')}
                  >
                    ❤️ Proche
                  </span>
                )}
              </div>

              {/* Caption and action */}
              <div className="p-3 flex-1 flex flex-col justify-between gap-2">
                <p className="text-xs text-stone-800 dark:text-stone-200 font-medium leading-snug">
                  « {img.caption} »
                </p>

                <div className="flex justify-end pt-1 border-t border-stone-200/50 dark:border-stone-700/50">
                  <button
                    type="button"
                    onClick={() => handleDelete(img.id)}
                    className="text-[11px] text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 font-semibold cursor-pointer p-1"
                  >
                    🗑️ {t('common.delete')}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
