/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { type ChangeEvent, useCallback, useEffect, useState } from 'react';
import demoProfile from '../demo/profile.demo.json';
import { AppPinLockCard, AppPinUnlockOverlay } from './components/AppPinLock.tsx';
import { BlockPuzzle1010 } from './components/BlockPuzzle1010.tsx';
import { CravingSession } from './components/CravingSession.tsx';
import { FutureSelfMessages } from './components/FutureSelfMessages.tsx';
import {
  AlertTriangleIcon,
  BellIcon,
  BoltIcon,
  BookIcon,
  BotIcon,
  ClockIcon,
  CoinsIcon,
  DownloadIcon,
  FlagFrIcon,
  FlagGbIcon,
  GamepadIcon,
  HeartHandshakeIcon,
  LeafIcon,
  LockIcon,
  MessageCircleIcon,
  PenIcon,
  PhoneIcon,
  ShieldIcon,
  SparklesIcon,
  SunriseIcon,
  TargetIcon,
  UploadIcon,
  UserIcon,
  XIcon,
} from './components/icons/index.ts';
import { JournalView } from './components/JournalView.tsx';
import { PersonalGallery } from './components/PersonalGallery.tsx';
import { ProfileEditor } from './components/ProfileEditor.tsx';
import { RemindersManager } from './components/RemindersManager.tsx';
import { SourcedFacts } from './components/SourcedFacts.tsx';
import { WearableManager } from './components/WearableManager.tsx';
import { WeeklyRecap } from './components/WeeklyRecap.tsx';
import {
  addEvent,
  addImage,
  addSelfTalk,
  getAllEvents,
  getAllImages,
  getAllPlans,
  getAllPregenerated,
  getAllSelfTalk,
  getSettings,
  getStoredProfile,
  getUnusedPregenerated,
  resetDatabase,
  setStoredProfile,
} from './db/index.ts';
import { getLanguage, initLanguage, setLanguage, subscribeLanguage, t } from './i18n/index.ts';
import { checkModelStatus, generateMotivation, getStoredToken, setStoredToken } from './lib/api.ts';
import { activeConfig } from './lib/config.ts';
import { ensureDemoPregeneratedSeeded, isStaticDemoMode } from './lib/demo-mode.ts';
import { generateDailyBatch, shouldTriggerAutomaticBatch } from './lib/pregeneration.ts';
import {
  getScheduledReminders,
  type ScheduledReminder,
  sendLocalNotification,
} from './lib/reminders.ts';
import { computeUserStats, type UserStats } from './lib/stats.ts';
import { checkActiveTrigger, consumeActiveTrigger, detectUrlTrigger } from './lib/wearable.ts';
import type { EventRecord } from './schemas/events.ts';
import type { CravingOutput } from './schemas/model.ts';
import type { Plan } from './schemas/plans.ts';
import { type Profile, ProfileSchema } from './schemas/profile.ts';
import type { LockSettings } from './schemas/settings.ts';
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
  const [events, setEvents] = useState<EventRecord[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [stats, setStats] = useState<UserStats | null>(null);

  // Active navigation tab & progressive sub-sections
  const [activeTab, setActiveTab] = useState<'home' | 'journal' | 'game' | 'profile'>('home');
  const [homeDrawer, setHomeDrawer] = useState<'none' | 'pregen' | 'note'>('none');
  const [journalSubTab, setJournalSubTab] = useState<'entries' | 'recap' | 'backup'>('entries');
  const [profileSubTab, setProfileSubTab] = useState<
    'mantras' | 'photos' | 'reminders' | 'settings'
  >('mantras');

  // Active craving session state (Step 10)
  const [isCravingActive, setIsCravingActive] = useState(false);
  const [activeReminderBanner, setActiveReminderBanner] = useState<ScheduledReminder | null>(null);

  // Model connection & testing state
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

  // Offline Pregeneration state (Step 9)
  const [pregenCount, setPregenCount] = useState(0);
  const [isPregenerating, setIsPregenerating] = useState(false);
  const [pregenProgress, setPregenProgress] = useState<{ current: number; total: number } | null>(
    null,
  );
  const [pregenSuccessMessage, setPregenSuccessMessage] = useState<string | null>(null);

  // Optional App PIN Lock state (Step 19)
  const [lockSettings, setLockSettings] = useState<LockSettings | undefined>(undefined);
  const [isLocked, setIsLocked] = useState(false);
  const isDemo = isStaticDemoMode();

  const refreshEventsAndStats = useCallback(async (currentProfile: Profile | null) => {
    try {
      const allEvts = await getAllEvents();
      setEvents(allEvts);
      const allPlans = await getAllPlans();
      setPlans(allPlans);
      const unusedPregen = await getUnusedPregenerated();
      setPregenCount(unusedPregen.length);
      if (currentProfile) {
        setStats(computeUserStats(currentProfile, allEvts));
      }
    } catch (_err) {
      // ignore
    }
  }, []);

  useEffect(() => {
    initLanguage('fr');
    setCurrentLangState(getLanguage());
    const unsubscribe = subscribeLanguage((newLang) => {
      setCurrentLangState(newLang);
    });

    // Ensure default token is set if not already present
    if (!getStoredToken()) {
      setStoredToken('tiens-bon-token');
      setTokenInput('tiens-bon-token');
    }

    // Check if opened via home-screen shortcut (?craving=1 or #craving) (Step 10)
    try {
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get('craving') === '1' || window.location.hash === '#craving') {
        setIsCravingActive(true);
      }
    } catch {
      // ignore
    }

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

        // Load optional PIN lock settings (Step 19)
        const storedSettings = await getSettings();
        if (storedSettings?.lockSettings?.enabled) {
          setLockSettings(storedSettings.lockSettings);
          setIsLocked(true);
        }

        // Seed bundled Gemma messages if cache is empty (Step 20)
        await ensureDemoPregeneratedSeeded();
        await refreshEventsAndStats(current);

        // Check for automatic batch generation (older than 20 hours and model online)
        const storedTs = localStorage.getItem('tb_last_batch_ts');
        const lastBatchTs = storedTs ? Number(storedTs) : null;
        if (shouldTriggerAutomaticBatch(lastBatchTs)) {
          checkModelStatus()
            .then(async (status) => {
              if (status.ollama === 'ok' && current) {
                const batch = await generateDailyBatch(current);
                localStorage.setItem('tb_last_batch_ts', Date.now().toString());
                setPregenCount(batch.length);
              }
            })
            .catch(() => {});
        }
      } catch (_err) {
        const fallback = ProfileSchema.parse(demoProfile);
        setProfile(fallback);
        setStats(computeUserStats(fallback, []));
      }
    })();

    // Step 18: Smartwatch & wearable trigger detection
    if (detectUrlTrigger()) {
      setIsCravingActive(true);
    }

    const checkWearable = async () => {
      const res = await checkActiveTrigger();
      if (res.active) {
        await consumeActiveTrigger();
        setIsCravingActive(true);
      }
    };

    checkWearable();
    const wearableInterval = setInterval(checkWearable, 2500);

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        checkWearable();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      unsubscribe();
      clearInterval(wearableInterval);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [refreshEventsAndStats]);

  // Step 14: Automatic clock watcher that fires Gemma notifications at her scheduled riskWindows
  useEffect(() => {
    if (!profile) return;

    const checkScheduledTimes = async () => {
      const now = new Date();
      const hh = now.getHours().toString().padStart(2, '0');
      const mm = now.getMinutes().toString().padStart(2, '0');
      const currentHHMM = `${hh}:${mm}`;
      const todayKey = now.toISOString().slice(0, 10);

      const batch = await getAllPregenerated().catch(() => []);
      const leadTime = activeConfig.app.reminderLeadTimeMinutes ?? 10;
      const scheduled = getScheduledReminders(
        profile,
        leadTime,
        profile.discreetMode ?? true,
        batch,
      );

      for (const rem of scheduled) {
        if (currentHHMM === rem.reminderTime || currentHHMM === rem.riskTime) {
          const fireKey = `${todayKey}-${rem.riskWindowLabel}-${currentHHMM}`;
          if (localStorage.getItem('tb_last_fired_reminder') !== fireKey) {
            localStorage.setItem('tb_last_fired_reminder', fireKey);
            setActiveReminderBanner(rem);
            await sendLocalNotification({
              title: rem.notificationTitle,
              body: rem.notificationBody,
              tag: `tiens-bon-${rem.riskTime}`,
            });
          }
        }
      }
    };

    checkScheduledTimes();
    const timer = setInterval(checkScheduledTimes, 20000);
    return () => clearInterval(timer);
  }, [profile]);

  const handlePrepareDay = async () => {
    if (!profile || isPregenerating) return;
    setIsPregenerating(true);
    setPregenSuccessMessage(null);
    try {
      const generated = await generateDailyBatch(profile, (current, total) => {
        setPregenProgress({ current, total });
      });
      localStorage.setItem('tb_last_batch_ts', Date.now().toString());
      setPregenCount(generated.length);
      setPregenSuccessMessage(t('pregen.success'));
    } catch (_err) {
      // ignore
    } finally {
      setIsPregenerating(false);
      setPregenProgress(null);
    }
  };

  if (!activeConfig.isValid) {
    return (
      <main className="min-h-screen bg-stone-100 flex items-center justify-center p-6 text-stone-900">
        <div className="card max-w-md w-full border-red-200 bg-white p-6 space-y-4 shadow-sm">
          <div className="text-red-700 font-bold text-lg flex items-center gap-2">
            <AlertTriangleIcon className="w-5 h-5" />
            <span>{t('common.configError')}</span>
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

  // Delete everything handler (Section 5 Item 20)
  const handleDeleteAllData = async () => {
    try {
      await resetDatabase();
      localStorage.clear();
      if ('caches' in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      }
      if ('serviceWorker' in navigator) {
        const reg = await navigator.serviceWorker.getRegistration();
        const sub = await reg?.pushManager?.getSubscription();
        if (sub) {
          await sub.unsubscribe().catch(() => {});
        }
      }
      const token = getStoredToken();
      if (token) {
        await fetch('/api/data/clear', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        }).catch(() => {});
      }
    } catch {
      // ignore
    }
    const freshProfile = ProfileSchema.parse(demoProfile);
    await setStoredProfile(freshProfile);
    await ensureDemoPregeneratedSeeded();
    setProfile(freshProfile);
    setLockSettings({ enabled: false });
    setIsLocked(false);
    await refreshEventsAndStats(freshProfile);
  };

  if (isLocked && lockSettings?.enabled) {
    return (
      <AppPinUnlockOverlay
        lockSettings={lockSettings}
        onUnlocked={() => setIsLocked(false)}
        onResetAllData={handleDeleteAllData}
      />
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

  const handleNoteChange = (text: string) => {
    setUserInputNote(text);
    const distressCheck = checkDistress(text, lang);
    setDistressDetected(distressCheck.isDistress);
  };

  const handleTestGenerate = async () => {
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

  // Craving Flow: Log outcome event directly into IndexedDB (Step 10)
  const handleCravingLogged = async (
    type: 'resisted' | 'relapse',
    trigger?: string,
    note?: string,
  ) => {
    const newEvent: EventRecord = {
      id: `evt-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      ts: Date.now(),
      type,
      trigger: trigger || 'Craving session',
      note,
    };

    await addEvent(newEvent);
    await refreshEventsAndStats(profile);
  };

  // Web Crypto Encrypted Backup Export
  const handleExportBackup = async () => {
    setBackupErrorMessage(null);
    setBackupStatusMessage(null);

    if (!profile) return;
    if (!backupPassword || backupPassword.length < 6) {
      setBackupErrorMessage(t('backup.passwordPlaceholder'));
      return;
    }

    try {
      const allEvts = await getAllEvents();
      const allImgs = await getAllImages();
      const allTalks = await getAllSelfTalk();
      const backupData: BackupData = {
        profile,
        events: allEvts,
        images: allImgs,
        selftalk: allTalks,
        plans,
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

      await setStoredProfile(decrypted.profile);
      setProfile(decrypted.profile);
      if (decrypted.images && decrypted.images.length > 0) {
        for (const img of decrypted.images) {
          await addImage(img).catch(() => {});
        }
      }
      if (decrypted.selftalk && decrypted.selftalk.length > 0) {
        for (const st of decrypted.selftalk) {
          await addSelfTalk(st).catch(() => {});
        }
      }
      await refreshEventsAndStats(decrypted.profile);
      setBackupStatusMessage(t('backup.importSuccess'));
    } catch (err: unknown) {
      setBackupErrorMessage(err instanceof Error ? err.message : 'Invalid backup file or password');
    } finally {
      event.target.value = '';
    }
  };

  return (
    <div className="app-container space-y-4">
      {/* Top Header & Language Switch */}
      <header className="flex items-center justify-between py-3 border-b border-stone-200 dark:border-stone-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-emerald-800 text-white flex items-center justify-center font-bold text-sm shadow-sm">
            TB
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-stone-900 dark:text-stone-50 leading-none">
              Tiens Bon
            </h1>
            <span className="text-[11px] text-stone-500 dark:text-stone-400 font-medium">
              v0.1.0 • {t('app.tagline')}
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={toggleLanguage}
          className="btn-secondary !w-auto text-xs py-1.5 px-3 rounded-full font-semibold border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-800 dark:text-stone-100 flex items-center gap-1.5"
          aria-label="Switch language"
        >
          {lang === 'fr' ? (
            <>
              <FlagGbIcon className="w-4 h-3" />
              <span>English</span>
            </>
          ) : (
            <>
              <FlagFrIcon className="w-4 h-3" />
              <span>Français</span>
            </>
          )}
        </button>
      </header>

      {/* Navigation Tabs */}
      <nav className="bg-stone-200/80 dark:bg-stone-800/80 p-1.5 rounded-2xl grid grid-cols-4 gap-1 border border-stone-300/40 dark:border-stone-700/60 shadow-xs">
        <button
          type="button"
          onClick={() => setActiveTab('home')}
          className={`py-2.5 px-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer min-h-[44px] whitespace-nowrap truncate ${
            activeTab === 'home'
              ? 'bg-white dark:bg-stone-900 text-emerald-800 dark:text-emerald-400 shadow-xs'
              : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200'
          }`}
        >
          <BoltIcon className="w-4 h-4 shrink-0" />
          <span className="truncate">{t('nav.home')}</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('journal')}
          className={`py-2.5 px-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer min-h-[44px] whitespace-nowrap truncate ${
            activeTab === 'journal'
              ? 'bg-white dark:bg-stone-900 text-emerald-800 dark:text-emerald-400 shadow-xs'
              : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200'
          }`}
        >
          <BookIcon className="w-4 h-4 shrink-0" />
          <span className="truncate">{t('nav.journal')}</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('game')}
          className={`py-2.5 px-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer min-h-[44px] whitespace-nowrap truncate ${
            activeTab === 'game'
              ? 'bg-white dark:bg-stone-900 text-emerald-800 dark:text-emerald-400 shadow-xs'
              : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200'
          }`}
        >
          <GamepadIcon className="w-4 h-4 shrink-0" />
          <span className="truncate">{t('nav.game')}</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('profile')}
          className={`py-2.5 px-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer min-h-[44px] whitespace-nowrap truncate ${
            activeTab === 'profile'
              ? 'bg-white dark:bg-stone-900 text-emerald-800 dark:text-emerald-400 shadow-xs'
              : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200'
          }`}
        >
          <UserIcon className="w-4 h-4 shrink-0" />
          <span className="truncate">{t('nav.profile')}</span>
        </button>
      </nav>

      {/* Main Content Area */}
      <main className="flex-1 py-2 space-y-5">
        {/* Bundled Gemma Demo Banner (Step 20) */}
        <div className="px-3.5 py-2 rounded-xl bg-emerald-50/90 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800/80 text-[11px] text-emerald-900 dark:text-emerald-200 flex items-center gap-2 font-medium">
          <SparklesIcon className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
          <span>{t('demo.bundledBanner')}</span>
        </div>

        {/* Active Scheduled Gemma Reminder Banner (Step 14) */}
        {activeReminderBanner && (
          <div className="card p-4 bg-emerald-50/90 dark:bg-emerald-950/70 border-2 border-emerald-400 dark:border-emerald-700 space-y-2.5 animate-fade-in">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs font-bold text-emerald-950 dark:text-emerald-200">
                <BellIcon className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
                <span>
                  {activeReminderBanner.riskWindowLabel} ({activeReminderBanner.riskTime})
                </span>
              </div>
              <button
                type="button"
                onClick={() => setActiveReminderBanner(null)}
                className="p-1 rounded-lg hover:bg-emerald-200/60 dark:hover:bg-emerald-900 cursor-pointer"
                aria-label="Fermer le rappel"
              >
                <XIcon className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs italic text-stone-800 dark:text-stone-200 border-l-2 border-emerald-700 dark:border-emerald-400 pl-2.5">
              « {activeReminderBanner.fullMessage} »
            </p>

            <div className="flex items-center justify-between gap-2 pt-1">
              <span className="text-[11px] text-emerald-900 dark:text-emerald-300 font-medium truncate">
                Alternative : <strong>{activeReminderBanner.alternative}</strong>
              </span>
              <button
                type="button"
                onClick={() => {
                  setActiveReminderBanner(null);
                  setActiveTab('home');
                  setIsCravingActive(true);
                }}
                className="btn-primary !w-auto text-xs py-1.5 px-3 shrink-0 cursor-pointer whitespace-nowrap"
              >
                Lancer 3 min
              </button>
            </div>
          </div>
        )}

        {/* Immediate Distress Alert Banner */}
        {distressDetected && profile && (
          <div className="p-4 bg-rose-50 dark:bg-rose-950/70 border-2 border-rose-300 dark:border-rose-800 rounded-2xl space-y-3 shadow-sm">
            <div className="flex items-center gap-2 text-rose-900 dark:text-rose-200 font-bold text-sm">
              <HeartHandshakeIcon className="w-5 h-5" />
              <span>{t('distress.alert')}</span>
            </div>
            <p className="text-xs text-rose-800 dark:text-rose-300 leading-relaxed">
              {t('distress.message')}
            </p>
            <div className="space-y-2 pt-1">
              <a
                href={`tel:${profile.helpline.contact}`}
                className="btn-primary !bg-rose-800 hover:!bg-rose-900 text-xs py-2.5 flex items-center justify-center gap-2"
              >
                <PhoneIcon className="w-4 h-4" />
                <span>
                  {profile.helpline.label} ({profile.helpline.contact})
                </span>
              </a>
              {profile.supportPerson && (
                <a
                  href={`tel:${profile.supportPerson.contact}`}
                  className="btn-secondary text-xs py-2 flex items-center justify-center gap-2 border-rose-200 dark:border-rose-900 text-rose-900 dark:text-rose-200"
                >
                  <MessageCircleIcon className="w-4 h-4" />
                  <span>
                    {profile.supportPerson.label} ({profile.supportPerson.contact})
                  </span>
                </a>
              )}
            </div>
          </div>
        )}

        {/* TAB 1: ACCUEIL */}
        {activeTab === 'home' && (
          <div key="tab-home" className="space-y-4 stagger-reveal">
            {/* Live Counters & Stats Card (Step 7) */}
            {stats && profile && (
              <section className="grid grid-cols-2 gap-3">
                <div className="card p-4 space-y-1">
                  <div className="text-[11px] font-semibold text-stone-500 dark:text-stone-400">
                    {t('counters.streak')}
                  </div>
                  <div className="text-2xl font-bold font-mono tabular-nums text-emerald-800 dark:text-emerald-400">
                    {stats.streakDays > 0 ? (
                      <span>
                        {stats.streakDays} {t('counters.days')}
                      </span>
                    ) : (
                      <span>
                        {stats.streakHours} {t('counters.hours')}
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-stone-500 dark:text-stone-400 tabular-nums">
                    {t('counters.bestStreak')}: {stats.bestStreakDays} {t('counters.days')}
                  </div>
                </div>

                <div className="card p-4 space-y-1">
                  <div className="text-[11px] font-semibold text-stone-500 dark:text-stone-400">
                    {t('counters.avoided')}
                  </div>
                  <div className="text-2xl font-bold font-mono tabular-nums text-emerald-800 dark:text-emerald-400">
                    {stats.avoidedCigarettes}
                  </div>
                  <div className="text-[11px] text-stone-500 dark:text-stone-400 tabular-nums">
                    {stats.resistedCount} {t('craving.resisted').toLowerCase()}
                  </div>
                </div>

                {/* Savings Goal Card */}
                <div className="col-span-2 card p-4 space-y-2 bg-emerald-50/70 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-emerald-950 dark:text-emerald-200 flex items-center gap-1.5">
                      <CoinsIcon className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
                      <span>{profile.savingsGoal.label}</span>
                    </span>
                    <span className="font-semibold font-mono tabular-nums text-emerald-900 dark:text-emerald-300">
                      {stats.moneySaved} {profile.currency} / {profile.savingsGoal.amount}{' '}
                      {profile.currency}
                    </span>
                  </div>
                  <div className="w-full bg-emerald-200/70 dark:bg-emerald-900 rounded-full h-2.5 overflow-hidden">
                    <div
                      className="bg-emerald-700 dark:bg-emerald-400 h-2.5 rounded-full transition-all duration-700"
                      style={{ width: `${stats.savingsGoalProgress}%` }}
                    />
                  </div>
                </div>
              </section>
            )}

            {/* Instant Craving Button OR Active Craving Session Modal (Step 10) */}
            {profile && isCravingActive ? (
              <CravingSession
                profile={profile}
                onClose={() => setIsCravingActive(false)}
                onLogged={handleCravingLogged}
              />
            ) : (
              <div className="card text-center p-6 space-y-4 bg-gradient-to-br from-emerald-800 to-emerald-900 text-white border-none shadow-lg">
                <div className="space-y-1">
                  <h2 className="text-xl font-bold">{t('craving.holdOn')}</h2>
                  <p className="text-xs text-emerald-100/90 leading-relaxed">{t('app.tagline')}</p>
                </div>

                <button
                  type="button"
                  onClick={() => setIsCravingActive(true)}
                  className="w-full py-4 px-6 rounded-2xl bg-white text-emerald-950 font-extrabold text-base shadow-md hover:bg-emerald-50 active:scale-[0.98] transition-all cursor-pointer min-h-[52px] flex items-center justify-center gap-2"
                >
                  <BoltIcon className="w-5 h-5" />
                  <span>{t('craving.button')} (3 min)</span>
                </button>
              </div>
            )}

            {/* Sourced Health Facts (Step 17 v2) */}
            <SourcedFacts />

            {/* Progressive Action Pills for Offline Day Prep & Express Note */}
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setHomeDrawer(homeDrawer === 'pregen' ? 'none' : 'pregen')}
                className={`py-2.5 px-3 rounded-xl text-xs font-semibold border transition-all cursor-pointer flex items-center justify-center gap-1.5 min-h-[44px] whitespace-nowrap truncate ${
                  homeDrawer === 'pregen' || isPregenerating
                    ? 'bg-emerald-800 text-white border-emerald-800 shadow-xs'
                    : 'bg-white dark:bg-stone-900 text-stone-700 dark:text-stone-200 border-stone-200 dark:border-stone-800 hover:border-emerald-400'
                }`}
              >
                <SunriseIcon className="w-4 h-4 shrink-0" />
                <span className="truncate">
                  {t('pregen.title')} ({pregenCount})
                </span>
              </button>

              <button
                type="button"
                onClick={() => setHomeDrawer(homeDrawer === 'note' ? 'none' : 'note')}
                className={`py-2.5 px-3 rounded-xl text-xs font-semibold border transition-all cursor-pointer flex items-center justify-center gap-1.5 min-h-[44px] whitespace-nowrap truncate ${
                  homeDrawer === 'note' || userInputNote
                    ? 'bg-emerald-800 text-white border-emerald-800 shadow-xs'
                    : 'bg-white dark:bg-stone-900 text-stone-700 dark:text-stone-200 border-stone-200 dark:border-stone-800 hover:border-emerald-400'
                }`}
              >
                <PenIcon className="w-4 h-4 shrink-0" />
                <span className="truncate">
                  {lang === 'fr' ? 'Exprimer mon ressenti' : 'Express how I feel'}
                </span>
              </button>
            </div>

            {/* Progressive Drawer 1: Offline Batch Pregeneration Card (Step 9) */}
            {profile &&
              (homeDrawer === 'pregen' || isPregenerating || Boolean(pregenSuccessMessage)) && (
                <section className="card space-y-3.5 border-emerald-200 dark:border-emerald-800 bg-emerald-50/40 dark:bg-emerald-950/20 p-4 animate-fade-in">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold text-emerald-950 dark:text-emerald-200 flex items-center gap-1.5">
                      <SunriseIcon className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
                      <span>{t('pregen.title')}</span>
                    </h3>
                    <span className="text-[11px] font-mono tabular-nums text-emerald-800 dark:text-emerald-300">
                      {pregenCount} {t('pregen.cacheStatus')}
                    </span>
                  </div>

                  <p className="text-xs text-stone-600 dark:text-stone-300 leading-relaxed">
                    {t('pregen.desc')}
                  </p>

                  {isPregenerating && pregenProgress && (
                    <div className="space-y-1.5">
                      <div className="text-[11px] font-medium text-emerald-900 dark:text-emerald-300">
                        {t('pregen.generating', {
                          current: pregenProgress.current.toString(),
                          total: pregenProgress.total.toString(),
                        })}
                      </div>
                      <div className="w-full bg-emerald-200 dark:bg-emerald-900 rounded-full h-2 overflow-hidden">
                        <div
                          className="bg-emerald-800 dark:bg-emerald-400 h-2 rounded-full transition-all duration-300"
                          style={{
                            width: `${Math.round((pregenProgress.current / pregenProgress.total) * 100)}%`,
                          }}
                        />
                      </div>
                    </div>
                  )}

                  {pregenSuccessMessage && (
                    <div className="p-2.5 bg-white dark:bg-stone-900 text-emerald-900 dark:text-emerald-300 text-xs rounded-lg border border-emerald-300 dark:border-emerald-700 font-medium">
                      {pregenSuccessMessage}
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={handlePrepareDay}
                    disabled={isPregenerating}
                    className="btn-primary text-xs py-3 w-full flex justify-center items-center gap-2 cursor-pointer disabled:opacity-50 min-h-[44px]"
                  >
                    <BoltIcon className="w-4 h-4" />
                    <span>{t('pregen.button')}</span>
                  </button>
                </section>
              )}

            {/* Progressive Drawer 2: Quick Note & Test Prompt Section */}
            {(homeDrawer === 'note' || Boolean(userInputNote) || Boolean(generatedResult)) && (
              <section className="card space-y-4 animate-fade-in">
                <h3 className="text-sm font-bold text-stone-900 dark:text-stone-50 flex items-center gap-2">
                  <PenIcon className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
                  <span>Qu'est-ce qui se passe maintenant ?</span>
                </h3>

                <div className="space-y-1.5">
                  <input
                    type="text"
                    value={userInputNote}
                    onChange={(e) => handleNoteChange(e.target.value)}
                    placeholder="Ex: envie après le repas, pause café..."
                    className="w-full px-3 py-2.5 text-xs rounded-lg border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-900 dark:text-stone-100 focus:bg-white dark:focus:bg-stone-900"
                  />
                  <p className="text-[11px] text-stone-500 dark:text-stone-400">
                    Tapez vos ressentis. Si un mot de détresse est détecté, l'aide s'affiche
                    immédiatement.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleTestGenerate}
                  disabled={isGenerating || distressDetected}
                  className="btn-primary text-xs py-3 w-full flex justify-center items-center gap-2 cursor-pointer disabled:opacity-50 min-h-[44px]"
                >
                  {isGenerating ? t('model.generating') : t('model.generateTest')}
                </button>

                {generationError && (
                  <div className="p-3 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 rounded-lg text-xs text-rose-800 dark:text-rose-200 flex items-center gap-1.5">
                    <XIcon className="w-4 h-4 shrink-0" />
                    <span>{generationError}</span>
                  </div>
                )}

                {generatedResult && (
                  <div className="p-4 bg-emerald-50/70 dark:bg-emerald-950/40 border border-emerald-200/80 dark:border-emerald-800 rounded-xl space-y-3 animate-fade-in">
                    <div>
                      <div className="text-[11px] font-bold text-emerald-900 dark:text-emerald-300">
                        {t('model.challengeLabel')}
                      </div>
                      <p className="text-xs font-semibold text-stone-800 dark:text-stone-200 mt-0.5">
                        {generatedResult.challenge}
                      </p>
                    </div>
                    <div>
                      <div className="text-[11px] font-bold text-emerald-900 dark:text-emerald-300">
                        {t('model.messageLabel')}
                      </div>
                      <p className="text-xs text-stone-700 dark:text-stone-300 italic mt-0.5">
                        « {generatedResult.message} »
                      </p>
                    </div>
                    {wasSafetyFiltered && (
                      <div className="p-2 bg-stone-100 dark:bg-stone-800 rounded text-[11px] text-stone-600 dark:text-stone-300 italic flex items-center gap-1.5">
                        <ShieldIcon className="w-3.5 h-3.5 shrink-0" />
                        <span>{t('safety.filtered')}</span>
                      </div>
                    )}
                  </div>
                )}
              </section>
            )}
          </div>
        )}

        {/* TAB 2: JOURNAL & ÉVÉNEMENTS (Progressive Sub-Navigation) */}
        {activeTab === 'journal' && profile && (
          <div key="tab-journal" className="space-y-4 stagger-reveal">
            {/* Segmented Sub-Navigation for Journal */}
            <div className="flex items-center gap-1 p-1 bg-stone-200/70 dark:bg-stone-800/70 rounded-xl border border-stone-300/40 dark:border-stone-700/50">
              <button
                type="button"
                onClick={() => setJournalSubTab('entries')}
                className={`flex-1 py-2 px-2.5 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap truncate min-h-[38px] ${
                  journalSubTab === 'entries'
                    ? 'bg-white dark:bg-stone-900 text-emerald-800 dark:text-emerald-400 shadow-2xs'
                    : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200'
                }`}
              >
                {lang === 'fr' ? 'Carnet & Bilan' : 'Journal & Check-in'}
              </button>
              <button
                type="button"
                onClick={() => setJournalSubTab('recap')}
                className={`flex-1 py-2 px-2.5 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap truncate min-h-[38px] ${
                  journalSubTab === 'recap'
                    ? 'bg-white dark:bg-stone-900 text-emerald-800 dark:text-emerald-400 shadow-2xs'
                    : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200'
                }`}
              >
                {lang === 'fr' ? 'Semaine' : 'Weekly Recap'}
              </button>
              <button
                type="button"
                onClick={() => setJournalSubTab('backup')}
                className={`flex-1 py-2 px-2.5 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap truncate min-h-[38px] ${
                  journalSubTab === 'backup'
                    ? 'bg-white dark:bg-stone-900 text-emerald-800 dark:text-emerald-400 shadow-2xs'
                    : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200'
                }`}
              >
                {lang === 'fr' ? 'Sauvegarde' : 'Backup'}
              </button>
            </div>

            {journalSubTab === 'entries' && (
              <div key="journal-entries" className="stagger-reveal space-y-4">
                <JournalView
                  profile={profile}
                  events={events}
                  onEventAdded={() => refreshEventsAndStats(profile)}
                />
              </div>
            )}

            {journalSubTab === 'recap' && (
              <div key="journal-recap" className="stagger-reveal space-y-4">
                <WeeklyRecap
                  events={events}
                  profile={profile}
                  onProfileUpdated={(updated) => setProfile(updated)}
                />
              </div>
            )}

            {journalSubTab === 'backup' && (
              <div key="journal-backup" className="stagger-reveal space-y-4">
                <section className="card space-y-3">
                  <h4 className="text-xs font-bold text-stone-900 dark:text-stone-50 flex items-center gap-1.5">
                    <LockIcon className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
                    <span>{t('backup.title')}</span>
                  </h4>
                  <p className="text-[11px] text-stone-500 dark:text-stone-400 leading-normal">
                    {t('backup.description')}
                  </p>

                  <input
                    type="password"
                    value={backupPassword}
                    onChange={(e) => setBackupPassword(e.target.value)}
                    placeholder={t('backup.passwordPlaceholder')}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-900 dark:text-stone-100 focus:bg-white dark:focus:bg-stone-900"
                  />

                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <button
                      type="button"
                      onClick={handleExportBackup}
                      className="btn-secondary text-xs py-2 min-h-[40px] flex items-center justify-center gap-1.5"
                    >
                      <UploadIcon className="w-3.5 h-3.5" />
                      <span>{t('backup.exportBtn')}</span>
                    </button>

                    <label className="btn-secondary text-xs py-2 cursor-pointer text-center truncate min-h-[40px] flex items-center justify-center gap-1.5">
                      <DownloadIcon className="w-3.5 h-3.5" />
                      <span>{t('backup.importBtn')}</span>
                      <input
                        type="file"
                        accept=".json,application/json"
                        onChange={handleImportBackup}
                        className="hidden"
                      />
                    </label>
                  </div>

                  {backupStatusMessage && (
                    <div className="p-2 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-900 dark:text-emerald-200 text-xs rounded border border-emerald-200 dark:border-emerald-800">
                      {backupStatusMessage}
                    </div>
                  )}
                  {backupErrorMessage && (
                    <div className="p-2 bg-rose-50 dark:bg-rose-950/60 text-rose-900 dark:text-rose-200 text-xs rounded border border-rose-200 dark:border-rose-800">
                      {backupErrorMessage}
                    </div>
                  )}
                </section>
              </div>
            )}
          </div>
        )}

        {/* TAB: JEU 1010 (Dedicated Navbar Tab) */}
        {activeTab === 'game' && (
          <div key="tab-game" className="space-y-4 stagger-reveal">
            <section className="card p-4 bg-emerald-50/60 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800/80 space-y-2">
              <h2 className="text-sm font-bold text-emerald-950 dark:text-emerald-200 flex items-center gap-2">
                <GamepadIcon className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
                <span>{t('game1010.title')}</span>
              </h2>
              <p className="text-xs text-stone-600 dark:text-stone-300 leading-relaxed">
                {t('game1010.subtitle')}
              </p>
            </section>

            <BlockPuzzle1010 />
          </div>
        )}

        {/* TAB 3: PROFIL & MANTRAS (Progressive Sub-Navigation) */}
        {activeTab === 'profile' && profile && (
          <div key="tab-profile" className="space-y-4 stagger-reveal">
            {/* Segmented Sub-Navigation for Profile (4 progressive sections instead of 11 cards at once) */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1 p-1 bg-stone-200/70 dark:bg-stone-800/70 rounded-xl border border-stone-300/40 dark:border-stone-700/50">
              <button
                type="button"
                onClick={() => setProfileSubTab('mantras')}
                className={`py-2 px-2 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap truncate min-h-[38px] ${
                  profileSubTab === 'mantras'
                    ? 'bg-white dark:bg-stone-900 text-emerald-800 dark:text-emerald-400 shadow-2xs'
                    : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200'
                }`}
              >
                {lang === 'fr' ? 'Ma Voix & Plans' : 'My Voice & Plans'}
              </button>
              <button
                type="button"
                onClick={() => setProfileSubTab('photos')}
                className={`py-2 px-2 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap truncate min-h-[38px] ${
                  profileSubTab === 'photos'
                    ? 'bg-white dark:bg-stone-900 text-emerald-800 dark:text-emerald-400 shadow-2xs'
                    : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200'
                }`}
              >
                {lang === 'fr' ? 'Photos' : 'Photos'}
              </button>
              <button
                type="button"
                onClick={() => setProfileSubTab('reminders')}
                className={`py-2 px-2 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap truncate min-h-[38px] ${
                  profileSubTab === 'reminders'
                    ? 'bg-white dark:bg-stone-900 text-emerald-800 dark:text-emerald-400 shadow-2xs'
                    : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200'
                }`}
              >
                {lang === 'fr' ? 'Rappels & Montre' : 'Reminders & Watch'}
              </button>
              <button
                type="button"
                onClick={() => setProfileSubTab('settings')}
                className={`py-2 px-2 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap truncate min-h-[38px] ${
                  profileSubTab === 'settings'
                    ? 'bg-white dark:bg-stone-900 text-emerald-800 dark:text-emerald-400 shadow-2xs'
                    : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200'
                }`}
              >
                {lang === 'fr' ? 'Réglages & PIN' : 'Settings & PIN'}
              </button>
            </div>

            {/* SUB-TAB 1: MA VOIX, MOTIVATIONS & PLANS */}
            {profileSubTab === 'mantras' && (
              <div key="profile-mantras" className="space-y-4 stagger-reveal">
                {/* Demo Profile Badge */}
                <div className="card bg-emerald-50/50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800/80 p-3.5 flex items-start gap-3">
                  <LeafIcon className="w-5 h-5 text-emerald-700 dark:text-emerald-400 mt-0.5" />
                  <div className="space-y-0.5">
                    <div className="text-xs font-bold text-emerald-950 dark:text-emerald-200">
                      {t('demo.badge')}
                    </div>
                    <div className="text-xs text-stone-600 dark:text-stone-300">
                      {t('demo.description')}
                    </div>
                  </div>
                </div>

                {/* Reasons */}
                <div className="card space-y-3">
                  <h4 className="text-sm font-bold text-stone-900 dark:text-stone-50 flex items-center gap-2">
                    <TargetIcon className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
                    <span>{t('profile.reasons')}</span>
                  </h4>
                  <ul className="text-xs text-stone-700 dark:text-stone-200 space-y-2 pl-5 list-disc marker:text-emerald-700 dark:marker:text-emerald-400">
                    {profile.reasons.map((reason) => (
                      <li key={reason} className="leading-relaxed">
                        {reason}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Phrases in her voice */}
                <div className="card space-y-3">
                  <h4 className="text-sm font-bold text-stone-900 dark:text-stone-50 flex items-center gap-2">
                    <MessageCircleIcon className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
                    <span>{t('profile.phrases')}</span>
                  </h4>
                  <div className="space-y-2">
                    {profile.phrases.slice(0, 5).map((phrase) => (
                      <blockquote
                        key={phrase}
                        className="italic text-xs text-stone-700 dark:text-stone-200 border-l-2 border-emerald-700 dark:border-emerald-400 pl-3 py-1 bg-stone-50/50 dark:bg-stone-800/40 rounded-r-lg"
                      >
                        « {phrase} »
                      </blockquote>
                    ))}
                  </div>
                </div>

                {/* Plans */}
                {plans.length > 0 && (
                  <div className="card space-y-3 border-emerald-200/70 dark:border-emerald-800 bg-emerald-50/30 dark:bg-emerald-950/20">
                    <h4 className="text-sm font-bold text-emerald-950 dark:text-emerald-200 flex items-center gap-2">
                      <ShieldIcon className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
                      <span>{t('profile.myPlans')}</span>
                    </h4>
                    <div className="space-y-2">
                      {plans.map((p) => (
                        <div
                          key={p.id}
                          className="p-3 bg-white dark:bg-stone-900 rounded-xl border border-emerald-200/60 dark:border-emerald-800 text-xs space-y-1"
                        >
                          <div className="text-stone-700 dark:text-stone-300 font-medium">
                            <span className="font-bold text-emerald-900 dark:text-emerald-400">
                              Si :
                            </span>{' '}
                            {p.ifText}
                          </div>
                          <div className="text-emerald-950 dark:text-emerald-200 font-semibold">
                            <span className="font-bold text-emerald-900 dark:text-emerald-400">
                              Alors :
                            </span>{' '}
                            {p.thenText}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Messages to future self (Step 13) */}
                <FutureSelfMessages />
              </div>
            )}

            {/* SUB-TAB 2: GALERIE PHOTOS RESSOURCES */}
            {profileSubTab === 'photos' && (
              <div key="profile-photos" className="space-y-4 stagger-reveal">
                <PersonalGallery />
              </div>
            )}

            {/* SUB-TAB 3: RAPPELS, FENÊTRES À RISQUE & MONTRE */}
            {profileSubTab === 'reminders' && (
              <div key="profile-reminders" className="space-y-4 stagger-reveal">
                {/* Risk Windows */}
                <div className="card space-y-3">
                  <h4 className="text-sm font-bold text-stone-900 dark:text-stone-50 flex items-center gap-2">
                    <ClockIcon className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
                    <span>{t('profile.riskWindows')}</span>
                  </h4>
                  <div className="grid grid-cols-2 gap-2">
                    {profile.riskWindows.map((rw) => (
                      <div
                        key={rw.label}
                        className="p-3 bg-stone-50 dark:bg-stone-800 rounded-xl border border-stone-200 dark:border-stone-700 text-xs space-y-0.5"
                      >
                        <div className="font-bold font-mono tabular-nums text-emerald-800 dark:text-emerald-400">
                          {rw.time}
                        </div>
                        <div className="text-stone-700 dark:text-stone-300 truncate font-medium">
                          {rw.label}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Reminders before Risk Moments & Discreet Mode (Step 14) */}
                <RemindersManager
                  profile={profile}
                  onProfileUpdated={(updated) => setProfile(updated)}
                  onTriggerReminderBanner={(rem) => setActiveReminderBanner(rem)}
                />

                {/* Smartwatch & Wearable Trigger Webhook (Step 18) */}
                <WearableManager onTriggered={() => setIsCravingActive(true)} />
              </div>
            )}

            {/* SUB-TAB 4: RÉGLAGES, CODE PIN, MODÈLE LOCAL & SUPPRESSION */}
            {profileSubTab === 'settings' && (
              <div key="profile-settings" className="space-y-4 stagger-reveal">
                {/* Personal Profile Editor & Delete Everything (Step 6 & Item 20) */}
                <ProfileEditor
                  profile={profile}
                  onProfileUpdated={(updated) => {
                    setProfile(updated);
                    refreshEventsAndStats(updated);
                  }}
                  onDeleteAll={handleDeleteAllData}
                />

                {/* Optional App PIN Lock (Step 19) */}
                <AppPinLockCard
                  lockSettings={lockSettings}
                  onLockSettingsChanged={(next) => setLockSettings(next)}
                  onLockNow={() => setIsLocked(true)}
                />

                {/* Model Connection Settings Card (hidden in static demo mode) */}
                {!isDemo && (
                  <section className="card space-y-3 border-stone-200 dark:border-stone-700">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold text-stone-800 dark:text-stone-200 flex items-center gap-1.5">
                        <BotIcon className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
                        <span>{t('model.title')}</span>
                      </h4>
                      <span className="text-xs font-mono text-emerald-800 dark:text-emerald-400">
                        gemma2:2b
                      </span>
                    </div>

                    <div className="flex gap-2">
                      <input
                        type="password"
                        value={tokenInput}
                        onChange={(e) => setTokenInput(e.target.value)}
                        placeholder={t('model.tokenPlaceholder')}
                        className="flex-1 px-3 py-2 text-xs rounded-lg border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-900 dark:text-stone-100 focus:bg-white dark:focus:bg-stone-900"
                      />
                      <button
                        type="button"
                        onClick={handleSaveToken}
                        className="btn-secondary !w-auto text-xs py-2 px-3 shrink-0 min-h-[38px]"
                      >
                        {t('model.saveToken')}
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={handleCheckModelStatus}
                      disabled={isCheckingStatus}
                      className="btn-secondary text-xs py-2.5 w-full flex justify-center items-center gap-2 min-h-[40px]"
                    >
                      {isCheckingStatus ? t('common.loading') : t('model.checkStatus')}
                    </button>

                    {modelStatus && (
                      <div className="p-2.5 bg-stone-50 dark:bg-stone-800 rounded-lg border border-stone-200 dark:border-stone-700 text-xs text-stone-800 dark:text-stone-200 font-medium animate-fade-in">
                        {modelStatus}
                      </div>
                    )}
                  </section>
                )}

                {/* Emergency & Support Contacts */}
                <div className="card space-y-2.5 bg-stone-50 dark:bg-stone-800/60 border-stone-200 dark:border-stone-700">
                  <h4 className="text-xs font-bold text-stone-800 dark:text-stone-200 flex items-center gap-1.5">
                    <PhoneIcon className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
                    <span>{t('profile.helpline')}</span>
                  </h4>
                  <div className="text-sm font-bold text-stone-900 dark:text-stone-100">
                    {profile.helpline.label} :{' '}
                    <span className="text-emerald-800 dark:text-emerald-400 font-extrabold tabular-nums">
                      {profile.helpline.contact}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Mandatory Medical Disclaimer Footer */}
      <footer className="pt-3 pb-2 border-t border-stone-200 dark:border-stone-800 text-center space-y-1">
        <p className="text-[11px] text-stone-500 dark:text-stone-400 leading-tight">
          {t('disclaimer.medical')}
        </p>
        <p className="text-[11px] text-stone-500 dark:text-stone-400 leading-tight">
          {t('disclaimer.doctor')}
        </p>
      </footer>
    </div>
  );
}
