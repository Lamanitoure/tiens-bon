import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  isPaused,
  isSpeaking,
  isSpeechSupported,
  pauseSpeech,
  resumeSpeech,
  speakChallenge,
  stopSpeech,
} from '../src/lib/audio.ts';

describe('Step 17: Audio challenges via SpeechSynthesis (TTS)', () => {
  let mockSpeak: ReturnType<typeof vi.fn>;
  let mockCancel: ReturnType<typeof vi.fn>;
  let mockPause: ReturnType<typeof vi.fn>;
  let mockResume: ReturnType<typeof vi.fn>;
  let mockSynthesis: {
    speak: ReturnType<typeof vi.fn>;
    cancel: ReturnType<typeof vi.fn>;
    pause: ReturnType<typeof vi.fn>;
    resume: ReturnType<typeof vi.fn>;
    speaking: boolean;
    paused: boolean;
    getVoices: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    mockSpeak = vi.fn();
    mockCancel = vi.fn();
    mockPause = vi.fn();
    mockResume = vi.fn();
    mockSynthesis = {
      speak: mockSpeak,
      cancel: mockCancel,
      pause: mockPause,
      resume: mockResume,
      speaking: false,
      paused: false,
      getVoices: vi.fn().mockReturnValue([
        { lang: 'fr-FR', name: 'Voix française', localService: true },
        { lang: 'en-US', name: 'English voice', localService: true },
      ]),
    };

    // Mock window.speechSynthesis
    Object.defineProperty(window, 'speechSynthesis', {
      writable: true,
      value: mockSynthesis,
    });

    // Mock SpeechSynthesisUtterance
    class MockSpeechSynthesisUtterance {
      text: string;
      lang = '';
      rate = 1;
      pitch = 1;
      voice: unknown = null;
      onstart: (() => void) | null = null;
      onend: (() => void) | null = null;
      onerror: ((e: unknown) => void) | null = null;
      onpause: (() => void) | null = null;
      onresume: (() => void) | null = null;

      constructor(text: string) {
        this.text = text;
      }
    }

    Object.defineProperty(window, 'SpeechSynthesisUtterance', {
      writable: true,
      value: MockSpeechSynthesisUtterance,
    });
  });

  describe('Feature detection', () => {
    it('detects SpeechSynthesis support correctly in browser environment', () => {
      expect(isSpeechSupported()).toBe(true);
    });
  });

  describe('speakChallenge playback and calming parameters', () => {
    it('creates utterance with calming speech rate (0.9x) and correct language', () => {
      const challengeText = "Bois un grand verre d'eau fraîche et respire profondément.";
      const onStart = vi.fn();
      const onEnd = vi.fn();

      const utterance = speakChallenge(challengeText, {
        lang: 'fr',
        rate: 0.85,
        onStart,
        onEnd,
      });

      expect(utterance).not.toBeNull();
      expect(utterance?.text).toBe(challengeText);
      expect(utterance?.lang).toBe('fr-FR');
      expect(utterance?.rate).toBe(0.85);

      // Verify that ongoing speech was cancelled first, then new speech started
      expect(mockCancel).toHaveBeenCalled();
      expect(mockSpeak).toHaveBeenCalledWith(utterance);

      // Simulate start and end events
      utterance?.onstart?.call(utterance, new Event('start') as SpeechSynthesisEvent);
      expect(onStart).toHaveBeenCalled();

      utterance?.onend?.call(utterance, new Event('end') as SpeechSynthesisEvent);
      expect(onEnd).toHaveBeenCalled();
    });

    it('sets English language code properly when requested', () => {
      const utterance = speakChallenge('Take 10 deep breaths at the window.', {
        lang: 'en',
      });
      expect(utterance?.lang).toBe('en-US');
    });

    it('returns null for empty or whitespace-only text', () => {
      const utterance = speakChallenge('   ');
      expect(utterance).toBeNull();
      expect(mockSpeak).not.toHaveBeenCalled();
    });
  });

  describe('Pause, Resume, and Stop controls', () => {
    it('pauses ongoing speech when playing', () => {
      mockSynthesis.speaking = true;
      mockSynthesis.paused = false;

      pauseSpeech();
      expect(mockPause).toHaveBeenCalled();
    });

    it('resumes paused speech', () => {
      mockSynthesis.paused = true;

      resumeSpeech();
      expect(mockResume).toHaveBeenCalled();
    });

    it('stops and cancels all speech', () => {
      stopSpeech();
      expect(mockCancel).toHaveBeenCalled();
    });

    it('reflects speech state helpers accurately', () => {
      mockSynthesis.speaking = true;
      mockSynthesis.paused = false;
      expect(isSpeaking()).toBe(true);
      expect(isPaused()).toBe(false);

      mockSynthesis.paused = true;
      expect(isPaused()).toBe(true);
    });
  });
});
