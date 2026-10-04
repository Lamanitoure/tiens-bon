import { describe, expect, it } from 'vitest';
import {
  applyZenBreathingSpace,
  canAnyTrayPieceFit,
  canPlacePiece,
  createEmptyBoard,
  dealTray,
  type PieceShape,
  placePieceOnBoard,
  rotatePieceClockwise,
} from '../src/lib/game1010.ts';

describe('Prinzhorn/1010 Block Puzzle Engine', () => {
  it('creates an empty 10x10 or 8x8 board and deals 3 pieces', () => {
    const board10 = createEmptyBoard(10);
    expect(board10.length).toBe(10);
    expect(board10[0].length).toBe(10);

    const board8 = createEmptyBoard(8);
    expect(board8.length).toBe(8);

    const tray = dealTray();
    expect(tray.length).toBe(3);
    expect(tray.every((p) => p !== null)).toBe(true);
  });

  it('places a piece and clears both a full row and full column simultaneously', () => {
    const board = createEmptyBoard(8);
    // Fill row 0 except col 0, and fill col 0 except row 0
    for (let i = 1; i < 8; i++) {
      board[0][i] = 1;
      board[i][0] = 2;
    }

    const dotPiece: PieceShape = {
      id: 'dot-test',
      cells: [[0, 0]],
      colorIndex: 3,
    };

    expect(canPlacePiece(board, dotPiece, 0, 0)).toBe(true);
    const res = placePieceOnBoard(board, dotPiece, 0, 0);
    expect(res).not.toBeNull();
    expect(res?.linesCleared).toBe(2);
    // 1 block + triangular bonus for 2 lines ((2*3)/2 * 10 = 30) => 31 points
    expect(res?.pointsEarned).toBe(31);

    // Both row 0 and col 0 should now be completely cleared
    for (let i = 0; i < 8; i++) {
      expect(res?.board[0][i]).toBe(0);
      expect(res?.board[i][0]).toBe(0);
    }
  });

  it('rotates an L-piece clockwise and normalizes coordinates to non-negative offsets', () => {
    const piece: PieceShape = {
      id: 'bar-h3',
      cells: [
        [0, 0],
        [0, 1],
        [0, 2],
      ],
      colorIndex: 2,
    };

    const rotated = rotatePieceClockwise(piece);
    expect(rotated.cells.length).toBe(3);
    // Horizontal 1x3 becomes vertical 3x1
    expect(rotated.cells).toContainEqual([0, 0]);
    expect(rotated.cells).toContainEqual([1, 0]);
    expect(rotated.cells).toContainEqual([2, 0]);
  });

  it('applies Zen breathing space by clearing the 3 most crowded rows', () => {
    const board = createEmptyBoard(8);
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 7; c++) {
        board[r][c] = 1;
      }
    }

    const bigSquare: PieceShape = {
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
      colorIndex: 4,
    };

    expect(canAnyTrayPieceFit(board, [bigSquare, null, null])).toBe(false);

    const relieved = applyZenBreathingSpace(board);
    const emptyRows = relieved.filter((row) => row.every((c) => c === 0));
    expect(emptyRows.length).toBe(3);
  });
});
