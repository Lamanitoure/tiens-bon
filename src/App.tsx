/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { type ChangeEvent, useEffect, useState } from 'react';
import demoProfile from '../demo/profile.demo.json';
import { getAllEvents, getStoredProfile, setStoredProfile } from './db/index.ts';
import { getLanguage, initLanguage, setLanguage, subscribeLanguage, t } from './i18n/index.ts';
import { checkModelStatus, generateMotivation, getStoredToken, setStoredToken } from './lib/api.ts';
import { activeConfig } from './lib/config.ts';
import type { CravingOutput } from './schemas/model.ts';
import { type Profile, ProfileSchema } from './schemas/profile.ts';
import {
  type BackupData,
  decryptBackup,
  type EncryptedBackupPackage,
  encryptBackup,
} from './security/encryption.ts';
import { checkDistress, validateModelOutput } from './security/safety.ts';

export default function App() {
  const [lang, setCurrentLangState] = useState(getLanguage());
  const [profile, setProfile] = useState<Profile | null>(null);

  // Model test state
  const [tokenInput, setTokenInput] = useState(getStoredToken());
  const [modelStatus, setModelStatus] = useState<string | null>(null);
  const [isCheckingStatus, setIsCheckingStatus] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedResult, setGeneratedResult] = useState<CravingOutput | null>(null);
  const [wasSafetyFiltered, setWasSafetyFiltered] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);

  // Distress input state
  const [userInputNote, setUserInputNote] = useState('');
  const [distressDetected, setDistressDetected] = useState(false);

  // Backup state
  const [backupPassword, setBackupPassword] = useState('');
  const [backupStatusMessage, setBackupStatusMessage] = useState<string | null>(null);
  const [backupErrorMessage, setBackupErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    initLanguage('fr');
    setCurrentLangState(getLanguage());
    const unsubscribe = subscribeLanguage((newLang) => {
      setCurrentLangState(newLang);
    });

    // Initialize from IndexedDB or seed demo profile
    (async () => {
      try {
        let current = await getStoredProfile();
        if (!current) {
          const parsed = ProfileSchema.parse(demoProfile);
          await setStoredProfile(parsed);
          current = parsed;
        }
        setProfile(current);
      } catch (_err) {
        // Fallback to static demo profile if indexedDB not ready
        setProfile(ProfileSchema.parse(demoProfile));
      }
    })();

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

  // Distress check whenever note changes (Section 8 item 1)
  const handleNoteChange = (text: string) => {
    setUserInputNote(text);
    const distressCheck = checkDistress(text, lang);
    setDistressDetected(distressCheck.isDistress);
  };

  const handleTestGenerate = async () => {
    // If distress word detected in note, immediately stop and do NOT call model!
    if (distressDetected || checkDistress(userInputNote, lang).isDistress) {
      setDistressDetected(true);
      return;
    }

    setIsGenerating(true);
    setGenerationError(null);
    setGeneratedResult(null);
    setWasSafetyFiltered(false);

    const testPrompt = `You help ${profile?.reasons[0] ? 'Camille' : 'the user'} resist an urge. Context: ${userInputNote || 'after coffee'}. Write a 3-minute concrete challenge and a warm 2-sentence message in her voice. Return JSON: {"challenge": "...", "message": "..."}`;

    try {
      const output = await generateMotivation(testPrompt);
      // Run through output safety filter (Section 8 item 2)
      const safetyResult = validateModelOutput(output, lang);
      setGeneratedResult(safetyResult.sanitized);
      if (!safetyResult.isValid) {
        setWasSafetyFiltered(true);
      }
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

  // Web Crypto Encrypted Backup Export (Item 3 & Section 8 item 3)
  const handleExportBackup = async () => {
    setBackupErrorMessage(null);
    setBackupStatusMessage(null);

    if (!profile) return;
    if (!backupPassword || backupPassword.length < 6) {
      setBackupErrorMessage(t('backup.passwordPlaceholder'));
      return;
    }

    try {
      const events = await getAllEvents();
      const backupData: BackupData = {
        profile,
        events,
        exportedAt: Date.now(),
      };

      const encryptedPackage = await encryptBackup(backupData, backupPassword);
      const blob = new Blob([JSON.stringify(encryptedPackage, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `tiens-bon-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setBackupStatusMessage(t('backup.exportSuccess'));
    } catch (err: unknown) {
      setBackupErrorMessage(err instanceof Error ? err.message : t('common.error'));
    }
  };

  // Web Crypto Encrypted Backup Import
  const handleImportBackup = async (event: ChangeEvent<HTMLInputElement>) => {
    setBackupErrorMessage(null);
    setBackupStatusMessage(null);

    const file = event.target.files?.[0];
    if (!file) return;

    if (!backupPassword || backupPassword.length < 6) {
      setBackupErrorMessage(t('backup.passwordPlaceholder'));
      return;
    }

    try {
      const text = await file.text();
      const pkg = JSON.parse(text) as EncryptedBackupPackage;
      const decrypted = await decryptBackup(pkg, backupPassword);

      // Restore to IndexedDB
      await setStoredProfile(decrypted.profile);
      setProfile(decrypted.profile);
      setBackupStatusMessage(t('backup.importSuccess'));
    } catch (err: unknown) {
      setBackupErrorMessage(err instanceof Error ? err.message : 'Invalid backup file or password');
    } finally {
      event.target.value = '';
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
        {/* Immediate Distress Alert Card (Section 8 item 1) */}
        {distressDetected && profile && (
          <div className="p-4 bg-rose-50 border-2 border-rose-300 rounded-2xl space-y-3 shadow-sm animate-pulse-subtle">
            <div className="flex items-center gap-2 text-rose-900 font-bold text-sm">
              <span className="text-lg">🤝</span> {t('distress.alert')}
            </div>
            <p className="text-xs text-rose-800 leading-relaxed">{t('distress.message')}</p>
            <div className="space-y-2 pt-1">
              <a
                href={`tel:${profile.helpline.contact}`}
                className="btn-primary !bg-rose-800 hover:!bg-rose-900 text-xs py-2.5 flex items-center justify-center gap-2"
              >
                <span>☎️</span> {profile.helpline.label} ({profile.helpline.contact})
              </a>
              {profile.supportPerson && (
                <a
                  href={`tel:${profile.supportPerson.contact}`}
                  className="btn-secondary text-xs py-2 flex items-center justify-center gap-2 border-rose-200 text-rose-900"
                >
                  <span>💬</span> {profile.supportPerson.label} ({profile.supportPerson.contact})
                </a>
              )}
            </div>
          </div>
        )}

        {/* Demo Profile Badge */}
        <div className="bg-emerald-50/80 border border-emerald-200/80 rounded-xl p-3.5 flex items-start gap-3">
          <span className="text-lg">🌿</span>
          <div className="space-y-0.5">
            <div className="text-xs font-semibold text-emerald-900">{t('demo.badge')}</div>
            <div className="text-xs text-emerald-800/90">{t('demo.description')}</div>
          </div>
        </div>

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

        {/* Generation & Note input section */}
        <section className="card space-y-4 border-stone-200 bg-white">
          <h3 className="text-sm font-bold text-stone-900 flex items-center gap-2">
            <span>✍️</span> Qu'est-ce qui se passe maintenant ?
          </h3>

          <div className="space-y-1">
            <input
              type="text"
              value={userInputNote}
              onChange={(e) => handleNoteChange(e.target.value)}
              placeholder="Ex: envie après le repas, stress au travail..."
              className="w-full px-3 py-2 text-xs rounded-lg border border-stone-300 bg-stone-50 text-stone-900 focus:bg-white"
            />
            <p className="text-[11px] text-stone-500">
              Tapez vos ressentis. Si un mot de détresse est détecté, l'aide s'affiche
              immédiatement.
            </p>
          </div>

          <button
            type="button"
            onClick={handleTestGenerate}
            disabled={isGenerating || distressDetected}
            className="btn-primary text-xs py-3 w-full flex justify-center items-center gap-2 cursor-pointer disabled:opacity-50"
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
              {wasSafetyFiltered && (
                <div className="p-2 bg-stone-100 rounded text-[11px] text-stone-600 italic">
                  🛡️ {t('safety.filtered')}
                </div>
              )}
            </div>
          )}
        </section>

        {/* Model connection settings card */}
        <section className="card space-y-3 border-stone-200 bg-white">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-stone-800 flex items-center gap-1.5">
              <span>🤖</span> {t('model.title')}
            </h4>
            <span className="badge-status">Gemma 2:2b</span>
          </div>

          <div className="flex gap-2">
            <input
              type="password"
              value={tokenInput}
              onChange={(e) => setTokenInput(e.target.value)}
              placeholder={t('model.tokenPlaceholder')}
              className="flex-1 px-3 py-1.5 text-xs rounded-lg border border-stone-300 bg-stone-50 text-stone-900 focus:bg-white"
            />
            <button
              type="button"
              onClick={handleSaveToken}
              className="btn-secondary !w-auto text-xs py-1.5 px-3 shrink-0"
            >
              {t('model.saveToken')}
            </button>
          </div>

          <button
            type="button"
            onClick={handleCheckModelStatus}
            disabled={isCheckingStatus}
            className="btn-secondary text-xs py-2 w-full flex justify-center items-center gap-2"
          >
            {isCheckingStatus ? t('common.loading') : t('model.checkStatus')}
          </button>

          {modelStatus && (
            <div className="p-2.5 bg-stone-50 rounded-lg border border-stone-200 text-xs text-stone-800 font-medium">
              {modelStatus}
            </div>
          )}
        </section>

        {/* Encrypted Web Crypto Backup (Item 3 & Section 8 item 3) */}
        <section className="card space-y-3 border-stone-200 bg-white">
          <h4 className="text-xs font-bold text-stone-900 flex items-center gap-1.5">
            <span>🔐</span> {t('backup.title')}
          </h4>
          <p className="text-[11px] text-stone-500 leading-normal">{t('backup.description')}</p>

          <input
            type="password"
            value={backupPassword}
            onChange={(e) => setBackupPassword(e.target.value)}
            placeholder={t('backup.passwordPlaceholder')}
            className="w-full px-3 py-1.5 text-xs rounded-lg border border-stone-300 bg-stone-50 text-stone-900 focus:bg-white"
          />

          <div className="grid grid-cols-2 gap-2 pt-1">
            <button
              type="button"
              onClick={handleExportBackup}
              className="btn-secondary text-xs py-2"
            >
              📤 {t('backup.exportBtn')}
            </button>

            <label className="btn-secondary text-xs py-2 cursor-pointer text-center truncate">
              📥 {t('backup.importBtn')}
              <input
                type="file"
                accept=".json,application/json"
                onChange={handleImportBackup}
                className="hidden"
              />
            </label>
          </div>

          {backupStatusMessage && (
            <div className="p-2 bg-emerald-50 text-emerald-900 text-xs rounded border border-emerald-200">
              {backupStatusMessage}
            </div>
          )}
          {backupErrorMessage && (
            <div className="p-2 bg-rose-50 text-rose-900 text-xs rounded border border-rose-200">
              {backupErrorMessage}
            </div>
          )}
        </section>

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
