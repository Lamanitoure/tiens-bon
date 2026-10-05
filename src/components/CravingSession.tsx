import { lazy, Suspense, useEffect, useId, useState } from 'react';
import { getAllImages, getAllPlans, getAllSelfTalk } from '../db/index.ts';
import { t } from '../i18n/index.ts';
import { activeConfig } from '../lib/config.ts';
import { getAvailableContextChips, suggestContextFromTime } from '../lib/craving.ts';
import { selectImageForCraving, selectSelfTalkForCraving } from '../lib/image-display.ts';
import { buildPersonalizedFallback, getNextPregeneratedMessage } from '../lib/pregeneration.ts';
import type { ImageRecord } from '../schemas/images.ts';
import type { Plan } from '../schemas/plans.ts';
import type { Profile } from '../schemas/profile.ts';
import type { SelfTalk } from '../schemas/selftalk.ts';
import { AudioChallengePlayer } from './AudioChallengePlayer.tsx';
import { BreathingAnchor } from './BreathingAnchor.tsx';
import {
  AlertTriangleIcon,
  CheckIcon,
  EyeIcon,
  EyeOffIcon,
  GamepadIcon,
  LeafIcon,
  MailHeartIcon,
  RefreshIcon,
  ShieldIcon,
} from './icons/index.ts';
import { RelapseDebrief } from './RelapseDebrief.tsx';

const BlockPuzzle1010 = lazy(() =>
  import('./BlockPuzzle1010.tsx').then((m) => ({ default: m.BlockPuzzle1010 })),
);

interface CravingSessionProps {
  profile: Profile;
  onClose: () => void;
  onLogged: (type: 'resisted' | 'relapse', trigger?: string, note?: string) => void;
}

export function CravingSession({ profile, onClose, onLogged }: CravingSessionProps) {
  const timerLiveId = useId();
  const totalDuration = activeConfig.app.challengeDurationSeconds || 180;
  const [secondsRemaining, setSecondsRemaining] = useState(totalDuration);
  const [isDiscreet, setIsDiscreet] = useState(profile.discreetMode ?? true);
  const [sessionStatus, setSessionStatus] = useState<'active' | 'resisted' | 'relapse'>('active');
  const [isTimerRunning, setIsTimerRunning] = useState(true);

  // Context suggestion based on current time (Step 10)
  const [selectedContext, setSelectedContext] = useState(() => suggestContextFromTime(profile));
  const availableChips = getAvailableContextChips(profile);
  const [userPlans, setUserPlans] = useState<Plan[]>([]);

  // Load existing If-Then plans, personal images, and self-talk (Step 11 & Step 13)
  const [activeImage, setActiveImage] = useState<ImageRecord | null>(null);
  const [activeSelfTalk, setActiveSelfTalk] = useState<SelfTalk | null>(null);
  const [showPuzzle1010, setShowPuzzle1010] = useState(false);

  useEffect(() => {
    getAllPlans()
      .then(setUserPlans)
      .catch(() => { });

    getAllImages()
      .then((imgs) => {
        const chosen = selectImageForCraving(imgs);
        setActiveImage(chosen);
      })
      .catch(() => { });

    getAllSelfTalk()
      .then((talks) => {
        const chosen = selectSelfTalkForCraving(talks);
        setActiveSelfTalk(chosen);
      })
      .catch(() => { });
  }, []);

  // Find if an if-then plan matches current context (Step 11)
  const matchingPlan = userPlans.find((p) => {
    const search = selectedContext.toLowerCase();
    const ifLower = p.ifText.toLowerCase();
    return (
      ifLower.includes(search) ||
      (search.includes('café') && ifLower.includes('café')) ||
      (search.includes('stress') && ifLower.includes('stress')) ||
      (search.includes('repas') && ifLower.includes('repas')) ||
      (search.includes('soir') && ifLower.includes('soir'))
    );
  });

  // Instant local-first challenge and message (< 100 ms)
  const initialFallback = buildPersonalizedFallback(profile, 'craving');
  const [activeChallenge, setActiveChallenge] = useState<string>(initialFallback.challenge);
  const [activePhrase, setActivePhrase] = useState<string>(initialFallback.message);

  // Load from pregenerated daily batch with zero latency
  useEffect(() => {
    let isMounted = true;

    (async () => {
      try {
        const cached = await getNextPregeneratedMessage('craving', profile);
        if (isMounted && cached?.challenge && cached?.message) {
          setActiveChallenge(cached.challenge);
          setActivePhrase(cached.message);
        }
      } catch {
        // Fallback already synchronously loaded
      }
    })();

    return () => {
      isMounted = false;
    };
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

  // SVG Circular Ring calculation
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - secondsRemaining / totalDuration);

  const handleResisted = () => {
    setIsTimerRunning(false);
    setSessionStatus('resisted');
    onLogged('resisted', selectedContext, activeChallenge);
  };

  const handleRelapse = () => {
    setIsTimerRunning(false);
    setSessionStatus('relapse');
  };

  const handleRelapseDebriefFinish = (data: {
    trigger: string;
    missingSupport?: string;
    note?: string;
    planSaved?: boolean;
  }) => {
    onLogged('relapse', data.trigger || selectedContext, data.note);
    onClose();
  };

  const handleNextChallenge = () => {
    if (profile.alternatives && profile.alternatives.length > 0) {
      const remaining = profile.alternatives.filter((alt) => alt !== activeChallenge);
      const next =
        remaining.length > 0
          ? remaining[Math.floor(Math.random() * remaining.length)]
          : profile.alternatives[0];
      setActiveChallenge(next);
    } else {
      const fallback = buildPersonalizedFallback(profile, 'craving');
      setActiveChallenge(fallback.challenge);
    }
  };

  // Outcome: Resisted view
  if (sessionStatus === 'resisted') {
    return (
      <div className="card space-y-5 text-center p-6 bg-emerald-900 text-white border-none shadow-md animate-fade-in">
        <div className="flex justify-center">
          <LeafIcon className="w-10 h-10 text-emerald-300" />
        </div>
        <div className="space-y-2">
          <h3 className="text-xl font-bold">{t('craving.heldSuccess')}</h3>
          <p className="text-xs text-emerald-100/90 leading-relaxed">
            Chaque vague surmontée renforce ta liberté et prouve que tu es plus fort(e) que cette
            habitude.
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="w-full bg-white text-emerald-950 font-bold py-3.5 px-4 rounded-xl text-sm hover:bg-emerald-50 active:scale-95 transition-all cursor-pointer min-h-[48px]"
        >
          {t('craving.backHome')}
        </button>
      </div>
    );
  }

  // Outcome: Relapse gentle view with micro-debrief (Step 11)
  if (sessionStatus === 'relapse') {
    return <RelapseDebrief profile={profile} onFinish={handleRelapseDebriefFinish} />;
  }

  // Active Craving Session View (Step 10)
  return (
    <div
      className={`card transition-colors duration-300 p-5 space-y-4 shadow-lg ${isDiscreet
          ? 'bg-stone-950 text-stone-100 border-stone-800'
          : 'bg-white text-stone-900 border-emerald-300'
        }`}
    >
      {/* Header: Title, Context Chip, and Discreet Mode Toggle */}
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
          className={`text-[11px] px-3 py-1.5 rounded-full font-medium transition-all cursor-pointer min-h-[36px] flex items-center gap-1.5 ${isDiscreet
              ? 'bg-stone-800 text-stone-200 border border-stone-700'
              : 'bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100'
            }`}
          aria-label="Toggle discreet mode"
        >
          {isDiscreet ? (
            <>
              <EyeOffIcon className="w-3.5 h-3.5" />
              <span>Discret</span>
            </>
          ) : (
            <>
              <EyeIcon className="w-3.5 h-3.5" />
              <span>Standard</span>
            </>
          )}
        </button>
      </div>

      {/* Context Selection Row (Step 10: context choice or suggested from time) */}
      <div className="space-y-1.5">
        <span className="text-[11px] font-semibold opacity-70 block">
          {isDiscreet ? 'Contexte actuel :' : 'Moment actuel (suggéré) :'}
        </span>
        <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none text-xs">
          {availableChips.map((chip) => {
            const isSelected = selectedContext === chip;
            return (
              <button
                key={chip}
                type="button"
                onClick={() => setSelectedContext(chip)}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium whitespace-nowrap transition-all cursor-pointer shrink-0 min-h-[32px] ${isSelected
                    ? isDiscreet
                      ? 'bg-stone-200 text-stone-950 font-bold'
                      : 'bg-emerald-800 text-white font-bold'
                    : isDiscreet
                      ? 'bg-stone-900 text-stone-400 border border-stone-800 hover:text-stone-200'
                      : 'bg-stone-100 text-stone-700 border border-stone-200 hover:bg-stone-200'
                  }`}
              >
                {chip}
              </button>
            );
          })}
        </div>
      </div>

      {/* Circular SVG Timer Ring */}
      <div className="flex flex-col items-center justify-center py-2 space-y-2">
        <div className="relative flex items-center justify-center w-36 h-36">
          <svg
            className="w-full h-full -rotate-90 transform"
            viewBox="0 0 120 120"
            role="img"
            aria-label="Minuteur de respiration"
          >
            <title>Minuteur circulaire</title>
            {/* Background ring */}
            <circle
              cx="60"
              cy="60"
              r={radius}
              className={`${isDiscreet ? 'text-stone-800' : 'text-emerald-100'}`}
              strokeWidth="7"
              stroke="currentColor"
              fill="transparent"
            />
            {/* Animated countdown ring */}
            <circle
              cx="60"
              cy="60"
              r={radius}
              className={`transition-all duration-1000 ease-linear ${isDiscreet ? 'text-stone-300' : 'text-emerald-700'
                }`}
              strokeWidth="7"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              stroke="currentColor"
              fill="transparent"
            />
          </svg>

          {/* Time Display centered inside ring */}
          <div className="absolute flex flex-col items-center justify-center text-center">
            <span
              className={`text-3xl font-mono font-bold tracking-wider ${isDiscreet ? 'text-stone-100' : 'text-emerald-950'
                }`}
            >
              {formatTime(secondsRemaining)}
            </span>
            <span className="text-[10px] opacity-60 font-medium">
              {secondsRemaining > 0 ? 'Surfer sur la vague' : 'Temps écoulé !'}
            </span>
          </div>
        </div>

        {/* Accessible live region for timer state */}
        <div id={timerLiveId} className="sr-only" aria-live="polite">
          {secondsRemaining === 0
            ? 'Trois minutes écoulées. Félicitations pour avoir tenu bon.'
            : secondsRemaining === 60
              ? 'Il reste une minute.'
              : secondsRemaining === 30
                ? 'Plus que trente secondes.'
                : ''}
        </div>
      </div>

      {/* Visual Anchor: Breathing Anchor */}
      <BreathingAnchor isDiscreet={isDiscreet} />

      {/* Surfaced If-Then Plan for this context (Step 11) */}
      {matchingPlan && (
        <div
          className={`p-3.5 rounded-xl border space-y-1.5 ${isDiscreet
              ? 'bg-stone-900 border-stone-700 text-stone-200'
              : 'bg-emerald-100/70 border-emerald-300 text-emerald-950'
            }`}
        >
          <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider">
            <span className="flex items-center gap-1.5">
              <ShieldIcon className="w-3.5 h-3.5" />
              <span>{isDiscreet ? 'Plan préparé' : 'Ton plan d’action prévu'}</span>
            </span>
            <button
              type="button"
              onClick={() => setActiveChallenge(matchingPlan.thenText)}
              className="text-[10px] underline font-bold cursor-pointer opacity-90 hover:opacity-100"
            >
              Utiliser comme défi
            </button>
          </div>
          <p className="text-xs font-semibold leading-relaxed">{matchingPlan.thenText}</p>
        </div>
      )}

      {/* Concrete Challenge Section with Audio Player (Step 17) */}
      <div
        className={`p-3.5 rounded-xl border space-y-2.5 ${isDiscreet
            ? 'bg-stone-900 border-stone-800 text-stone-200'
            : 'bg-emerald-50/70 border-emerald-200 text-emerald-950'
          }`}
      >
        <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider opacity-75">
          <span>{isDiscreet ? 'Activité recommandée' : 'Défi concret (3 min)'}</span>
          <button
            type="button"
            onClick={handleNextChallenge}
            className="hover:underline opacity-80 cursor-pointer text-[10px] p-1 flex items-center gap-1"
          >
            <RefreshIcon className="w-3 h-3" />
            <span>{t('craving.anotherChallenge')}</span>
          </button>
        </div>
        <p className="text-xs font-semibold leading-relaxed">{activeChallenge}</p>

        {/* Audio Challenge Player (Step 17) */}
        <AudioChallengePlayer
          text={activeChallenge}
          language={profile.language}
          isDiscreet={isDiscreet}
        />
      </div>

      {/* Optional 1010! Tactile Puzzle Distraction during the 3-minute craving */}
      <div className="space-y-2">
        <button
          type="button"
          onClick={() => setShowPuzzle1010(!showPuzzle1010)}
          className={`w-full py-2.5 px-3 rounded-xl text-xs font-semibold border transition-all cursor-pointer flex items-center justify-center gap-2 min-h-[40px] ${isDiscreet
              ? 'bg-stone-900 text-stone-200 border-stone-800 hover:bg-stone-800'
              : 'bg-stone-50 text-emerald-950 border-emerald-200 hover:bg-emerald-50'
            }`}
        >
          <GamepadIcon className="w-4 h-4" />
          <span>{showPuzzle1010 ? t('game1010.toggleClose') : t('game1010.toggleOpen')}</span>
        </button>

        {showPuzzle1010 && (
          <Suspense fallback={<div className="p-4 text-center text-xs">{t('common.loading')}</div>}>
            <BlockPuzzle1010 forceDiscreet={isDiscreet} compact />
          </Suspense>
        )}
      </div>

      {/* Personal Resource Photo & Caption (Step 13) */}
      {activeImage && !isDiscreet && (
        <div className="rounded-xl overflow-hidden border border-emerald-200/80 bg-emerald-50/40 space-y-2 p-2.5">
          <div className="relative rounded-lg overflow-hidden h-36 bg-stone-900">
            <img
              src={activeImage.dataUrl}
              alt={activeImage.caption}
              className="w-full h-full object-cover"
            />
            <span className="absolute top-2 left-2 text-[10px] font-bold px-2 py-0.5 rounded-md bg-stone-900/80 text-white backdrop-blur-xs">
              {t(`gallery.kinds.${activeImage.kind}`)}
            </span>
          </div>
          <p className="text-xs font-medium text-emerald-950 italic px-1 leading-snug">
            « {activeImage.caption} »
          </p>
        </div>
      )}

      {/* Message to future self (Step 13) */}
      {activeSelfTalk && !isDiscreet && (
        <div className="p-3 rounded-xl bg-amber-50/80 border border-amber-200/90 text-amber-950 space-y-1">
          <div className="text-[10px] font-bold uppercase tracking-wider text-amber-800 flex items-center gap-1">
            <MailHeartIcon className="w-3.5 h-3.5" />
            <span>Message de toi à toi-même</span>
          </div>
          <p className="text-xs italic leading-relaxed">« {activeSelfTalk.text} »</p>
        </div>
      )}

      {/* His Own Voice Phrase */}
      {activePhrase && !isDiscreet && (
        <blockquote className="text-xs italic text-stone-600 border-l-2 border-emerald-700 pl-3 py-1">
          « {activePhrase} »
        </blockquote>
      )}

      {/* Action Buttons: Thumb-friendly targets (> 48px height) */}
      <div className="space-y-2 pt-1">
        <button
          type="button"
          onClick={handleResisted}
          className={`w-full py-4 px-4 rounded-xl font-bold text-sm shadow-md transition-all cursor-pointer min-h-[48px] flex items-center justify-center gap-2 ${isDiscreet
              ? 'bg-stone-200 text-stone-900 hover:bg-white active:scale-[0.98]'
              : 'bg-emerald-800 text-white hover:bg-emerald-900 active:scale-[0.98]'
            }`}
        >
          <CheckIcon className="w-4 h-4" />
          <span>{isDiscreet ? t('craving.discreetHeld') : t('craving.resisted')}</span>
        </button>

        <button
          type="button"
          onClick={handleRelapse}
          className={`w-full py-3 px-4 rounded-xl text-xs font-medium transition-all cursor-pointer min-h-[44px] flex items-center justify-center gap-1.5 ${isDiscreet
              ? 'text-stone-400 hover:text-stone-200 bg-stone-900 border border-stone-800'
              : 'text-stone-600 hover:text-stone-900 bg-stone-100 border border-stone-200 hover:bg-stone-200'
            }`}
        >
          <AlertTriangleIcon className="w-3.5 h-3.5" />
          <span>{isDiscreet ? t('craving.discreetSmoked') : t('craving.smoked')}</span>
        </button>
      </div>
    </div>
  );
}
