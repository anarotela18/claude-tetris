# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Vanilla-JavaScript Tetris using the HTML5 Canvas 2D API. No dependencies, no build step, no `package.json`. Three files: [index.html](index.html) (DOM + two canvases), [style.css](style.css) (dark arcade theme), [game.js](game.js) (all game logic, ~300 lines). UI text is in Spanish.

## Running

No install/compile. Either open [index.html](index.html) directly, or serve statically (needed for some browser file:// restrictions):

```bash
python3 -m http.server 8000   # then open http://localhost:8000
```

There is no test suite, linter, or build tooling.

## Architecture (game.js)

All state lives in module-level `let` variables (`board`, `current`, `next`, `score`, `lines`, `level`, `dropInterval`, etc.) reset by `init()`. There are no classes — logic is plain functions operating on that shared state.

- **Board model**: `ROWS × COLS` matrix; each cell is `0` (empty) or a color index `1–7`. The index is both the piece type and the index into the `COLORS` and `PIECES` arrays (index `0` is `null` in both, so IDs are 1-based).
- **Pieces**: square matrices in `PIECES`. Rotation (`rotateCW`) is transpose + row-reverse. `tryRotate` applies basic wall kicks by testing horizontal offsets `[0,-1,1,-2,2]`.
- **Collision** (`collide(shape, x, y)`): the single gate for all movement/rotation/spawn checks — walls, floor, and settled blocks.
- **Game loop** (`loop`): `requestAnimationFrame`-driven, accumulates `dt` into `dropAccum` and drops one row when it exceeds `dropInterval`. `animId` holds the frame handle; pause/end/restart cancel it.
- **Piece lifecycle**: `lockPiece()` → `merge()` (write piece into board) → `clearLines()` → `spawn()` (promote `next` to `current`, generate new `next`; if the new piece already collides, `endGame()`).
- **Scoring/speed**: `LINE_SCORES` × level; level rises every 10 lines; `dropInterval = max(100, 1000 - (level-1)*90)`.
- **Rendering**: `draw()` clears and redraws grid, board, ghost piece (`ghostY` + `globalAlpha`), then current piece each frame. `drawNext()` renders the preview canvas only on spawn.

Input is a single `keydown` handler that mutates `current` after guarding with `collide`.

## Editing notes

- Board dimensions are coupled to markup: if you change `COLS`, `ROWS`, or `BLOCK`, also update `width`/`height` of `<canvas id="board">` in [index.html](index.html) to `COLS*BLOCK × ROWS*BLOCK`.
- `COLORS` and `PIECES` are parallel arrays indexed by piece ID; keep them aligned when adding/reordering pieces.
