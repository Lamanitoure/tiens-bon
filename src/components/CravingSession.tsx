import { useEffect, useState } from 'react';
import { t } from '../i18n/index.ts';
import { generateMotivation } from '../lib/api.ts';
import { activeConfig } from '../lib/config.ts';
import type { Profile } from '../schemas/profile.ts';
import { getRandomFallback, validateModelOutput } from '../security/safety.ts';
import { BreathingAnchor } from './BreathingAnchor.tsx';

interface CravingSessionProps {
  profile: Profile;
  onClose: () => void;
  onLogged: (type: 'resisted' | 'relapse', trigger?: string) => void;
}

export function CravingSession({ profile, onClose, onLogged }: CravingSessionProps) {
  const [secondsRemaining, setSecondsRemaining] = useState(
    activeConfig.app.challengeDurationSeconds || 180,
  );
  const [isDiscreet, setIsDiscreet] = useState(profile.discreetMode ?? true);
  const [activeChallenge, setActiveChallenge] = useState<string>('');
  const [activePhrase, setActivePhrase] = useState<string>('');
  const [sessionStatus, setSessionStatus] = useState<'active' | 'resisted' | 'relapse'>('active');
  const [isTimerRunning, setIsTimerRunning] = useState(true);

  // Initialize phrase and challenge
  useEffect(() => {
    // 1. Pick random phrase from her own authentic list
    if (profile.phrases && profile.phrases.length > 0) {
      const randomIdx = Math.floor(Math.random() * profile.phrases.length);
      setActivePhrase(profile.phrases[randomIdx]);
    }

    // 2. Pick immediate fallback or profile alternative first for instant rendering
    const fallback = getRandomFallback(profile.language);
    const initialAlt =
      profile.alternatives && profile.alternatives.length > 0
        ? profile.alternatives[Math.floor(Math.random() * profile.alternatives.length)]
        : fallback.challenge;

    setActiveChallenge(initialAlt);

    // 3. Try to fetch a live personalized Gemma challenge asynchronously if online
    (async () => {
      try {
        const prompt = `You help Camille through a 3-minute craving. Profile: ${profile.reasons.join(', ')}. Alternatives she likes: ${profile.alternatives.join(', ')}. Tone: ${profile.tone}. Write in ${profile.language}. Return JSON: {"challenge": "...", "message": "..."}`;
        const modelOutput = await generateMotivation(prompt);
        const validated = validateModelOutput(modelOutput, profile.language);
        if (validated.sanitized?.challenge) {
          setActiveChallenge(validated.sanitized.challenge);
        }
      } catch (_err) {
        // Smoothly fall back to local profile alternative (100% offline)
      }
    })();
  }, [profile]);

  // Timer countdown
  useEffect(() => {
    if (!isTimerRunning || sessionStatus !== 'active') return;

    const timer = setInterval(() => {
      setSecondsRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isTimerRunning, sessionStatus]);

  const formatTime = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleResisted = () => {
    setIsTimerRunning(false);
    setSessionStatus('resisted');
    onLogged('resisted', activeChallenge);
  };

  const handleRelapse = () => {
    setIsTimerRunning(false);
    setSessionStatus('relapse');
    onLogged('relapse', activeChallenge);
  };

  const handleNextChallenge = () => {
    if (profile.alternatives && profile.alternatives.length > 0) {
      const next = profile.alternatives[Math.floor(Math.random() * profile.alternatives.length)];
      setActiveChallenge(next);
    } else {
      setActiveChallenge(getRandomFallback(profile.language).challenge);
    }
  };

  // Outcome: Resisted view
  if (sessionStatus === 'resisted') {
    return (
      <div className="card space-y-5 text-center p-6 bg-emerald-900 text-white border-none shadow-md">
        <div className="text-4xl animate-bounce">🌱</div>
        <div className="space-y-2">
          <h3 className="text-xl font-bold">{t('craving.heldSuccess')}</h3>
          <p className="text-xs text-emerald-100/90 leading-relaxed">
            Chaque seconde passée renforce ton indépendance et régénère ton corps.
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="w-full bg-white text-emerald-950 font-bold py-3 px-4 rounded-xl text-sm hover:bg-emerald-50 active:scale-95 transition-all cursor-pointer"
        >
          {t('craving.backHome')}
        </button>
      </div>
    );
  }

  // Outcome: Relapse gentle view (Section 7: Step 7 non-guilt screen)
  if (sessionStatus === 'relapse') {
    return (
      <div className="card space-y-5 p-6 bg-stone-100 border-stone-300 text-stone-900 shadow-sm">
        <div className="flex items-center gap-3">
          <span className="text-2xl">☕</span>
          <div>
            <h3 className="text-base font-bold text-stone-900">{t('relapse.title')}</h3>
            <span className="text-xs text-stone-500">Pas de panique, pas de jugement</span>
          </div>
        </div>

        <p className="text-xs text-stone-700 leading-relaxed bg-white p-3.5 rounded-xl border border-stone-200">
          {t('relapse.message')}
        </p>

        <div className="text-xs text-stone-600 italic">
          « Ce n'est pas un retour à la case départ, c'est juste une étape d'apprentissage. »
        </div>

        <button
          type="button"
          onClick={onClose}
          className="btn-primary text-xs py-3 w-full cursor-pointer"
        >
          {t('relapse.restart')}
        </button>
      </div>
    );
  }

  // Active Craving Session View
  return (
    <div
      className={`card transition-colors duration-300 p-5 space-y-5 ${
        isDiscreet
          ? 'bg-stone-950 text-stone-100 border-stone-800'
          : 'bg-white text-stone-900 border-emerald-300 shadow-md'
      }`}
    >
      {/* Header: Title and Discreet Mode Toggle */}
      <div className="flex items-center justify-between pb-2 border-b border-stone-200/20">
        <div>
          <h3 className="text-sm font-bold tracking-tight">
            {isDiscreet ? t('craving.discreetTitle') : t('craving.holdOn')}
          </h3>
          <p className="text-[11px] opacity-75">
            {isDiscreet ? t('craving.discreetTagline') : t('app.tagline')}
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsDiscreet(!isDiscreet)}
          className={`text-[11px] px-2.5 py-1 rounded-full font-medium transition-all ${
            isDiscreet
              ? 'bg-stone-800 text-stone-200 border border-stone-700'
              : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
          }`}
          aria-label="Toggle discreet mode"
        >
          {isDiscreet ? '🕶️ Discret' : '👁️ Standard'}
        </button>
      </div>

      {/* 3-Minute Timer Countdown */}
      <div className="text-center space-y-1">
        <div
          className={`text-4xl font-mono font-bold tracking-wider ${
            isDiscreet ? 'text-stone-100' : 'text-emerald-900'
          }`}
        >
          {formatTime(secondsRemaining)}
        </div>
        <p className="text-[11px] opacity-60">
          {secondsRemaining > 0 ? 'Laissez passer la vague' : 'Les 3 minutes sont passées !'}
        </p>
      </div>

      {/* Visual Anchor: Breathing Animation */}
      <BreathingAnchor isDiscreet={isDiscreet} />

      {/* Concrete Challenge */}
      <div
        className={`p-3.5 rounded-xl border space-y-1.5 ${
          isDiscreet
            ? 'bg-stone-900 border-stone-800 text-stone-200'
            : 'bg-emerald-50/70 border-emerald-200 text-emerald-950'
        }`}
      >
        <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider opacity-75">
          <span>{isDiscreet ? 'Activité recommandée' : 'Défi concret (3 min)'}</span>
          <button
            type="button"
            onClick={handleNextChallenge}
            className="hover:underline opacity-80 cursor-pointer text-[10px]"
          >
            🔄 {t('craving.anotherChallenge')}
          </button>
        </div>
        <p className="text-xs font-semibold leading-relaxed">
          {activeChallenge || 'Prenez 5 respirations profondes et buvez un verre d eau.'}
        </p>
      </div>

      {/* Her Own Voice Phrase */}
      {activePhrase && !isDiscreet && (
        <blockquote className="text-xs italic text-stone-600 border-l-2 border-emerald-700 pl-3 py-1">
          « {activePhrase} »
        </blockquote>
      )}

      {/* Action Buttons: "J'ai tenu" and "J'ai fumé" */}
      <div className="space-y-2 pt-2">
        <button
          type="button"
          onClick={handleResisted}
          className={`w-full py-3.5 px-4 rounded-xl font-bold text-sm shadow-xs transition-all cursor-pointer ${
            isDiscreet
              ? 'bg-stone-200 text-stone-900 hover:bg-white active:scale-[0.98]'
              : 'bg-emerald-800 text-white hover:bg-emerald-900 active:scale-[0.98]'
          }`}
        >
          ✓ {isDiscreet ? t('craving.discreetHeld') : t('craving.resisted')}
        </button>

        <button
          type="button"
          onClick={handleRelapse}
          className={`w-full py-2.5 px-4 rounded-xl text-xs font-medium transition-all cursor-pointer ${
            isDiscreet
              ? 'text-stone-400 hover:text-stone-200 bg-stone-900 border border-stone-800'
              : 'text-stone-600 hover:text-stone-900 bg-stone-100 border border-stone-200 hover:bg-stone-200'
          }`}
        >
          {isDiscreet ? t('craving.discreetSmoked') : t('craving.smoked')}
        </button>
      </div>
    </div>
  );
}
