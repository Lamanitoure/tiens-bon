/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useState } from 'react';
import demoProfile from '../demo/profile.demo.json';
import { getLanguage, initLanguage, setLanguage, subscribeLanguage, t } from './i18n/index.ts';
import { checkModelStatus, generateMotivation, getStoredToken, setStoredToken } from './lib/api.ts';
import { activeConfig } from './lib/config.ts';
import type { CravingOutput } from './schemas/model.ts';
import { type Profile, ProfileSchema } from './schemas/profile.ts';

export default function App() {
  const [lang, setCurrentLangState] = useState(getLanguage());
  const [profile, setProfile] = useState<Profile | null>(null);

  // Model test state
  const [tokenInput, setTokenInput] = useState(getStoredToken());
  const [modelStatus, setModelStatus] = useState<string | null>(null);
  const [isCheckingStatus, setIsCheckingStatus] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedResult, setGeneratedResult] = useState<CravingOutput | null>(null);
  const [generationError, setGenerationError] = useState<string | null>(null);

  useEffect(() => {
    initLanguage('fr');
    setCurrentLangState(getLanguage());
    const unsubscribe = subscribeLanguage((newLang) => {
      setCurrentLangState(newLang);
    });

    const parseResult = ProfileSchema.safeParse(demoProfile);
    if (parseResult.success) {
      setProfile(parseResult.data);
    }

    return () => {
      unsubscribe();
    };
  }, []);

  if (!activeConfig.isValid) {
    return (
      <main className="min-h-screen bg-stone-100 flex items-center justify-center p-6 text-stone-900">
        <div className="card max-w-md w-full border-red-200 bg-white p-6 space-y-4 shadow-sm">
          <div className="text-red-700 font-bold text-lg flex items-center gap-2">
            <span>⚠️</span> {t('common.configError')}
          </div>
          <p className="text-sm text-stone-600">{t('common.configErrorDesc')}</p>
          <ul className="text-xs bg-red-50 p-3 rounded-lg text-red-800 space-y-1 font-mono">
            {activeConfig.errors.map((err) => (
              <li key={err}>{err}</li>
            ))}
          </ul>
        </div>
      </main>
    );
  }

  const toggleLanguage = () => {
    const nextLang = lang === 'fr' ? 'en' : 'fr';
    setLanguage(nextLang);
  };

  const handleSaveToken = () => {
    setStoredToken(tokenInput);
    setModelStatus(null);
  };

  const handleCheckModelStatus = async () => {
    setIsCheckingStatus(true);
    setModelStatus(null);
    try {
      const res = await checkModelStatus();
      if (res.ollama === 'ok') {
        setModelStatus(t('model.statusOk'));
      } else if (res.ollama === 'model_missing') {
        setModelStatus(t('model.statusMissing'));
      } else if (res.ollama === 'unauthorized') {
        setModelStatus(t('model.statusUnauthorized'));
      } else {
        setModelStatus(t('model.statusUnreachable'));
      }
    } finally {
      setIsCheckingStatus(false);
    }
  };

  const handleTestGenerate = async () => {
    setIsGenerating(true);
    setGenerationError(null);
    setGeneratedResult(null);

    const testPrompt =
      'You help Camille resist an urge after lunch. Write a 3-minute concrete challenge using something she likes, and a kind 2-sentence message in her warm voice. Return JSON: {"challenge": "...", "message": "..."}';

    try {
      const output = await generateMotivation(testPrompt);
      setGeneratedResult(output);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setGenerationError(err.message);
      } else {
        setGenerationError(t('common.error'));
      }
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="app-container">
      {/* Top Header & Language Switch */}
      <header className="flex items-center justify-between py-4 border-b border-stone-200">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-full bg-emerald-800 text-white flex items-center justify-center font-bold text-sm">
            TB
          </div>
          <div>
            <h1 className="text-xl font-bold text-stone-900 leading-none">{t('app.name')}</h1>
            <span className="text-xs text-stone-500 font-medium">v0.1.0</span>
          </div>
        </div>

        <button
          type="button"
          onClick={toggleLanguage}
          className="btn-secondary !w-auto text-xs py-1.5 px-3 rounded-full font-semibold border-stone-300"
          aria-label="Switch language"
        >
          {lang === 'fr' ? '🇬🇧 English' : '🇫🇷 Français'}
        </button>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 py-6 space-y-6">
        {/* Demo Profile Badge */}
        <div className="bg-emerald-50/80 border border-emerald-200/80 rounded-xl p-3.5 flex items-start gap-3">
          <span className="text-lg">🌿</span>
          <div className="space-y-0.5">
            <div className="text-xs font-semibold text-emerald-900">{t('demo.badge')}</div>
            <div className="text-xs text-emerald-800/90">{t('demo.description')}</div>
          </div>
        </div>

        {/* Step 4: Model Connection & Smoke Test Card */}
        <section className="card space-y-4 border-emerald-200 bg-white">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-emerald-900 flex items-center gap-2">
              <span>🤖</span> {t('model.title')}
            </h3>
            <span className="badge-status">Gemma 2:2b</span>
          </div>

          {/* Token configuration field */}
          <div className="space-y-1.5">
            <label htmlFor="token-input" className="text-xs font-medium text-stone-700 block">
              {t('model.tokenLabel')}
            </label>
            <div className="flex gap-2">
              <input
                id="token-input"
                type="password"
                value={tokenInput}
                onChange={(e) => setTokenInput(e.target.value)}
                placeholder={t('model.tokenPlaceholder')}
                className="flex-1 px-3 py-2 text-xs rounded-lg border border-stone-300 bg-stone-50 text-stone-900 focus:bg-white"
              />
              <button
                type="button"
                onClick={handleSaveToken}
                className="btn-secondary !w-auto text-xs py-2 px-3 shrink-0"
              >
                {t('model.saveToken')}
              </button>
            </div>
          </div>

          {/* Status Check Button */}
          <div className="space-y-2 pt-1">
            <button
              type="button"
              onClick={handleCheckModelStatus}
              disabled={isCheckingStatus}
              className="btn-secondary text-xs py-2.5 w-full flex justify-center items-center gap-2"
            >
              {isCheckingStatus ? t('common.loading') : t('model.checkStatus')}
            </button>

            {modelStatus && (
              <div className="p-3 bg-stone-50 rounded-lg border border-stone-200 text-xs text-stone-800 leading-relaxed font-medium">
                {modelStatus}
              </div>
            )}
          </div>

          {/* Generate Test Button */}
          <div className="pt-2 border-t border-stone-100 space-y-3">
            <button
              type="button"
              onClick={handleTestGenerate}
              disabled={isGenerating}
              className="btn-primary text-xs py-3 w-full flex justify-center items-center gap-2 cursor-pointer"
            >
              {isGenerating ? t('model.generating') : t('model.generateTest')}
            </button>

            {generationError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800">
                ❌ {generationError}
              </div>
            )}

            {generatedResult && (
              <div className="p-4 bg-emerald-50/70 border border-emerald-200/80 rounded-xl space-y-3">
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-900">
                    {t('model.challengeLabel')}
                  </div>
                  <p className="text-xs font-semibold text-stone-800 mt-0.5">
                    {generatedResult.challenge}
                  </p>
                </div>
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-900">
                    {t('model.messageLabel')}
                  </div>
                  <p className="text-xs text-stone-700 italic mt-0.5">
                    « {generatedResult.message} »
                  </p>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Craving Action Button */}
        <div className="card text-center space-y-4 bg-emerald-800 text-white border-transparent">
          <div className="space-y-1">
            <h2 className="text-lg font-bold">{t('craving.holdOn')}</h2>
            <p className="text-xs text-emerald-100/90">{t('app.tagline')}</p>
          </div>
          <button
            type="button"
            className="w-full bg-white text-emerald-950 font-bold py-3.5 px-5 rounded-xl shadow-xs text-base hover:bg-emerald-50 active:scale-[0.99] transition-all cursor-pointer"
          >
            ⚡ {t('craving.button')}
          </button>
        </div>

        {/* Fictional Profile View */}
        {profile && (
          <section className="space-y-4">
            <h3 className="text-sm font-bold uppercase tracking-wider text-stone-500">
              {t('profile.title')}
            </h3>

            <div className="card space-y-3">
              <h4 className="text-sm font-semibold text-stone-900 flex items-center gap-2">
                <span>🎯</span> {t('profile.reasons')}
              </h4>
              <ul className="text-sm text-stone-700 space-y-1.5 pl-5 list-disc marker:text-emerald-700">
                {profile.reasons.map((reason) => (
                  <li key={reason}>{reason}</li>
                ))}
              </ul>
            </div>

            <div className="card space-y-3">
              <h4 className="text-sm font-semibold text-stone-900 flex items-center gap-2">
                <span>⏰</span> {t('profile.riskWindows')}
              </h4>
              <div className="grid grid-cols-2 gap-2">
                {profile.riskWindows.map((rw) => (
                  <div
                    key={rw.label}
                    className="p-2.5 bg-stone-50 rounded-lg border border-stone-200/60 text-xs"
                  >
                    <div className="font-semibold text-stone-900">{rw.time}</div>
                    <div className="text-stone-600 truncate">{rw.label}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="card space-y-3">
              <h4 className="text-sm font-semibold text-stone-900 flex items-center gap-2">
                <span>💬</span> {t('profile.phrases')}
              </h4>
              <div className="space-y-2">
                {profile.phrases.slice(0, 4).map((phrase) => (
                  <blockquote
                    key={phrase}
                    className="italic text-xs text-stone-700 border-l-2 border-emerald-700 pl-3 py-0.5"
                  >
                    « {phrase} »
                  </blockquote>
                ))}
              </div>
            </div>

            <div className="card space-y-2 bg-stone-50 border-stone-200">
              <h4 className="text-xs font-semibold text-stone-800 flex items-center gap-1.5">
                <span>☎️</span> {t('profile.helpline')}
              </h4>
              <div className="text-sm font-bold text-stone-900">
                {profile.helpline.label} :{' '}
                <span className="text-emerald-800">{profile.helpline.contact}</span>
              </div>
            </div>
          </section>
        )}
      </main>

      {/* Mandatory Medical Disclaimer */}
      <footer className="pt-4 pb-2 border-t border-stone-200 text-center space-y-1">
        <p className="text-[11px] text-stone-500 leading-tight">{t('disclaimer.medical')}</p>
        <p className="text-[11px] text-stone-500 leading-tight">{t('disclaimer.doctor')}</p>
      </footer>
    </div>
  );
}
