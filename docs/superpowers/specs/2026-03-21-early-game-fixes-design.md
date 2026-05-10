# Early-Game Fixes Design Spec

## Problem

Three issues make the early game unplayable:

1. **No drag-to-dig** — Players must click each tile individually to mark it for digging. In Dungeon Keeper 1/2, you could paint-drag across tiles.
2. **Zero starting resources** — Gold and mana both start at 0. Players cannot build any rooms or cast any spells before wave 1. In DK1/2, you started with enough to build your first rooms.
3. **Heroes spawn at the heart** — `WaveManager._findSpawnPoint()` picks the nearest walkable tile to a random map edge. Early game, the only walkable tiles are the 3x3 dungeon heart room, so heroes appear directly at the heart with no travel time.

Two additional bugs from QA are included:

4. **Game over / victory time always shows "0m 0s"** — `elapsedTime` not passed through to the stats formatter.
5. **Tooltip visible behind overlay screens** — Tooltip keeps updating during pause/game over.

## Changes

### 1. Drag-to-Dig (Freeform Painting)

**Behavior**: Hold left mouse button and drag — every tile the cursor crosses gets marked for digging (if diggable and adjacent to a walkable tile). Single click still works for one tile.

**InputManager changes**:
- Track `_leftMouseDown` state via `mousedown` (button 0) and `mouseup` (button 0) events on the canvas/window.
- On `mousemove`, if `_leftMouseDown` is true AND the current tile differs from the last published drag tile, publish `EVENTS.INPUT_DRAG` with the same payload as `INPUT_CLICK` (screenX/Y, worldX/Y, tileX/Y). Only publish when tile coordinates change to avoid flooding the EventBus on sub-tile mouse moves.
- On `mouseup` (button 0), publish `EVENTS.INPUT_MOUSE_UP`.

**main.js changes**:
- Subscribe to `INPUT_DRAG`.
- In the handler, run the same dig-marking logic as the `INPUT_CLICK` handler (check `activeTool === 'dig'`, `world.isDiggable()`, walkable neighbor, `jobQueue.addDigJob()`).
- Track a `Set<string>` of tiles already marked during the current drag session (keyed by `"tileX,tileY"`). Subscribe to `INPUT_MOUSE_UP` to clear the set. This prevents re-processing the same tile as the cursor hovers over it.

**constants.js changes**:
- Add `INPUT_DRAG: 'input:drag'` to `EVENTS`.
- Add `INPUT_MOUSE_UP: 'input:mouse_up'` to `EVENTS`.

**Files touched**: `src/constants.js`, `src/input/InputManager.js`, `src/main.js`.

### 2. Starting Resources

**constants.js changes**:
- Add `STARTING_GOLD: 500` to `RESOURCES` — enough for 2 starter rooms (Lair 4 tiles = 200g + Hatchery 4 tiles = 240g = 440g, leaving 60g buffer). Does not hit `GOLD_BASE_CAP` (1000), so gold earned from digging is not wasted.
- Add `STARTING_MANA: 200` to `RESOURCES` — enough for one Create Imp spell (200m) or one Lightning Strike (150m), but not both. Mana regens at 2/sec so the second spell becomes available after natural regeneration.

**ResourceManager changes**:
- Initialize `this._gold = RESOURCES.STARTING_GOLD` (was `0`).
- Initialize `this._mana = RESOURCES.STARTING_MANA` (was `0`).
- Call `this._publish()` at end of constructor so HUD shows correct values from frame 1.

**Files touched**: `src/constants.js`, `src/systems/ResourceManager.js`.

### 3. Hero Spawn at Map Edges + Dig Through Walls

**Spawn point change** (`WaveManager._findSpawnPoint`):
- Always return a tile ON the map edge (row 0, last row, col 0, or last col).
- Pick a random edge, then a random position along that edge. Return it directly — no walkability check.

**Hero digging behavior** (`Hero` base class):
- `CREATURE_STATES.DIGGING` already exists in `constants.js` (used by imps). Reuse it for heroes.
- In `Hero.update()`: when `_repath()` finds no path (returns null), enter `DIGGING` state.
- In `DIGGING` state:
  - Identify the adjacent wall tile closest to the dungeon heart center (simple Manhattan distance heuristic).
  - Accumulate a dig timer. When timer reaches `WAVE.HERO_DIG_TIME_SEC` (4 seconds), dig the tile: set it to `TILE_TYPES.UNCLAIMED_FLOOR` via `world.setTile()` (not `CLAIMED_FLOOR` — heroes are enemies and do not claim territory). Publish `EVENTS.TILE_CHANGED` so the minimap and tile renderer update. Clear pathfinder cache and re-path.
  - Move the hero to the center of the newly dug tile.
- When a path is found again, exit `DIGGING` state and resume `MOVING`.
- Note: hero-dug tiles do NOT trigger `TILE_DUG` (no gold yield, no particles). Only `TILE_CHANGED` is published for rendering updates.

**New constants**:
- `WAVE.HERO_DIG_TIME_SEC: 4` — seconds for a hero to dig one wall tile (imps are ~1s, so heroes are 4x slower).

**Files touched**: `src/constants.js`, `src/systems/WaveManager.js`, `src/entities/Hero.js`.

### 4. Bug Fix: Game Over / Victory Time Display

**Root cause**: `GameStateManager.gameOver()` publishes `{ stats: { ...this._stats }, elapsedTime: this._elapsedTime }`. `main.js` passes only `e.stats` to `MenuScreen.showGameOver()`, which does not contain `elapsedTime`.

**Fix in main.js**:
- Game over handler: `menuScreen.showGameOver({ ...e.stats, elapsedTime: e.elapsedTime })`.
- Victory handler: `menuScreen.showVictory({ ...e.stats, elapsedTime: e.elapsedTime })`.

**Files touched**: `src/main.js`.

### 5. Bug Fix: Tooltip Behind Overlays

**Root cause**: `INPUT_MOUSE_MOVE` handler calls `tooltip.show()` regardless of game state. Tooltip renders behind semi-transparent overlays.

**Fix in main.js**:
- Guard the tooltip update: `if (gameStateManager.state === GAME_STATES.PLAYING) { tooltip.show(...); } else { tooltip.hide(); }`.
- Uses the existing `GAME_STATES` enum import, not a bare string literal.

**Files touched**: `src/main.js`.

## Files Summary

| File | Changes |
|------|---------|
| `src/constants.js` | Add `INPUT_DRAG` + `INPUT_MOUSE_UP` events, `STARTING_GOLD`, `STARTING_MANA`, `HERO_DIG_TIME_SEC` |
| `src/input/InputManager.js` | Track left mouse state, publish `INPUT_DRAG` (with tile-change guard) and `INPUT_MOUSE_UP` |
| `src/systems/ResourceManager.js` | Initialize gold/mana to starting values, publish initial state |
| `src/systems/WaveManager.js` | Spawn heroes at map edge tiles directly |
| `src/entities/Hero.js` | Add wall-digging behavior when no path exists, using `UNCLAIMED_FLOOR` + `TILE_CHANGED` event |
| `src/main.js` | Subscribe to `INPUT_DRAG`/`INPUT_MOUSE_UP` for dig painting, fix time display, fix tooltip |

## Testing

- **Drag-to-dig**: Start game, hold left mouse and drag across dirt tiles adjacent to heart. Verify all crossed tiles get marked. Verify single click still works. Verify dragging over non-diggable tiles (rock, lava) skips them. Verify dragging in room-placement mode does NOT paint-dig.
- **Starting resources**: Start game, verify HUD shows 500 gold and 200 mana immediately. Verify you can build a Lair (select tool 2, click 4+ claimed floor tiles, press Enter). Verify gold from digging is added on top of starting gold (not wasted due to cap).
- **Hero spawn**: Start game, wait for wave 1. Verify heroes appear at map edges, not at the heart. Verify they dig through walls toward the heart. Verify digging takes ~4 seconds per tile. Verify hero-dug tiles become unclaimed floor (not claimed). Verify minimap updates when heroes dig tiles.
- **Time display**: Play until game over. Verify Time shows actual elapsed time (e.g., "1m 30s").
- **Tooltip**: Pause game (P key). Verify tooltip disappears and does not show through the pause overlay. Verify tooltip reappears when game is resumed.
