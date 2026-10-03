import type { ImageRecord } from '../schemas/images.ts';
import type { SelfTalk } from '../schemas/selftalk.ts';

/**
 * Display rule for cravings (Step 13):
 * Motivating and goal images before or during a craving.
 * If multiple exist, randomly select one to offer variety.
 */
export function selectImageForCraving(images: ImageRecord[]): ImageRecord | null {
  if (!images || images.length === 0) return null;

  const eligible = images.filter((img) => img.kind === 'motivating' || img.kind === 'goal');
  if (eligible.length === 0) {
    // Also allow calm images as secondary fallback during craving if no motivating/goal images exist
    const calmFallback = images.filter((img) => img.kind === 'calm');
    if (calmFallback.length === 0) return null;
    return calmFallback[Math.floor(Math.random() * calmFallback.length)];
  }

  return eligible[Math.floor(Math.random() * eligible.length)];
}

/**
 * Display rule for relapse (Step 11 & Step 13):
 * INVARIANT: Calm images only in the relapse view.
 * NEVER a loved-one or deterrent image after a relapse.
 * NEVER motivating or goal images (which can induce guilt or pressure).
 */
export function selectImageForRelapse(images: ImageRecord[]): ImageRecord | null {
  if (!images || images.length === 0) return null;

  // Strictly enforce calm only, explicitly rejecting loved ones, deterrent, motivating, and goal
  const safeCalm = images.filter((img) => {
    if (img.kind !== 'calm') return false;
    if (img.isLovedOne === true) return false;
    return true;
  });

  if (safeCalm.length === 0) return null;
  return safeCalm[Math.floor(Math.random() * safeCalm.length)];
}

/**
 * Extracts allowed text captions to pass to the prompt builder without image analysis.
 * Respects the same display rules: relapse prompts never receive loved ones or deterrent captions.
 */
export function filterAllowedCaptionsForPrompt(
  images: ImageRecord[],
  context: 'craving' | 'relapse',
): string[] {
  if (!images || images.length === 0) return [];

  if (context === 'relapse') {
    return images
      .filter((img) => img.kind === 'calm' && !img.isLovedOne)
      .map((img) => img.caption.trim())
      .filter(Boolean);
  }

  // For cravings: motivating, goal, and calm captions are allowed. Never deterrent captions unless requested.
  return images
    .filter((img) => img.kind !== 'deterrent')
    .map((img) => img.caption.trim())
    .filter(Boolean);
}

/**
 * Selects a message to her future self (written in calm moments) to replay during cravings.
 */
export function selectSelfTalkForCraving(selfTalkList: SelfTalk[]): SelfTalk | null {
  if (!selfTalkList || selfTalkList.length === 0) return null;
  return selfTalkList[Math.floor(Math.random() * selfTalkList.length)];
}
