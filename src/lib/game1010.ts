/**
 * Lightweight, zero-dependency engine inspired by open-source Prinzhorn/1010 puzzle mechanics.
 * Designed for cognitive & tactile distraction during a 3-minute smoking craving.
 */

export type GameThemeId = 'emerald' | 'amber' | 'ocean' | 'discreet';
export type GameMode = 'zen' | 'classic';
export type GridSize = 8 | 10;

export interface Game1010Settings {
  theme: GameThemeId;
  mode: GameMode;
  gridSize: GridSize;
  soundEnabled: boolean;
  allowRotation: boolean;
}

export interface PieceShape {
  id: string;
  cells: Array<[number, number]>; // [rowOffset, colOffset]
  colorIndex: number; // 1..5
}

export type BoardGrid = number[][]; // 0 = empty, 1..5 = filled colorIndex

const SETTINGS_STORAGE_KEY = 'tb_game1010_settings';
const BEST_SCORE_STORAGE_KEY = 'tb_game1010_best_score';

export const DEFAULT_GAME_SETTINGS: Game1010Settings = {
  theme: 'emerald',
  mode: 'zen',
  gridSize: 10,
  soundEnabled: false,
  allowRotation: true,
};

// Canonical 1010! polyomino shapes
export const BASE_SHAPES: Array<{
  id: string;
  cells: Array<[number, number]>;
  colorIndex: number;
}> = [
  // 1x1 single
  { id: 'dot-1', cells: [[0, 0]], colorIndex: 1 },
  // 2-bars
  {
    id: 'bar-h2',
    cells: [
      [0, 0],
      [0, 1],
    ],
    colorIndex: 2,
  },
  {
    id: 'bar-v2',
    cells: [
      [0, 0],
      [1, 0],
    ],
    colorIndex: 2,
  },
  // 3-bars
  {
    id: 'bar-h3',
    cells: [
      [0, 0],
      [0, 1],
      [0, 2],
    ],
    colorIndex: 3,
  },
  {
    id: 'bar-v3',
    cells: [
      [0, 0],
      [1, 0],
      [2, 0],
    ],
    colorIndex: 3,
  },
  // 4-bars
  {
    id: 'bar-h4',
    cells: [
      [0, 0],
      [0, 1],
      [0, 2],
      [0, 3],
    ],
    colorIndex: 4,
  },
  {
    id: 'bar-v4',
    cells: [
      [0, 0],
      [1, 0],
      [2, 0],
      [3, 0],
    ],
    colorIndex: 4,
  },
  // 5-bars
  {
    id: 'bar-h5',
    cells: [
      [0, 0],
      [0, 1],
      [0, 2],
      [0, 3],
      [0, 4],
    ],
    colorIndex: 5,
  },
  {
    id: 'bar-v5',
    cells: [
      [0, 0],
      [1, 0],
      [2, 0],
      [3, 0],
      [4, 0],
    ],
    colorIndex: 5,
  },
  // 2x2 square
  {
    id: 'sq-2',
    cells: [
      [0, 0],
      [0, 1],
      [1, 0],
      [1, 1],
    ],
    colorIndex: 1,
  },
  // 3x3 square
  {
    id: 'sq-3',
    cells: [
      [0, 0],
      [0, 1],
      [0, 2],
      [1, 0],
      [1, 1],
      [1, 2],
      [2, 0],
      [2, 1],
      [2, 2],
    ],
    colorIndex: 5,
  },
  // Small 2x2 L corners
  {
    id: 'corner-2-tl',
    cells: [
      [0, 0],
      [0, 1],
      [1, 0],
    ],
    colorIndex: 2,
  },
  {
    id: 'corner-2-tr',
    cells: [
      [0, 0],
      [0, 1],
      [1, 1],
    ],
    colorIndex: 2,
  },
  {
    id: 'corner-2-bl',
    cells: [
      [0, 0],
      [1, 0],
      [1, 1],
    ],
    colorIndex: 2,
  },
  {
    id: 'corner-2-br',
    cells: [
      [0, 1],
      [1, 0],
      [1, 1],
    ],
    colorIndex: 2,
  },
  // Big 3x3 L corners
  {
    id: 'corner-3-tl',
    cells: [
      [0, 0],
      [0, 1],
      [0, 2],
      [1, 0],
      [2, 0],
    ],
    colorIndex: 4,
  },
  {
    id: 'corner-3-tr',
    cells: [
      [0, 0],
      [0, 1],
      [0, 2],
      [1, 2],
      [2, 2],
    ],
    colorIndex: 4,
  },
  {
    id: 'corner-3-bl',
    cells: [
      [0, 0],
      [1, 0],
      [2, 0],
      [2, 1],
      [2, 2],
    ],
    colorIndex: 4,
  },
  {
    id: 'corner-3-br',
    cells: [
      [0, 2],
      [1, 2],
      [2, 0],
      [2, 1],
      [2, 2],
    ],
    colorIndex: 4,
  },
];

export function createEmptyBoard(size: GridSize = 10): BoardGrid {
  return Array.from({ length: size }, () => Array.from({ length: size }, () => 0));
}

export function randomPiece(uidSuffix = ''): PieceShape {
  const chosen = BASE_SHAPES[Math.floor(Math.random() * BASE_SHAPES.length)];
  return {
    id: `${chosen.id}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}${uidSuffix}`,
    cells: chosen.cells.map(([r, c]) => [r, c]),
    colorIndex: chosen.colorIndex,
  };
}

export function dealTray(): [PieceShape | null, PieceShape | null, PieceShape | null] {
  return [randomPiece('-0'), randomPiece('-1'), randomPiece('-2')];
}

export function rotatePieceClockwise(piece: PieceShape): PieceShape {
  const rotatedRaw = piece.cells.map(([r, c]) => [c, -r] as [number, number]);
  const minR = Math.min(...rotatedRaw.map(([r]) => r));
  const minC = Math.min(...rotatedRaw.map(([, c]) => c));
  const normalized: Array<[number, number]> = rotatedRaw.map(([r, c]) => [r - minR, c - minC]);
  return {
    ...piece,
    cells: normalized,
  };
}

export function canPlacePiece(
  board: BoardGrid,
  piece: PieceShape,
  anchorRow: number,
  anchorCol: number,
): boolean {
  const size = board.length;
  for (const [dr, dc] of piece.cells) {
    const r = anchorRow + dr;
    const c = anchorCol + dc;
    if (r < 0 || r >= size || c < 0 || c >= size) {
      return false;
    }
    if (board[r][c] !== 0) {
      return false;
    }
  }
  return true;
}

export function canPieceFitAnywhere(board: BoardGrid, piece: PieceShape): boolean {
  const size = board.length;
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (canPlacePiece(board, piece, r, c)) {
        return true;
      }
    }
  }
  return false;
}

export function canAnyTrayPieceFit(
  board: BoardGrid,
  tray: Array<PieceShape | null>,
  allowRotation = false,
): boolean {
  const activePieces = tray.filter((p): p is PieceShape => p !== null);
  if (activePieces.length === 0) return true;

  for (const piece of activePieces) {
    if (canPieceFitAnywhere(board, piece)) return true;
    if (allowRotation) {
      let rotated = piece;
      for (let i = 0; i < 3; i++) {
        rotated = rotatePieceClockwise(rotated);
        if (canPieceFitAnywhere(board, rotated)) return true;
      }
    }
  }
  return false;
}

export interface PlacementResult {
  board: BoardGrid;
  pointsEarned: number;
  linesCleared: number;
}

/**
 * Places a piece onto the board and clears any completed full rows and columns simultaneously
 * (exactly like Prinzhorn/1010).
 */
export function placePieceOnBoard(
  board: BoardGrid,
  piece: PieceShape,
  anchorRow: number,
  anchorCol: number,
): PlacementResult | null {
  if (!canPlacePiece(board, piece, anchorRow, anchorCol)) {
    return null;
  }

  const size = board.length;
  const nextBoard: BoardGrid = board.map((row) => [...row]);

  for (const [dr, dc] of piece.cells) {
    nextBoard[anchorRow + dr][anchorCol + dc] = piece.colorIndex;
  }

  // Detect full rows and full columns before clearing so intersections clear properly
  const fullRows: number[] = [];
  const fullCols: number[] = [];

  for (let r = 0; r < size; r++) {
    if (nextBoard[r].every((cell) => cell !== 0)) {
      fullRows.push(r);
    }
  }

  for (let c = 0; c < size; c++) {
    let colFull = true;
    for (let r = 0; r < size; r++) {
      if (nextBoard[r][c] === 0) {
        colFull = false;
        break;
      }
    }
    if (colFull) {
      fullCols.push(c);
    }
  }

  for (const r of fullRows) {
    for (let c = 0; c < size; c++) {
      nextBoard[r][c] = 0;
    }
  }

  for (const c of fullCols) {
    for (let r = 0; r < size; r++) {
      nextBoard[r][c] = 0;
    }
  }

  const linesCleared = fullRows.length + fullCols.length;
  // 1010 scoring: 1 point per block placed + triangular combo bonus for cleared lines
  const lineBonus = linesCleared > 0 ? ((linesCleared * (linesCleared + 1)) / 2) * 10 : 0;
  const pointsEarned = piece.cells.length + lineBonus;

  return {
    board: nextBoard,
    pointsEarned,
    linesCleared,
  };
}

/**
 * Zen Mode relief: clears the 3 most crowded rows/columns when the board gets tight,
 * so the user never experiences game-over frustration during a craving.
 */
export function applyZenBreathingSpace(board: BoardGrid): BoardGrid {
  const size = board.length;
  const nextBoard: BoardGrid = board.map((row) => [...row]);

  // Rank rows by occupancy
  const rowCounts = nextBoard.map((row, idx) => ({
    idx,
    count: row.filter((c) => c !== 0).length,
  }));
  rowCounts.sort((a, b) => b.count - a.count);

  const toClear = rowCounts.slice(0, Math.min(3, size));
  for (const { idx } of toClear) {
    for (let c = 0; c < size; c++) {
      nextBoard[idx][c] = 0;
    }
  }
  return nextBoard;
}

export function loadGame1010Settings(): Game1010Settings {
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) return DEFAULT_GAME_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<Game1010Settings>;
    return {
      theme:
        parsed.theme === 'emerald' ||
        parsed.theme === 'amber' ||
        parsed.theme === 'ocean' ||
        parsed.theme === 'discreet'
          ? parsed.theme
          : DEFAULT_GAME_SETTINGS.theme,
      mode: parsed.mode === 'classic' || parsed.mode === 'zen' ? parsed.mode : 'zen',
      gridSize: parsed.gridSize === 8 || parsed.gridSize === 10 ? parsed.gridSize : 10,
      soundEnabled: Boolean(parsed.soundEnabled),
      allowRotation: parsed.allowRotation !== undefined ? Boolean(parsed.allowRotation) : true,
    };
  } catch {
    return DEFAULT_GAME_SETTINGS;
  }
}

export function saveGame1010Settings(settings: Game1010Settings): void {
  try {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // ignore storage errors
  }
}

export function loadBestScore(): number {
  try {
    const val = Number(localStorage.getItem(BEST_SCORE_STORAGE_KEY));
    return Number.isFinite(val) && val >= 0 ? val : 0;
  } catch {
    return 0;
  }
}

export function saveBestScore(score: number): void {
  try {
    const current = loadBestScore();
    if (score > current) {
      localStorage.setItem(BEST_SCORE_STORAGE_KEY, String(score));
    }
  } catch {
    // ignore
  }
}
