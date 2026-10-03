/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export default function App() {
  return (
    <main className="min-h-screen bg-stone-50 text-stone-900 flex flex-col items-center justify-center p-6 antialiased">
      <div className="w-full max-w-md bg-white rounded-2xl border border-stone-200 shadow-xs p-8 text-center space-y-6">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-emerald-100 text-emerald-800 text-2xl font-semibold">
          TB
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-bold tracking-tight text-stone-900">Tiens Bon</h1>
          <p className="text-sm text-stone-600 leading-relaxed">
            Compagnon local d'aide au sevrage tabagique, respectueux de votre voix et de votre vie
            privée.
          </p>
        </div>
        <div className="p-4 bg-stone-50 rounded-xl border border-stone-200/60 text-xs text-stone-500 text-left space-y-1">
          <div className="font-medium text-stone-700">Socle d'outillage initialisé :</div>
          <div>✓ TypeScript strict</div>
          <div>✓ Validation par schémas Zod</div>
          <div>✓ Tests unitaires Vitest</div>
          <div>✓ Linter et formateur Biome</div>
          <div>✓ Script de vérification de secrets & checkpoint</div>
        </div>
      </div>
    </main>
  );
}
