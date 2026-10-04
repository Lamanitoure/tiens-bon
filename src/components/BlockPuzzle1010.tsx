import { useEffect, useState } from 'react';
import { t } from '../i18n/index.ts';
import {
  applyZenBreathingSpace,
  type BoardGrid,
  canAnyTrayPieceFit,
  canPlacePiece,
  createEmptyBoard,
  dealTray,
  type Game1010Settings,
  type GameMode,
  type GameThemeId,
  type GridSize,
  loadBestScore,
  loadGame1010Settings,
  type PieceShape,
  placePieceOnBoard,
  rotatePieceClockwise,
  saveBestScore,
  saveGame1010Settings,
} from '../lib/game1010.ts';
import { GamepadIcon, RefreshIcon, SparklesIcon } from './icons/index.ts';

interface BlockPuzzle1010Props {
  forceDiscreet?: boolean;
  compact?: boolean;
}

const THEME_PALETTES: Record<
  GameThemeId,
  {
    emptyCell: string;
    boardBg: string;
    colors: Record<number, string>;
    previewValid: string;
    previewInvalid: string;
  }
> = {
  emerald: {
    emptyCell: 'bg-stone-200/80 dark:bg-stone-800/90',
    boardBg: 'bg-stone-100 dark:bg-stone-900 border-stone-300 dark:border-stone-700',
    colors: {
      1: 'bg-emerald-500 text-white',
      2: 'bg-teal-600 text-white',
      3: 'bg-emerald-700 text-white',
      4: 'bg-cyan-700 text-white',
      5: 'bg-amber-500 text-white',
    },
    previewValid: 'ring-2 ring-emerald-500 bg-emerald-300/60 dark:bg-emerald-600/50',
    previewInvalid: 'ring-2 ring-rose-400 bg-rose-300/40 dark:bg-rose-800/40',
  },
  amber: {
    emptyCell: 'bg-stone-200/80 dark:bg-stone-800/90',
    boardBg: 'bg-amber-50/60 dark:bg-stone-900 border-amber-200 dark:border-stone-700',
    colors: {
      1: 'bg-amber-500 text-white',
      2: 'bg-orange-500 text-white',
      3: 'bg-yellow-600 text-white',
      4: 'bg-amber-700 text-white',
      5: 'bg-stone-700 text-white',
    },
    previewValid: 'ring-2 ring-amber-500 bg-amber-300/60 dark:bg-amber-600/50',
    previewInvalid: 'ring-2 ring-rose-400 bg-rose-300/40 dark:bg-rose-800/40',
  },
  ocean: {
    emptyCell: 'bg-slate-200/80 dark:bg-slate-800/90',
    boardBg: 'bg-slate-100 dark:bg-slate-900 border-slate-300 dark:border-slate-700',
    colors: {
      1: 'bg-sky-500 text-white',
      2: 'bg-blue-600 text-white',
      3: 'bg-indigo-600 text-white',
      4: 'bg-cyan-600 text-white',
      5: 'bg-teal-500 text-white',
    },
    previewValid: 'ring-2 ring-sky-500 bg-sky-300/60 dark:bg-sky-600/50',
    previewInvalid: 'ring-2 ring-rose-400 bg-rose-300/40 dark:bg-rose-800/40',
  },
  discreet: {
    emptyCell: 'bg-stone-800/90',
    boardBg: 'bg-stone-950 border-stone-800',
    colors: {
      1: 'bg-stone-400 text-stone-950',
      2: 'bg-stone-500 text-stone-950',
      3: 'bg-stone-300 text-stone-950',
      4: 'bg-stone-600 text-stone-100',
      5: 'bg-stone-200 text-stone-950',
    },
    previewValid: 'ring-2 ring-stone-300 bg-stone-500/50',
    previewInvalid: 'ring-1 ring-stone-600 bg-stone-800/50',
  },
};

function playSoftTone(frequency: number, durationMs = 90) {
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = frequency;
    gain.gain.setValueAtTime(0.06, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + durationMs / 1000);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + durationMs / 1000);
    setTimeout(() => {
      ctx.close().catch(() => {});
    }, durationMs + 50);
  } catch {
    // ignore audio restrictions
  }
}

export function BlockPuzzle1010({ forceDiscreet = false, compact = false }: BlockPuzzle1010Props) {
  const [settings, setSettings] = useState<Game1010Settings>(() => loadGame1010Settings());
  const [board, setBoard] = useState<BoardGrid>(() => createEmptyBoard(settings.gridSize));
  const [tray, setTray] = useState<[PieceShape | null, PieceShape | null, PieceShape | null]>(() =>
    dealTray(),
  );
  const [selectedTrayIndex, setSelectedTrayIndex] = useState<number | null>(0);
  const [hoverCell, setHoverCell] = useState<[number, number] | null>(null);
  const [score, setScore] = useState(0);
  const [bestScore, setBestScore] = useState(() => loadBestScore());
  const [totalLines, setTotalLines] = useState(0);
  const [showSettings, setShowSettings] = useState(false);
  const [zenNotice, setZenNotice] = useState<string | null>(null);
  const [isGameOver, setIsGameOver] = useState(false);

  const activeThemeId: GameThemeId = forceDiscreet ? 'discreet' : settings.theme;
  const palette = THEME_PALETTES[activeThemeId];
  const selectedPiece = selectedTrayIndex !== null ? tray[selectedTrayIndex] : null;

  // Automatically select first available piece in tray if current is null
  useEffect(() => {
    if (selectedTrayIndex === null || tray[selectedTrayIndex] === null) {
      const nextIdx = tray.findIndex((p) => p !== null);
      setSelectedTrayIndex(nextIdx >= 0 ? nextIdx : null);
    }
  }, [tray, selectedTrayIndex]);

  const updateSettings = (patch: Partial<Game1010Settings>) => {
    const next: Game1010Settings = { ...settings, ...patch };
    setSettings(next);
    saveGame1010Settings(next);

    if (patch.gridSize && patch.gridSize !== board.length) {
      setBoard(createEmptyBoard(patch.gridSize));
      setTray(dealTray());
      setScore(0);
      setTotalLines(0);
      setIsGameOver(false);
    }
  };

  const handleRestart = () => {
    setBoard(createEmptyBoard(settings.gridSize));
    setTray(dealTray());
    setSelectedTrayIndex(0);
    setScore(0);
    setTotalLines(0);
    setIsGameOver(false);
    setZenNotice(null);
  };

  const handleRotateSelected = () => {
    if (!settings.allowRotation || selectedTrayIndex === null) return;
    const piece = tray[selectedTrayIndex];
    if (!piece) return;
    const rotated = rotatePieceClockwise(piece);
    const nextTray: [PieceShape | null, PieceShape | null, PieceShape | null] = [...tray];
    nextTray[selectedTrayIndex] = rotated;
    setTray(nextTray);
    if (settings.soundEnabled) {
      playSoftTone(380, 60);
    }
  };

  const handleZenRelief = () => {
    const relieved = applyZenBreathingSpace(board);
    setBoard(relieved);
    setIsGameOver(false);
    setZenNotice(t('game1010.zenAutoCleared'));
    setTimeout(() => setZenNotice(null), 3500);
  };

  const handleCellClick = (r: number, c: number) => {
    if (isGameOver || selectedTrayIndex === null) return;
    const piece = tray[selectedTrayIndex];
    if (!piece) return;

    const result = placePieceOnBoard(board, piece, r, c);
    if (!result) {
      if (settings.soundEnabled) {
        playSoftTone(220, 70);
      }
      return;
    }

    const nextScore = score + result.pointsEarned;
    setScore(nextScore);
    if (nextScore > bestScore) {
      setBestScore(nextScore);
      saveBestScore(nextScore);
    }
    if (result.linesCleared > 0) {
      setTotalLines((prev) => prev + result.linesCleared);
      if (settings.soundEnabled) {
        playSoftTone(660, 140);
      }
    } else if (settings.soundEnabled) {
      playSoftTone(480, 75);
    }

    // Update tray
    const updatedTray: [PieceShape | null, PieceShape | null, PieceShape | null] = [...tray];
    updatedTray[selectedTrayIndex] = null;

    const allUsed = updatedTray.every((p) => p === null);
    const finalTray = allUsed ? dealTray() : updatedTray;
    setTray(finalTray);
    setHoverCell(null);

    // Check if any remaining piece fits on result.board
    const fits = canAnyTrayPieceFit(result.board, finalTray, settings.allowRotation);
    if (!fits) {
      if (settings.mode === 'zen') {
        const relieved = applyZenBreathingSpace(result.board);
        setBoard(relieved);
        setZenNotice(t('game1010.zenAutoCleared'));
        setTimeout(() => setZenNotice(null), 3500);
      } else {
        setBoard(result.board);
        setIsGameOver(true);
      }
    } else {
      setBoard(result.board);
    }
  };

  // Compute preview cells when hovering or focusing
  const previewCoords = new Set<string>();
  let isPreviewValid = false;
  if (selectedPiece && hoverCell) {
    const [hr, hc] = hoverCell;
    isPreviewValid = canPlacePiece(board, selectedPiece, hr, hc);
    for (const [dr, dc] of selectedPiece.cells) {
      previewCoords.add(`${hr + dr},${hc + dc}`);
    }
  }

  return (
    <div
      className={`rounded-2xl border p-4 space-y-3.5 transition-colors ${
        forceDiscreet
          ? 'bg-stone-900 border-stone-800 text-stone-100'
          : 'bg-white dark:bg-stone-900 border-stone-200 dark:border-stone-800 text-stone-900 dark:text-stone-100'
      }`}
    >
      {/* Top Bar: Title + Score + Customize & Restart buttons */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-stone-200/60 dark:border-stone-800">
        <div className="flex items-center gap-2">
          <GamepadIcon className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
          <div>
            <h4 className="text-xs font-bold leading-tight">{t('game1010.title')}</h4>
            {!compact && (
              <p className="text-[10px] opacity-70 leading-tight mt-0.5">
                {settings.mode === 'zen' ? t('game1010.modeZen') : t('game1010.modeClassic')} ·{' '}
                {settings.gridSize}×{settings.gridSize}
              </p>
            )}
          </div>
        </div>

        {/* Scores & Controls */}
        <div className="flex items-center gap-2 text-xs">
          <div className="font-mono tabular-nums text-[11px] flex items-center gap-2 px-2 py-1 rounded-lg bg-stone-100 dark:bg-stone-800">
            <span>
              {t('game1010.score')}: <strong>{score}</strong>
            </span>
            <span aria-hidden="true">·</span>
            <span>
              {t('game1010.bestScore')}: <strong>{bestScore}</strong>
            </span>
          </div>

          <button
            type="button"
            onClick={() => setShowSettings(!showSettings)}
            className="px-2.5 py-1 rounded-lg text-[11px] font-semibold border border-stone-300 dark:border-stone-700 hover:bg-stone-100 dark:hover:bg-stone-800 cursor-pointer whitespace-nowrap"
          >
            {t('game1010.customizeBtn')}
          </button>

          <button
            type="button"
            onClick={handleRestart}
            className="p-1.5 rounded-lg border border-stone-300 dark:border-stone-700 hover:bg-stone-100 dark:hover:bg-stone-800 cursor-pointer"
            title={t('game1010.restartBtn')}
            aria-label={t('game1010.restartBtn')}
          >
            <RefreshIcon className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Customization Drawer */}
      {showSettings && (
        <div className="p-3.5 rounded-xl bg-stone-50 dark:bg-stone-800/70 border border-stone-200 dark:border-stone-700 space-y-3 text-xs animate-fade-in">
          <div className="font-bold text-xs flex items-center justify-between">
            <span>{t('game1010.settingsTitle')}</span>
            <span className="text-[10px] font-normal opacity-70">MIT Prinzhorn/1010</span>
          </div>

          {/* Theme selector */}
          <div className="space-y-1">
            <span className="text-[11px] font-semibold block">{t('game1010.themeLabel')}</span>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
              {(
                [
                  { id: 'emerald', label: t('game1010.themeEmerald') },
                  { id: 'amber', label: t('game1010.themeAmber') },
                  { id: 'ocean', label: t('game1010.themeOcean') },
                  { id: 'discreet', label: t('game1010.themeDiscreet') },
                ] as const
              ).map((th) => (
                <button
                  key={th.id}
                  type="button"
                  onClick={() => updateSettings({ theme: th.id })}
                  className={`px-2.5 py-1.5 rounded-lg text-[11px] font-medium border cursor-pointer whitespace-nowrap truncate ${
                    settings.theme === th.id
                      ? 'bg-emerald-800 text-white border-emerald-800 font-bold'
                      : 'bg-white dark:bg-stone-900 border-stone-200 dark:border-stone-700'
                  }`}
                >
                  {th.label}
                </button>
              ))}
            </div>
          </div>

          {/* Mode & Grid Size */}
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <span className="text-[11px] font-semibold block">{t('game1010.modeLabel')}</span>
              <div className="flex gap-1">
                {(['zen', 'classic'] as Array<GameMode>).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => updateSettings({ mode: m })}
                    className={`flex-1 py-1.5 px-2 rounded-lg text-[11px] font-medium border cursor-pointer whitespace-nowrap truncate ${
                      settings.mode === m
                        ? 'bg-emerald-800 text-white border-emerald-800 font-bold'
                        : 'bg-white dark:bg-stone-900 border-stone-200 dark:border-stone-700'
                    }`}
                  >
                    {m === 'zen' ? t('game1010.modeZen') : t('game1010.modeClassic')}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1">
              <span className="text-[11px] font-semibold block">{t('game1010.gridSizeLabel')}</span>
              <div className="flex gap-1">
                {([10, 8] as Array<GridSize>).map((sz) => (
                  <button
                    key={sz}
                    type="button"
                    onClick={() => updateSettings({ gridSize: sz })}
                    className={`flex-1 py-1.5 px-2 rounded-lg text-[11px] font-mono font-bold border cursor-pointer ${
                      settings.gridSize === sz
                        ? 'bg-emerald-800 text-white border-emerald-800'
                        : 'bg-white dark:bg-stone-900 border-stone-200 dark:border-stone-700'
                    }`}
                  >
                    {sz}×{sz}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Checkboxes: Rotation & Sound */}
          <div className="flex flex-wrap gap-4 pt-1">
            <label className="flex items-center gap-1.5 text-[11px] cursor-pointer">
              <input
                type="checkbox"
                checked={settings.allowRotation}
                onChange={(e) => updateSettings({ allowRotation: e.target.checked })}
                className="accent-emerald-700 rounded"
              />
              <span>{t('game1010.rotationLabel')}</span>
            </label>

            <label className="flex items-center gap-1.5 text-[11px] cursor-pointer">
              <input
                type="checkbox"
                checked={settings.soundEnabled}
                onChange={(e) => updateSettings({ soundEnabled: e.target.checked })}
                className="accent-emerald-700 rounded"
              />
              <span>{t('game1010.soundLabel')}</span>
            </label>
          </div>
        </div>
      )}

      {/* Zen notification */}
      {zenNotice && (
        <div className="px-3 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800 text-[11px] text-emerald-900 dark:text-emerald-200 flex items-center gap-1.5 font-medium">
          <SparklesIcon className="w-3.5 h-3.5 shrink-0" />
          <span>{zenNotice}</span>
        </div>
      )}

      {/* Classic Mode Game Over Banner */}
      {isGameOver && (
        <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/50 border border-amber-300 dark:border-amber-800 text-xs space-y-2 text-center">
          <div className="font-bold text-amber-950 dark:text-amber-200">
            {t('game1010.gameOverTitle')}
          </div>
          <p className="text-[11px] text-amber-900 dark:text-amber-300">
            {t('game1010.gameOverDesc')}
          </p>
          <div className="flex justify-center gap-2">
            <button
              type="button"
              onClick={handleZenRelief}
              className="btn-secondary text-xs py-1.5 px-3 !w-auto cursor-pointer"
            >
              {t('game1010.zenBreatheBtn')}
            </button>
            <button
              type="button"
              onClick={handleRestart}
              className="btn-primary text-xs py-1.5 px-3 !w-auto cursor-pointer"
            >
              {t('game1010.restartBtn')}
            </button>
          </div>
        </div>
      )}

      {/* 10x10 or 8x8 Interactive Board Grid */}
      <div className="flex justify-center">
        <div
          className={`grid gap-1 p-2 rounded-xl border ${palette.boardBg} w-full max-w-[310px] aspect-square`}
          style={{
            gridTemplateColumns: `repeat(${board.length}, minmax(0, 1fr))`,
          }}
        >
          {board.map((row, rIdx) =>
            row.map((cellValue, cIdx) => {
              const coordKey = `${rIdx},${cIdx}`;
              const isPreview = previewCoords.has(coordKey);
              const cellColor =
                cellValue > 0
                  ? palette.colors[cellValue] || palette.colors[1]
                  : isPreview
                    ? isPreviewValid
                      ? palette.previewValid
                      : palette.previewInvalid
                    : palette.emptyCell;

              return (
                <button
                  key={coordKey}
                  type="button"
                  onClick={() => handleCellClick(rIdx, cIdx)}
                  onMouseEnter={() => setHoverCell([rIdx, cIdx])}
                  onMouseLeave={() => setHoverCell(null)}
                  onFocus={() => setHoverCell([rIdx, cIdx])}
                  aria-label={`Case ${rIdx + 1}-${cIdx + 1}`}
                  className={`w-full h-full rounded-[4px] transition-transform duration-100 cursor-pointer ${cellColor} ${
                    cellValue > 0 ? 'scale-100 shadow-2xs' : 'hover:opacity-90'
                  }`}
                />
              );
            }),
          )}
        </div>
      </div>

      {/* Piece Tray (3 pieces at a time) + Rotate & Zen buttons */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-[11px] opacity-80">
          <span>{t('game1010.selectPieceHint')}</span>
          {settings.allowRotation && selectedPiece && (
            <button
              type="button"
              onClick={handleRotateSelected}
              className="underline font-semibold cursor-pointer hover:opacity-100 whitespace-nowrap ml-2 flex items-center gap-1"
            >
              <RefreshIcon className="w-3 h-3" />
              <span>{t('game1010.rotateBtn')}</span>
            </button>
          )}
        </div>

        <div className="grid grid-cols-3 gap-2">
          {tray.map((piece, idx) => {
            const isSelected = selectedTrayIndex === idx && piece !== null;
            return (
              <button
                key={piece ? piece.id : `empty-${idx}`}
                type="button"
                disabled={!piece}
                onClick={() => setSelectedTrayIndex(idx)}
                className={`h-20 rounded-xl border flex items-center justify-center p-2 transition-all cursor-pointer ${
                  !piece
                    ? 'opacity-25 border-dashed border-stone-300 dark:border-stone-800 cursor-default'
                    : isSelected
                      ? 'border-emerald-600 dark:border-emerald-400 bg-emerald-50/60 dark:bg-emerald-950/40 ring-2 ring-emerald-500/40 scale-[1.02]'
                      : 'border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-800/50 hover:border-stone-400'
                }`}
                aria-label={`Pièce ${idx + 1}`}
              >
                {piece && <MiniPiecePreview piece={piece} palette={palette.colors} />}
              </button>
            );
          })}
        </div>

        {/* Footer row: Lines cleared + optional Zen relief */}
        <div className="flex items-center justify-between text-[11px] opacity-75 pt-1">
          <span className="font-mono tabular-nums">
            {t('game1010.linesCleared')}: <strong>{totalLines}</strong>
          </span>
          <button
            type="button"
            onClick={handleZenRelief}
            className="underline hover:opacity-100 cursor-pointer"
          >
            {t('game1010.zenBreatheBtn')}
          </button>
        </div>
      </div>
    </div>
  );
}

function MiniPiecePreview({
  piece,
  palette,
}: {
  piece: PieceShape;
  palette: Record<number, string>;
}) {
  const maxR = Math.max(...piece.cells.map(([r]) => r), 0) + 1;
  const maxC = Math.max(...piece.cells.map(([, c]) => c), 0) + 1;
  const filledSet = new Set(piece.cells.map(([r, c]) => `${r},${c}`));
  const colorClass = palette[piece.colorIndex] || palette[1];

  return (
    <div
      className="grid gap-0.5"
      style={{
        gridTemplateColumns: `repeat(${maxC}, 11px)`,
        gridTemplateRows: `repeat(${maxR}, 11px)`,
      }}
    >
      {Array.from({ length: maxR }).map((_, r) =>
        Array.from({ length: maxC }).map((__, c) => {
          const key = `${r},${c}`;
          const filled = filledSet.has(key);
          return (
            <span
              key={key}
              className={`w-[11px] h-[11px] rounded-[2px] ${filled ? colorClass : 'bg-transparent'}`}
            />
          );
        }),
      )}
    </div>
  );
}
