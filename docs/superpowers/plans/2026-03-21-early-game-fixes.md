# Early-Game Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix three critical early-game problems (no drag-to-dig, zero starting resources, heroes spawning at the heart) plus two QA bugs (broken time display, tooltip behind overlays).

**Architecture:** All changes follow EventBus pub/sub — no system imports another directly. New input events (`INPUT_DRAG`, `INPUT_MOUSE_UP`) flow through `InputManager → EventBus → main.js`. Hero dig behavior is self-contained in `Hero.js`. Starting resources are constants in `constants.js` consumed by `ResourceManager`.

**Tech Stack:** Vanilla JS, Vitest, Vite

**Spec:** `docs/superpowers/specs/2026-03-21-early-game-fixes-design.md`

---

### Task 1: Starting Resources

The simplest change — add starting gold/mana constants and initialize ResourceManager with them. This unblocks all other gameplay testing.

**Files:**
- Modify: `src/constants.js:110-117` (RESOURCES object)
- Modify: `src/systems/ResourceManager.js:10-18` (constructor)
- Modify: `tests/systems/ResourceManager.test.js:7-11` (existing test that checks for zero)

- [ ] **Step 1: Write tests for starting resources**

Add a new test and update the existing one in `tests/systems/ResourceManager.test.js`:

```js
// Replace the existing test at line 7-11:
it('starts with STARTING_GOLD and STARTING_MANA', () => {
  const rm = new ResourceManager(new EventBus());
  expect(rm.gold).toBe(RESOURCES.STARTING_GOLD);
  expect(rm.mana).toBe(RESOURCES.STARTING_MANA);
});

// Add new test after the existing block:
it('publishes RESOURCES_CHANGED on construction', () => {
  const eventBus = new EventBus();
  const spy = vi.fn();
  eventBus.subscribe(EVENTS.RESOURCES_CHANGED, spy);
  const rm = new ResourceManager(eventBus);
  expect(spy).toHaveBeenCalledWith(expect.objectContaining({
    gold: RESOURCES.STARTING_GOLD,
    mana: RESOURCES.STARTING_MANA,
  }));
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/systems/ResourceManager.test.js`
Expected: 2 FAIL — gold is 0 instead of `STARTING_GOLD`, and no publish in constructor.

- [ ] **Step 3: Add constants**

In `src/constants.js`, add two properties to the `RESOURCES` object (inside the `Object.freeze` call, after line 116):

```js
export const RESOURCES = Object.freeze({
  GOLD_BASE_CAP: 1000,
  GOLD_PER_TREASURY_TILE: 500,
  MANA_CAP: 500,
  MANA_REGEN_PER_SEC: 2,
  GOLD_VEIN_YIELD: 200,
  GEM_SEAM_GOLD_PER_SEC: 5,
  STARTING_GOLD: 500,
  STARTING_MANA: 200,
});
```

- [ ] **Step 4: Update ResourceManager constructor**

In `src/systems/ResourceManager.js`, change the constructor (lines 10-18):

```js
constructor(eventBus) {
  this._eventBus = eventBus;
  this._gold = RESOURCES.STARTING_GOLD;
  this._mana = RESOURCES.STARTING_MANA;
  this._goldCap = RESOURCES.GOLD_BASE_CAP;
  this._manaCap = RESOURCES.MANA_CAP;
  this._heartHP = DUNGEON_HEART_HP;
  this._heartMaxHP = DUNGEON_HEART_HP;
  this._publish();
}
```

- [ ] **Step 5: Fix affected tests**

Update `earnGold adds gold up to cap` test (line 13-19) — gold starts at STARTING_GOLD now:

```js
it('earnGold adds gold up to cap', () => {
  const rm = new ResourceManager(new EventBus());
  rm.earnGold(300);
  expect(rm.gold).toBe(RESOURCES.STARTING_GOLD + 300);
  rm.earnGold(800);
  expect(rm.gold).toBe(RESOURCES.GOLD_BASE_CAP);
});
```

Update `spendGold deducts gold and returns true` test (line 21-26) — gold starts at 500 now:

```js
it('spendGold deducts gold and returns true', () => {
  const rm = new ResourceManager(new EventBus());
  rm.earnGold(200);
  expect(rm.spendGold(300)).toBe(true);
  expect(rm.gold).toBe(RESOURCES.STARTING_GOLD + 200 - 300);
});
```

Update `spendGold returns false if insufficient gold` test (line 28-33) — gold starts at 500 now, spending 200 would succeed:

```js
it('spendGold returns false if insufficient gold', () => {
  const rm = new ResourceManager(new EventBus());
  rm.earnGold(100);
  expect(rm.spendGold(RESOURCES.STARTING_GOLD + 200)).toBe(false);
  expect(rm.gold).toBe(RESOURCES.STARTING_GOLD + 100);
});
```

Update `mana regenerates via update(dt)` test (line 35-39) — mana no longer starts at 0:

```js
it('mana regenerates via update(dt)', () => {
  const rm = new ResourceManager(new EventBus());
  const before = rm.mana;
  rm.update(1.0);
  expect(rm.mana).toBeCloseTo(before + RESOURCES.MANA_REGEN_PER_SEC);
});
```

Update `publishes RESOURCES_CHANGED on earnGold` test (line 54-61) — constructor now publishes first with starting gold:

```js
it('publishes RESOURCES_CHANGED on earnGold', () => {
  const eventBus = new EventBus();
  const spy = vi.fn();
  eventBus.subscribe(EVENTS.RESOURCES_CHANGED, spy);
  const rm = new ResourceManager(eventBus);
  rm.earnGold(100);
  expect(spy).toHaveBeenCalledWith(expect.objectContaining({ gold: RESOURCES.STARTING_GOLD + 100 }));
});
```

Update `spendMana returns false if insufficient` test (line 71-75) — mana starts at 200 now:

```js
it('spendMana returns false if insufficient', () => {
  const rm = new ResourceManager(new EventBus());
  expect(rm.spendMana(RESOURCES.STARTING_MANA + 100)).toBe(false);
  expect(rm.mana).toBe(RESOURCES.STARTING_MANA);
});
```

Update `getSnapshot returns current state` test (line 77-86) — gold/mana start at starting values:

```js
it('getSnapshot returns current state', () => {
  const rm = new ResourceManager(new EventBus());
  rm.earnGold(300);
  rm.update(1.0);
  const snap = rm.getSnapshot();
  expect(snap.gold).toBe(RESOURCES.STARTING_GOLD + 300);
  expect(snap.mana).toBeCloseTo(RESOURCES.STARTING_MANA + RESOURCES.MANA_REGEN_PER_SEC);
  expect(snap.goldCap).toBe(RESOURCES.GOLD_BASE_CAP);
  expect(snap.manaCap).toBe(RESOURCES.MANA_CAP);
});
```

- [ ] **Step 6: Fix `lastGold` tracking in main.js**

In `src/main.js`, line 465, change:

```js
let lastGold = 0;
```

to:

```js
let lastGold = RESOURCES.STARTING_GOLD;
```

This prevents starting gold from being counted as "gold earned" in the stats. `RESOURCES` is already imported at line 2.

- [ ] **Step 7: Run tests to verify they pass**

Run: `npx vitest run tests/systems/ResourceManager.test.js`
Expected: All PASS

- [ ] **Step 8: Commit**

```bash
git add src/constants.js src/systems/ResourceManager.js tests/systems/ResourceManager.test.js src/main.js
git commit -m "feat: add starting gold (500) and mana (200) for playable early game"
```

---

### Task 2: Bug Fix — Game Over / Victory Time Display

**Files:**
- Modify: `src/main.js:436-452` (GAME_OVER and GAME_VICTORY handlers)

- [ ] **Step 1: Fix time display in game over handler**

In `src/main.js`, change line 445 from:

```js
    menuScreen.showGameOver(e.stats);
```

to:

```js
    menuScreen.showGameOver({ ...e.stats, elapsedTime: e.elapsedTime });
```

- [ ] **Step 2: Fix time display in victory handler**

In `src/main.js`, change line 451 from:

```js
  menuScreen.showVictory(e.stats);
```

to:

```js
  menuScreen.showVictory({ ...e.stats, elapsedTime: e.elapsedTime });
```

- [ ] **Step 3: Run all tests to verify no regressions**

Run: `npm test`
Expected: All PASS

- [ ] **Step 4: Commit**

```bash
git add src/main.js
git commit -m "fix: pass elapsedTime to game over and victory screens"
```

---

### Task 3: Bug Fix — Tooltip Behind Overlays

**Files:**
- Modify: `src/main.js:171-175` (INPUT_MOUSE_MOVE handler)

- [ ] **Step 1: Guard tooltip with game state check**

In `src/main.js`, change the mouse move handler (lines 171-175) from:

```js
eventBus.subscribe(EVENTS.INPUT_MOUSE_MOVE, (e) => {
  hoverTileX = e.tileX;
  hoverTileY = e.tileY;
  tooltip.show(e.screenX, e.screenY, e.worldX, e.worldY);
});
```

to:

```js
eventBus.subscribe(EVENTS.INPUT_MOUSE_MOVE, (e) => {
  hoverTileX = e.tileX;
  hoverTileY = e.tileY;
  if (gameStateManager.state === GAME_STATES.PLAYING) {
    tooltip.show(e.screenX, e.screenY, e.worldX, e.worldY);
  } else {
    tooltip.hide();
  }
});
```

Note: `GAME_STATES` is already imported at line 3: `import { GameStateManager, GAME_STATES } from './core/GameStateManager.js';`

- [ ] **Step 2: Run all tests**

Run: `npm test`
Expected: All PASS

- [ ] **Step 3: Commit**

```bash
git add src/main.js
git commit -m "fix: hide tooltip during pause, game over, and menu overlays"
```

---

### Task 4: Drag-to-Dig — Constants and InputManager

Add the new events to constants and implement drag tracking in InputManager.

**Files:**
- Modify: `src/constants.js:259-287` (EVENTS object)
- Modify: `src/input/InputManager.js` (add drag tracking)

- [ ] **Step 1: Add new events to constants**

In `src/constants.js`, add two entries to the `EVENTS` object (after `INPUT_SCROLL` at line 281):

```js
  INPUT_SCROLL: 'input:scroll',
  INPUT_DRAG: 'input:drag',
  INPUT_MOUSE_UP: 'input:mouse_up',
```

- [ ] **Step 2: Add drag tracking to InputManager**

In `src/input/InputManager.js`, add these fields to the constructor (after `this._lastMouseY = 0;` at line 21):

```js
    this._leftMouseDown = false;
    this._lastDragTileX = -1;
    this._lastDragTileY = -1;
```

In `_bindEvents()`, add a left-mouse `mousedown` handler. Update the existing `mousedown` handler (lines 66-73) to also track left button:

```js
    this._canvas.addEventListener('mousedown', (e) => {
      if (e.button === 0) {
        this._leftMouseDown = true;
        this._lastDragTileX = -1;
        this._lastDragTileY = -1;
      }
      if (e.button === 1) {
        this._middleMouseDown = true;
        this._lastMouseX = e.clientX;
        this._lastMouseY = e.clientY;
        e.preventDefault();
      }
    });
```

Update the existing `mouseup` handler on `window` (lines 75-79) to also track left button and publish `INPUT_MOUSE_UP`:

```js
    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) {
        this._leftMouseDown = false;
        this._eventBus.publish(EVENTS.INPUT_MOUSE_UP, {});
      }
      if (e.button === 1) {
        this._middleMouseDown = false;
      }
    });
```

In the existing `mousemove` handler (lines 47-63), add drag publishing after the `INPUT_MOUSE_MOVE` publish. Insert after line 63 (before the closing `});`):

```js
      // Drag-to-dig: publish INPUT_DRAG when left button held and tile changes
      if (this._leftMouseDown) {
        const dragTileX = Math.floor(wx / TILE_SIZE);
        const dragTileY = Math.floor(wy / TILE_SIZE);
        if (dragTileX !== this._lastDragTileX || dragTileY !== this._lastDragTileY) {
          this._lastDragTileX = dragTileX;
          this._lastDragTileY = dragTileY;
          this._eventBus.publish(EVENTS.INPUT_DRAG, {
            screenX: e.clientX, screenY: e.clientY,
            worldX: wx, worldY: wy,
            tileX: dragTileX, tileY: dragTileY,
          });
        }
      }
```

Note: `EVENTS` is already imported at line 1.

- [ ] **Step 3: Run all tests**

Run: `npm test`
Expected: All PASS

- [ ] **Step 4: Commit**

```bash
git add src/constants.js src/input/InputManager.js
git commit -m "feat: add INPUT_DRAG and INPUT_MOUSE_UP events for drag-to-dig"
```

---

### Task 5: Drag-to-Dig — main.js Wiring

Wire up the new events in main.js to mark dig jobs while dragging.

**Files:**
- Modify: `src/main.js` (add drag subscriptions after existing click handler)

- [ ] **Step 1: Add drag state and subscriptions**

In `src/main.js`, add a drag session set after `let hoverTileY = -1;` (line 109):

```js
/** @type {Set<string>} tiles marked during current drag session */
const dragDiggedTiles = new Set();
```

Add the `INPUT_DRAG` subscription after the `INPUT_CLICK` handler (after line 252). This handler reuses the same dig logic as the click handler:

```js
// Drag-to-dig: mark tiles while left mouse held
eventBus.subscribe(EVENTS.INPUT_DRAG, (e) => {
  if (activeTool !== 'dig') return;
  if (spellSystem.isPossessing) return;
  if (gameStateManager.state !== GAME_STATES.PLAYING) return;

  const key = `${e.tileX},${e.tileY}`;
  if (dragDiggedTiles.has(key)) return;

  if (world.isDiggable(e.tileX, e.tileY)) {
    const neighbors = world.getNeighbors(e.tileX, e.tileY);
    const hasWalkableNeighbor = neighbors.some(n => world.isWalkable(n.x, n.y));
    if (hasWalkableNeighbor) {
      jobQueue.addDigJob(e.tileX, e.tileY);
      Pathfinder.clearCache();
      dragDiggedTiles.add(key);
    }
  }
});

// Clear drag session on mouse up
eventBus.subscribe(EVENTS.INPUT_MOUSE_UP, () => {
  dragDiggedTiles.clear();
});
```

- [ ] **Step 2: Run all tests**

Run: `npm test`
Expected: All PASS

- [ ] **Step 3: Commit**

```bash
git add src/main.js
git commit -m "feat: wire drag-to-dig — hold left mouse to paint dig marks"
```

---

### Task 6: Hero Edge Spawn — WaveManager

Change `_findSpawnPoint` to always return a map edge tile.

**Files:**
- Modify: `src/systems/WaveManager.js:79-106` (`_findSpawnPoint` method)
- Modify: `tests/systems/WaveManager.test.js` (update spawn test)

- [ ] **Step 1: Write test for edge spawn**

Add a new test to `tests/systems/WaveManager.test.js`:

```js
it('spawns heroes at map edge tiles', () => {
  waveManager.update(WAVE.INTERVAL_SEC);
  const heroes = [
    ...entityManager.getByType(ENTITY_TYPES.KNIGHT),
    ...entityManager.getByType(ENTITY_TYPES.THIEF),
    ...entityManager.getByType(ENTITY_TYPES.WIZARD),
  ];
  expect(heroes.length).toBeGreaterThan(0);
  for (const hero of heroes) {
    const tx = Math.floor(hero.x / TILE_SIZE);
    const ty = Math.floor(hero.y / TILE_SIZE);
    const onEdge = tx <= 1 || ty <= 1 || tx >= world.width - 2 || ty >= world.height - 2;
    expect(onEdge).toBe(true);
  }
});
```

Add `TILE_SIZE` to the imports at line 7: `import { TILE_TYPES, ENTITY_TYPES, EVENTS, WAVE, TILE_SIZE } from '../../src/constants.js';`

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/systems/WaveManager.test.js -t "spawns heroes at map edge tiles"`
Expected: FAIL — heroes currently spawn near center walkable tiles.

- [ ] **Step 3: Rewrite `_findSpawnPoint`**

In `src/systems/WaveManager.js`, replace the `_findSpawnPoint` method (lines 79-106) with:

```js
  _findSpawnPoint() {
    const w = this._world.width;
    const h = this._world.height;
    const edge = Math.floor(Math.random() * 4);

    let x, y;
    switch (edge) {
      case 0: x = Math.floor(Math.random() * w); y = 0; break;        // top
      case 1: x = Math.floor(Math.random() * w); y = h - 1; break;    // bottom
      case 2: x = 0; y = Math.floor(Math.random() * h); break;        // left
      default: x = w - 1; y = Math.floor(Math.random() * h); break;   // right
    }
    return { x, y };
  }
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run tests/systems/WaveManager.test.js`
Expected: All PASS

- [ ] **Step 5: Commit**

```bash
git add src/systems/WaveManager.js tests/systems/WaveManager.test.js
git commit -m "feat: spawn heroes at map edges instead of nearest walkable tile"
```

---

### Task 7: Hero Wall-Digging Behavior

Add digging through walls to Hero base class when no path exists.

**Files:**
- Modify: `src/constants.js:193-200` (WAVE object — add `HERO_DIG_TIME_SEC`)
- Modify: `src/entities/Hero.js` (add dig behavior)
- Modify: `tests/entities/Knight.test.js` (add dig test)

- [ ] **Step 1: Add `HERO_DIG_TIME_SEC` constant**

In `src/constants.js`, add to the `WAVE` object (after line 199):

```js
export const WAVE = Object.freeze({
  INTERVAL_SEC: 90,
  KNIGHT_PER_WAVE: 1,
  THIEF_PER_WAVE: 0.5,
  WIZARD_PER_WAVE: 0.3,
  REPATH_INTERVAL_SEC: 3,
  TOTAL_WAVES: 10,
  HERO_DIG_TIME_SEC: 4,
});
```

- [ ] **Step 2: Write test for hero digging**

Add to `tests/entities/Knight.test.js` (import `EVENTS` in the imports at line 8):

```js
it('digs through walls when no path exists', () => {
  // Place knight on a tile surrounded by walls (no path to heart)
  const edgeX = 2;
  const edgeY = 2;
  world.setTile(edgeX, edgeY, TILE_TYPES.UNCLAIMED_FLOOR);
  // Ensure no walkable neighbors connect to the heart
  const knight = new Knight(
    edgeX * TILE_SIZE + TILE_SIZE / 2,
    edgeY * TILE_SIZE + TILE_SIZE / 2,
    world, eventBus, entityManager, roomManager
  );

  // No path should exist (isolated tile)
  expect(knight.state).toBe(CREATURE_STATES.DIGGING);

  // Update for HERO_DIG_TIME_SEC to complete one dig
  const spy = vi.fn();
  eventBus.subscribe(EVENTS.TILE_CHANGED, spy);

  for (let t = 0; t < WAVE.HERO_DIG_TIME_SEC; t += 0.016) {
    knight.update(0.016);
  }
  knight.update(0.016); // one extra tick to trigger

  // Should have dug at least one adjacent tile
  expect(spy).toHaveBeenCalled();
});
```

Add `vi` to the imports: `import { describe, it, expect, beforeEach, vi } from 'vitest';`

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run tests/entities/Knight.test.js -t "digs through walls"`
Expected: FAIL — Hero has no dig behavior yet.

- [ ] **Step 4: Implement hero dig behavior**

In `src/entities/Hero.js`, add new imports at line 1:

```js
import { Entity } from './Entity.js';
import { Pathfinder } from '../world/Pathfinder.js';
import { CREATURE_STATES, TILE_SIZE, TILE_TYPES, WAVE, ENTITY_TYPES, EVENTS } from '../constants.js';
```

Add dig state fields to the constructor (after `this._attackingDoor = null;` at line 32):

```js
    this._digTimer = 0;
    this._digTargetX = -1;
    this._digTargetY = -1;
```

Replace the `_repath` method (lines 66-68) with:

```js
  /** Override in subclasses for different targeting. */
  _repath() {
    this._pathToDungeonHeart();
    // If no path found, enter digging state
    if (!this._path) {
      this.state = CREATURE_STATES.DIGGING;
      this._pickDigTarget();
    } else if (this.state === CREATURE_STATES.DIGGING) {
      this.state = CREATURE_STATES.MOVING;
      this._digTimer = 0;
    }
  }
```

Add new methods after `_checkForDoor()` (after line 121):

```js
  /** Pick the adjacent wall tile closest to the dungeon heart center. */
  _pickDigTarget() {
    const heartCx = Math.floor(this._world.width / 2);
    const heartCy = Math.floor(this._world.height / 2);
    const { tx, ty } = this.getTile(TILE_SIZE);
    const neighbors = [
      { x: tx - 1, y: ty },
      { x: tx + 1, y: ty },
      { x: tx, y: ty - 1 },
      { x: tx, y: ty + 1 },
    ];

    let best = null;
    let bestDist = Infinity;
    for (const n of neighbors) {
      if (!this._world.inBounds(n.x, n.y)) continue;
      if (this._world.isWalkable(n.x, n.y)) continue; // skip already walkable
      const tile = this._world.getTile(n.x, n.y);
      if (tile === TILE_TYPES.LAVA || tile === TILE_TYPES.WATER || tile === TILE_TYPES.ROCK) continue;
      const dist = Math.abs(n.x - heartCx) + Math.abs(n.y - heartCy);
      if (dist < bestDist) {
        bestDist = dist;
        best = n;
      }
    }
    if (best) {
      this._digTargetX = best.x;
      this._digTargetY = best.y;
      this._digTimer = 0;
    }
  }

  /** Process one tick of wall-digging. */
  _updateDigging(dt) {
    if (this._digTargetX < 0) {
      this._pickDigTarget();
      if (this._digTargetX < 0) {
        // No diggable neighbor — try re-pathing
        this._repath();
        return;
      }
    }

    this._digTimer += dt;
    if (this._digTimer >= WAVE.HERO_DIG_TIME_SEC) {
      // Dig the tile
      this._world.setTile(this._digTargetX, this._digTargetY, TILE_TYPES.UNCLAIMED_FLOOR);
      this._eventBus.publish(EVENTS.TILE_CHANGED, {
        x: this._digTargetX,
        y: this._digTargetY,
        type: TILE_TYPES.UNCLAIMED_FLOOR,
      });
      Pathfinder.clearCache();

      // Move hero to the newly dug tile
      this.x = this._digTargetX * TILE_SIZE + TILE_SIZE / 2;
      this.y = this._digTargetY * TILE_SIZE + TILE_SIZE / 2;

      // Reset and try to repath
      this._digTimer = 0;
      this._digTargetX = -1;
      this._digTargetY = -1;
      this._repath();
    }
  }
```

Update the `update(dt)` method (lines 37-63) to handle the DIGGING state. Add at the beginning of `update()`, before the repath timer:

```js
  update(dt) {
    // Digging state: dig through walls toward heart
    if (this.state === CREATURE_STATES.DIGGING) {
      this._repathTimer += dt;
      if (this._repathTimer >= WAVE.REPATH_INTERVAL_SEC) {
        this._repathTimer = 0;
        this._repath(); // check if a path opened up
      }
      if (this.state === CREATURE_STATES.DIGGING) {
        this._updateDigging(dt);
      }
      return;
    }

    this._repathTimer += dt;
    if (this._repathTimer >= WAVE.REPATH_INTERVAL_SEC) {
      this._repathTimer = 0;
      this._repath();
    }

    // Check for door blocking path
    const door = this._checkForDoor();
    if (door) {
      this._attackingDoor = door;
      this.state = CREATURE_STATES.ATTACKING;
      this._facingRight = door.x > this.x;
      return; // Stop moving, CombatSystem handles damage
    }

    if (this._attackingDoor) {
      if (!this._attackingDoor.alive) {
        this._attackingDoor = null;
        this.state = CREATURE_STATES.MOVING;
      } else {
        return; // Still attacking door
      }
    }

    this._followPath(dt);
  }
```

- [ ] **Step 5: Run tests**

Run: `npx vitest run tests/entities/Knight.test.js`
Expected: All PASS

- [ ] **Step 6: Run full test suite**

Run: `npm test`
Expected: All PASS

- [ ] **Step 7: Commit**

```bash
git add src/constants.js src/entities/Hero.js tests/entities/Knight.test.js
git commit -m "feat: heroes dig through walls from map edges toward dungeon heart"
```

---

### Task 8: Final Verification

Run the full test suite and verify the game works end-to-end in the browser.

- [ ] **Step 1: Run full test suite**

Run: `npm test`
Expected: All PASS, zero failures.

- [ ] **Step 2: Manual browser verification**

Start the dev server: `npm run dev`

Verify in browser:
1. HUD shows 500 gold and 200 mana at game start
2. Hold left mouse and drag across dirt tiles — multiple tiles get marked for digging
3. Pause (P) hides tooltip
4. Wait for wave 1 — heroes appear at map edges and dig through walls
5. Play until game over — Time stat shows correct elapsed time

- [ ] **Step 3: Commit any test fixes if needed**
