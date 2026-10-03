import { useEffect, useState } from 'react';
import { t } from '../i18n/index.ts';

interface BreathingAnchorProps {
  isDiscreet?: boolean;
}

export function BreathingAnchor({ isDiscreet = false }: BreathingAnchorProps) {
  const [phase, setPhase] = useState<'in' | 'hold' | 'out'>('in');

  useEffect(() => {
    // 4s in, 4s hold, 4s out
    let step = 0;
    const interval = setInterval(() => {
      step = (step + 1) % 3;
      if (step === 0) setPhase('in');
      else if (step === 1) setPhase('hold');
      else setPhase('out');
    }, 4000);

    return () => clearInterval(interval);
  }, []);

  const getPhaseText = () => {
    if (phase === 'in') return t('craving.breatheIn');
    if (phase === 'hold') return t('craving.holdBreath');
    return t('craving.breatheOut');
  };

  const getScaleClass = () => {
    if (phase === 'in') return 'scale-125 bg-emerald-100/80 border-emerald-300';
    if (phase === 'hold') return 'scale-125 bg-emerald-200/90 border-emerald-400';
    return 'scale-90 bg-emerald-50 border-emerald-200';
  };

  const getDiscreetScaleClass = () => {
    if (phase === 'in') return 'scale-115 bg-stone-800 border-stone-600 text-stone-200';
    if (phase === 'hold') return 'scale-115 bg-stone-750 border-stone-500 text-stone-100';
    return 'scale-90 bg-stone-900 border-stone-700 text-stone-400';
  };

  return (
    <div className="flex flex-col items-center justify-center py-6 space-y-4">
      <div
        className={`w-32 h-32 rounded-full border-2 flex items-center justify-center transition-all duration-[4000ms] ease-in-out shadow-xs select-none ${
          isDiscreet ? getDiscreetScaleClass() : getScaleClass()
        }`}
      >
        <span
          className={`text-xs font-semibold tracking-wide text-center px-2 transition-opacity duration-1000 ${
            isDiscreet ? 'text-stone-300' : 'text-emerald-950'
          }`}
        >
          {getPhaseText()}
        </span>
      </div>
      <div className="text-[11px] text-stone-500 tracking-wider uppercase font-medium">
        4s • 4s • 4s
      </div>
    </div>
  );
}
