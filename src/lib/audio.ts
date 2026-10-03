/**
 * Browser SpeechSynthesis API wrapper for Audio Challenges (Step 17).
 * Zero network, 100% private, runs entirely on-device (Security Item 9 & Step 17).
 */

export interface SpeechOptions {
  lang?: string;
  rate?: number; // 0.1 to 10, default 0.9 for calm breathing pace
  pitch?: number; // 0 to 2, default 1.0
  onStart?: () => void;
  onEnd?: () => void;
  onError?: (err: unknown) => void;
  onPause?: () => void;
  onResume?: () => void;
}

let activeUtterance: SpeechSynthesisUtterance | null = null;

export function isSpeechSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'speechSynthesis' in window &&
    typeof window.SpeechSynthesisUtterance !== 'undefined'
  );
}

export function getAvailableVoices(language?: string): SpeechSynthesisVoice[] {
  if (!isSpeechSupported()) return [];
  const voices = window.speechSynthesis.getVoices();
  if (!language) return voices;

  const prefix = language.slice(0, 2).toLowerCase();
  return voices.filter((v) => v.lang.toLowerCase().startsWith(prefix));
}

export function speakChallenge(
  text: string,
  options: SpeechOptions = {},
): SpeechSynthesisUtterance | null {
  if (!isSpeechSupported() || !text.trim()) {
    return null;
  }

  // Cancel any ongoing speech
  stopSpeech();

  const utterance = new SpeechSynthesisUtterance(text.trim());
  const langCode = options.lang?.startsWith('en') ? 'en-US' : 'fr-FR';
  utterance.lang = langCode;
  utterance.rate = options.rate ?? 0.9; // Calm, meditative pace
  utterance.pitch = options.pitch ?? 1.0;

  // Prefer natural local voices for language if available
  const voices = getAvailableVoices(langCode);
  if (voices.length > 0) {
    const localVoice = voices.find((v) => v.localService) || voices[0];
    if (localVoice) {
      utterance.voice = localVoice;
    }
  }

  utterance.onstart = () => {
    options.onStart?.();
  };

  utterance.onend = () => {
    activeUtterance = null;
    options.onEnd?.();
  };

  utterance.onerror = (e) => {
    activeUtterance = null;
    options.onError?.(e);
  };

  utterance.onpause = () => {
    options.onPause?.();
  };

  utterance.onresume = () => {
    options.onResume?.();
  };

  activeUtterance = utterance;
  window.speechSynthesis.speak(utterance);
  return utterance;
}

export function pauseSpeech(): void {
  if (!isSpeechSupported()) return;
  if (window.speechSynthesis.speaking && !window.speechSynthesis.paused) {
    window.speechSynthesis.pause();
  }
}

export function resumeSpeech(): void {
  if (!isSpeechSupported()) return;
  if (window.speechSynthesis.paused) {
    window.speechSynthesis.resume();
  }
}

export function stopSpeech(): void {
  if (!isSpeechSupported()) return;
  activeUtterance = null;
  window.speechSynthesis.cancel();
}

export function isSpeaking(): boolean {
  if (!isSpeechSupported()) return false;
  return window.speechSynthesis.speaking;
}

export function isPaused(): boolean {
  if (!isSpeechSupported()) return false;
  return window.speechSynthesis.paused;
}

export function getActiveUtterance(): SpeechSynthesisUtterance | null {
  return activeUtterance;
}
