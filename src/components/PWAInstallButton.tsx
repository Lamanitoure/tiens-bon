import { useState } from 'react';
import { getLanguage } from '../i18n/index.ts';
import { usePWAInstall } from '../lib/usePWAInstall.ts';
import { DownloadIcon, XIcon } from './icons/index.ts';

export function PWAInstallButton() {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showGuide, setShowGuide] = useState(false);
  const lang = getLanguage();

  if (isInstalled) {
    return null;
  }

  const handleClick = async () => {
    if (isInstallable) {
      await install();
    } else {
      setShowGuide(true);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        className="btn-secondary !w-auto text-xs py-1.5 px-2.5 rounded-full font-semibold border-emerald-300 dark:border-emerald-700 bg-emerald-50/80 dark:bg-emerald-950/60 text-emerald-900 dark:text-emerald-200 flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
        aria-label={lang === 'fr' ? "Installer l'application" : 'Install App'}
      >
        <DownloadIcon className="w-3.5 h-3.5 shrink-0" />
        <span>{lang === 'fr' ? 'Installer' : 'Install'}</span>
      </button>

      {showGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-fade-in">
          <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 p-5 shadow-xl space-y-3 text-xs">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-stone-900 dark:text-stone-50 flex items-center gap-1.5">
                <DownloadIcon className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
                <span>
                  {lang === 'fr'
                    ? 'Installer Tiens Bon sur votre appareil'
                    : 'Install Tiens Bon on your device'}
                </span>
              </h3>
              <button
                type="button"
                onClick={() => setShowGuide(false)}
                className="p-1 rounded-lg hover:bg-stone-100 dark:hover:bg-stone-800 cursor-pointer"
                aria-label="Fermer"
              >
                <XIcon className="w-4 h-4" />
              </button>
            </div>

            {isIOS ? (
              <ol className="space-y-2 text-stone-700 dark:text-stone-300 list-decimal pl-4 leading-relaxed">
                <li>
                  {lang === 'fr' ? (
                    <>
                      Dans Safari, touchez l'icône <strong>Partager</strong> en bas de l'écran.
                    </>
                  ) : (
                    <>
                      In Safari, tap the <strong>Share</strong> button in the bottom toolbar.
                    </>
                  )}
                </li>
                <li>
                  {lang === 'fr' ? (
                    <>
                      Faites défiler et touchez <strong>Sur l'écran d'accueil</strong>.
                    </>
                  ) : (
                    <>
                      Scroll down and tap <strong>Add to Home Screen</strong>.
                    </>
                  )}
                </li>
              </ol>
            ) : (
              <ol className="space-y-2 text-stone-700 dark:text-stone-300 list-decimal pl-4 leading-relaxed">
                <li>
                  {lang === 'fr' ? (
                    <>
                      Sur <strong>Android (Chrome)</strong> : ouvrez le menu <strong>⋮</strong> en
                      haut à droite puis touchez <strong>Ajouter à l'écran d'accueil</strong> ou{' '}
                      <strong>Installer l'application</strong>.
                    </>
                  ) : (
                    <>
                      On <strong>Android (Chrome)</strong>: open the <strong>⋮</strong> menu and tap{' '}
                      <strong>Install app</strong> or <strong>Add to Home screen</strong>.
                    </>
                  )}
                </li>
                <li>
                  {lang === 'fr' ? (
                    <>
                      Sur <strong>Ordinateur (Chrome / Edge)</strong> : cliquez sur l'icône
                      d'installation à droite de la barre d'adresse.
                    </>
                  ) : (
                    <>
                      On <strong>Desktop (Chrome / Edge)</strong>: click the install icon on the
                      right side of the address bar.
                    </>
                  )}
                </li>
              </ol>
            )}

            <p className="text-[11px] text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 p-2.5 rounded-xl border border-emerald-200 dark:border-emerald-800">
              {lang === 'fr'
                ? "Une fois installée, l'application s'ouvre en plein écran et fonctionne 100 % hors-ligne."
                : 'Once installed, the app opens full-screen and works 100% offline.'}
            </p>

            <button
              type="button"
              onClick={() => setShowGuide(false)}
              className="btn-primary text-xs py-2.5 w-full cursor-pointer"
            >
              {lang === 'fr' ? 'Compris' : 'Got it'}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
