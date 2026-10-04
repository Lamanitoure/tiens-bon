import { useEffect, useState } from 'react';
import { t } from '../i18n/index.ts';
import {
  isSpeechSupported,
  pauseSpeech,
  resumeSpeech,
  speakChallenge,
  stopSpeech,
} from '../lib/audio.ts';
import { HeadphonesIcon } from './icons/HeadphonesIcon.tsx';
import { PauseIcon } from './icons/PauseIcon.tsx';
import { PlayIcon } from './icons/PlayIcon.tsx';
import { StopIcon } from './icons/StopIcon.tsx';

interface AudioChallengePlayerProps {
  text: string;
  language?: string;
  isDiscreet?: boolean;
}

export function AudioChallengePlayer({
  text,
  language = 'fr',
  isDiscreet = false,
}: AudioChallengePlayerProps) {
  const [playerState, setPlayerState] = useState<'idle' | 'playing' | 'paused'>('idle');
  const [speed, setSpeed] = useState<number>(0.85); // Calm breathing pace by default
  const supported = isSpeechSupported();

  // Stop speech if text changes or component unmounts
  useEffect(() => {
    return () => {
      stopSpeech();
    };
  }, []);

  const handleStartPlay = () => {
    if (!supported || !text.trim()) return;

    setPlayerState('playing');
    speakChallenge(text, {
      lang: language,
      rate: speed,
      onStart: () => setPlayerState('playing'),
      onEnd: () => setPlayerState('idle'),
      onError: () => setPlayerState('idle'),
      onPause: () => setPlayerState('paused'),
      onResume: () => setPlayerState('playing'),
    });
  };

  const handlePause = () => {
    pauseSpeech();
    setPlayerState('paused');
  };

  const handleResume = () => {
    resumeSpeech();
    setPlayerState('playing');
  };

  const handleStop = () => {
    stopSpeech();
    setPlayerState('idle');
  };

  const handleSpeedToggle = (newSpeed: number) => {
    setSpeed(newSpeed);
    if (playerState === 'playing') {
      // Re-trigger with new rate
      speakChallenge(text, {
        lang: language,
        rate: newSpeed,
        onStart: () => setPlayerState('playing'),
        onEnd: () => setPlayerState('idle'),
        onError: () => setPlayerState('idle'),
      });
    }
  };

  if (!supported) {
    return <div className="text-[10px] text-stone-400 italic">{t('audio.unsupported')}</div>;
  }

  if (playerState === 'idle') {
    return (
      <button
        type="button"
        onClick={handleStartPlay}
        className={`w-full py-2 px-3 rounded-xl border text-xs font-semibold cursor-pointer transition-all flex items-center justify-center gap-2 min-h-[38px] ${
          isDiscreet
            ? 'bg-stone-800 text-stone-200 border-stone-700 hover:bg-stone-700'
            : 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-900 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100'
        }`}
      >
        <HeadphonesIcon className="w-4 h-4 shrink-0" />
        <span>{t('audio.listenBtn')}</span>
      </button>
    );
  }

  return (
    <div
      className={`p-3 rounded-xl border space-y-2.5 transition-all animate-fade-in ${
        isDiscreet
          ? 'bg-stone-900 border-stone-700 text-stone-100'
          : 'bg-emerald-900 text-white border-emerald-800 shadow-md'
      }`}
    >
      {/* Playing header with animated pulse */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2.5 w-2.5">
            {playerState === 'playing' && (
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            )}
            <span
              className={`relative inline-flex rounded-full h-2.5 w-2.5 ${
                playerState === 'playing' ? 'bg-emerald-400' : 'bg-amber-400'
              }`}
            />
          </span>
          <span className="text-xs font-bold">
            {playerState === 'playing' ? t('audio.playing') : t('audio.paused')}
          </span>
        </div>

        {/* Speed chips */}
        <div className="flex items-center gap-1 text-[10px]">
          <button
            type="button"
            onClick={() => handleSpeedToggle(0.85)}
            className={`px-1.5 py-0.5 rounded cursor-pointer ${
              speed === 0.85
                ? 'bg-white text-emerald-950 font-bold'
                : 'bg-white/20 text-white hover:bg-white/30'
            }`}
          >
            0.8x
          </button>
          <button
            type="button"
            onClick={() => handleSpeedToggle(1.0)}
            className={`px-1.5 py-0.5 rounded cursor-pointer ${
              speed === 1.0
                ? 'bg-white text-emerald-950 font-bold'
                : 'bg-white/20 text-white hover:bg-white/30'
            }`}
          >
            1.0x
          </button>
        </div>
      </div>

      {/* Control buttons */}
      <div className="flex items-center gap-2 pt-0.5">
        {playerState === 'playing' ? (
          <button
            type="button"
            onClick={handlePause}
            className="flex-1 py-1.5 px-3 rounded-lg bg-white/20 hover:bg-white/30 text-white text-xs font-bold cursor-pointer transition-all flex items-center justify-center gap-1.5 min-h-[34px]"
          >
            <PauseIcon className="w-3.5 h-3.5 shrink-0" />
            <span>{t('audio.pauseBtn')}</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={handleResume}
            className="flex-1 py-1.5 px-3 rounded-lg bg-white text-emerald-950 text-xs font-bold cursor-pointer transition-all flex items-center justify-center gap-1.5 min-h-[34px]"
          >
            <PlayIcon className="w-3.5 h-3.5 shrink-0" />
            <span>{t('audio.resumeBtn')}</span>
          </button>
        )}

        <button
          type="button"
          onClick={handleStop}
          className="py-1.5 px-3 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-semibold cursor-pointer transition-all min-h-[34px] flex items-center gap-1.5"
        >
          <StopIcon className="w-3.5 h-3.5 shrink-0" />
          <span>{t('audio.stopBtn')}</span>
        </button>
      </div>
    </div>
  );
}
