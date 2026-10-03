import { activeConfig } from './config.ts';

export interface ProcessedImageResult {
  dataUrl: string;
  width: number;
  height: number;
  sizeBytes: number;
}

const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_DIMENSION = 1200; // Cap image dimension to keep IndexedDB lean and fast

/**
 * Re-encodes an image file through an HTMLCanvasElement to:
 * 1. Completely strip EXIF/GPS and all camera metadata (Security Section 5 Item 15).
 * 2. Cap dimensions to prevent memory exhaustion and sluggish renders.
 * 3. Enforce maximum byte size from config/app.config.json.
 * 4. Verify MIME type.
 */
export async function sanitizeAndEncodeImage(
  file: File | Blob,
  maxSizeBytes?: number,
  quality?: number,
): Promise<ProcessedImageResult> {
  const effectiveMaxSizeBytes =
    maxSizeBytes ?? activeConfig.app.imageLimits.maxSizeBytes ?? 1_572_864;
  const effectiveQuality = quality ?? activeConfig.app.imageLimits.quality ?? 0.8;

  // 1. Verify MIME type
  if (!ALLOWED_MIME_TYPES.has(file.type)) {
    throw new Error(`Unsupported image type: '${file.type}'. Allowed types: JPEG, PNG, WebP.`);
  }

  // 2. Load image into Image element safely
  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('Failed to load image file.'));
      el.src = objectUrl;
    });

    // 3. Compute scaled dimensions maintaining aspect ratio
    let targetWidth = img.naturalWidth || img.width;
    let targetHeight = img.naturalHeight || img.height;

    if (targetWidth === 0 || targetHeight === 0) {
      throw new Error('Invalid image dimensions (0x0).');
    }

    if (targetWidth > MAX_DIMENSION || targetHeight > MAX_DIMENSION) {
      if (targetWidth > targetHeight) {
        targetHeight = Math.round((targetHeight * MAX_DIMENSION) / targetWidth);
        targetWidth = MAX_DIMENSION;
      } else {
        targetWidth = Math.round((targetWidth * MAX_DIMENSION) / targetHeight);
        targetHeight = MAX_DIMENSION;
      }
    }

    // 4. Draw to canvas to strip EXIF and metadata
    const canvas = document.createElement('canvas');
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Canvas 2D context is unavailable.');
    }

    ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

    // 5. Export as JPEG with configured quality
    const dataUrl = canvas.toDataURL('image/jpeg', effectiveQuality);

    // 6. Estimate byte size from dataUrl
    // base64 length * 3/4 approximates binary byte size
    const base64Data = dataUrl.split(',')[1] || '';
    const approxBytes = Math.round((base64Data.length * 3) / 4);

    if (approxBytes > effectiveMaxSizeBytes) {
      throw new Error(
        `Image exceeds size limit of ${Math.round(effectiveMaxSizeBytes / 1024)} KB. Processed size: ${Math.round(approxBytes / 1024)} KB.`,
      );
    }

    return {
      dataUrl,
      width: targetWidth,
      height: targetHeight,
      sizeBytes: approxBytes,
    };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
