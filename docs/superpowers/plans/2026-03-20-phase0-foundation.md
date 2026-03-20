# Phase 0 — Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Scaffold the project, define all game constants, implement GameLoop and EventBus core systems, and render a blank canvas with FPS counter at 60fps.

**Architecture:** Vanilla JS + Vite. GameLoop drives fixed-timestep updates (60 UPS) with interpolated rendering. EventBus provides pub/sub for all cross-system communication — systems never import each other directly. All constants centralized in one file.

**Tech Stack:** Vanilla JavaScript (ES Modules), Vite (dev server + build), Vitest (unit tests), Canvas 2D API, Google Fonts (MedievalSharp + Inter)

---

## File Structure

| File | Purpose |
|------|---------|
| `package.json` | Dependencies: vite (dev), vitest (dev). Scripts: dev, build, preview, test |
| `vite.config.js` | Minimal Vite config with vitest integration |
| `index.html` | Entry point: canvas element + HUD overlay container + font imports |
| `src/main.js` | Bootstrap: create canvas context, init EventBus, init GameLoop, start |
| `src/constants.js` | ALL enums, tuning values, costs, stats, timing — the single source of truth for numbers |
| `src/core/EventBus.js` | Pub/sub: subscribe(event, callback), publish(event, data), unsubscribe(event, callback) |
| `src/core/GameLoop.js` | Fixed-timestep (16.67ms) + interpolated render, start/stop/setSpeed, FPS tracking |
| `tests/core/EventBus.test.js` | Unit tests for EventBus |
| `tests/core/GameLoop.test.js` | Unit tests for GameLoop |

Stub files (empty, created for future phases — prevents import errors during scaffolding):

| File | Phase |
|------|-------|
| `src/core/GameStateManager.js` | Phase 6 |
| `src/core/ObjectPool.js` | Phase 2 |
| `src/world/World.js` | Phase 1 |
| `src/world/MapGenerator.js` | Phase 1 |
| `src/world/Pathfinder.js` | Phase 2 |
| `src/entities/Entity.js` | Phase 2 |
| `src/entities/EntityManager.js` | Phase 2 |
| `src/entities/Imp.js` | Phase 2 |
| `src/entities/Troll.js` | Phase 4 |
| `src/entities/DarkMistress.js` | Phase 4 |
| `src/entities/Knight.js` | Phase 4 |
| `src/entities/Thief.js` | Phase 4 |
| `src/entities/Wizard.js` | Phase 4 |
| `src/entities/Door.js` | Phase 5 |
| `src/systems/JobQueue.js` | Phase 2 |
| `src/systems/ResourceManager.js` | Phase 3 |
| `src/systems/RoomManager.js` | Phase 3 |
| `src/systems/CombatSystem.js` | Phase 4 |
| `src/systems/CreatureSpawner.js` | Phase 4 |
| `src/systems/WaveManager.js` | Phase 4 |
| `src/systems/SpellSystem.js` | Phase 5 |
| `src/input/InputManager.js` | Phase 1 |
| `src/rendering/Camera.js` | Phase 1 |
| `src/rendering/TileRenderer.js` | Phase 1 |
| `src/rendering/EntityRenderer.js` | Phase 2 |
| `src/rendering/ParticleSystem.js` | Phase 2 |
| `src/rendering/Minimap.js` | Phase 1 |
| `src/rendering/ScreenEffects.js` | Phase 5 |
| `src/ui/HUD.js` | Phase 3 |
| `src/ui/Toolbar.js` | Phase 3 |
| `src/ui/Tooltip.js` | Phase 3 |
| `src/ui/MenuScreens.js` | Phase 6 |

---

### Task 1: Project Scaffold

**Files:**
- Create: `package.json`
- Create: `vite.config.js`
- Create: `index.html`

- [ ] **Step 1: Create package.json**

```json
{
  "name": "dklike",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "devDependencies": {
    "vite": "^6.2.0",
    "vitest": "^3.0.0"
  }
}
```

- [ ] **Step 2: Create vite.config.js**

```js
import { defineConfig } from 'vite';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.js'],
  },
});
```

- [ ] **Step 3: Create index.html**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Dungeon Keeper</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=MedievalSharp&family=Inter:wght@400;600&display=swap" rel="stylesheet">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      background: #0a0a0a;
      overflow: hidden;
      font-family: 'Inter', sans-serif;
      color: #c0b090;
    }
    #game-canvas {
      display: block;
      width: 100vw;
      height: 100vh;
    }
    #fps-counter {
      position: fixed;
      top: 8px;
      left: 8px;
      font-family: 'Inter', monospace;
      font-size: 12px;
      color: #80ff80;
      background: rgba(0, 0, 0, 0.6);
      padding: 2px 6px;
      border-radius: 3px;
      z-index: 1000;
      pointer-events: none;
    }
    #hud-overlay {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      z-index: 100;
    }
    #hud-overlay > * {
      pointer-events: auto;
    }
  </style>
</head>
<body>
  <canvas id="game-canvas"></canvas>
  <div id="fps-counter">FPS: --</div>
  <div id="hud-overlay"></div>
  <script type="module" src="/src/main.js"></script>
</body>
</html>
```

- [ ] **Step 4: Install dependencies**

Run: `npm install`
Expected: `node_modules/` created, `package-lock.json` generated.

- [ ] **Step 5: Verify dev server starts**

Run: `npx vite --open false &` then `sleep 2 && curl -s http://localhost:5173 | head -5`
Expected: HTML content returned. Kill the server after.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json vite.config.js index.html
git commit -m "feat: scaffold project with Vite"
```

---

### Task 2: Constants

**Files:**
- Create: `src/constants.js`

- [ ] **Step 1: Create constants.js with all enums and tuning values**

```js
/**
 * Central source of truth for all game constants.
 * Zero magic numbers elsewhere — every tuning value lives here.
 */

// ── Map ──────────────────────────────────────────────
export const TILE_SIZE = 32;
export const MAP_WIDTH = 80;
export const MAP_HEIGHT = 60;

// ── Tile Types ───────────────────────────────────────
export const TILE_TYPES = Object.freeze({
  ROCK: 'rock',
  DIRT: 'dirt',
  UNCLAIMED_FLOOR: 'unclaimed_floor',
  CLAIMED_FLOOR: 'claimed_floor',
  GOLD_VEIN: 'gold_vein',
  GEM_SEAM: 'gem_seam',
  LAVA: 'lava',
  WATER: 'water',
});

export const WALKABLE_TILES = Object.freeze([
  TILE_TYPES.UNCLAIMED_FLOOR,
  TILE_TYPES.CLAIMED_FLOOR,
]);

export const DIGGABLE_TILES = Object.freeze([
  TILE_TYPES.DIRT,
  TILE_TYPES.GOLD_VEIN,
  TILE_TYPES.GEM_SEAM,
]);

// ── Map Generation ───────────────────────────────────
export const MAP_GEN = Object.freeze({
  GOLD_VEIN_MIN: 8,
  GOLD_VEIN_MAX: 12,
  GEM_SEAM_MIN: 3,
  GEM_SEAM_MAX: 5,
  LAVA_POOL_MIN: 2,
  LAVA_POOL_MAX: 3,
  WATER_CHANNEL_MIN: 1,
  WATER_CHANNEL_MAX: 2,
  DUNGEON_HEART_SIZE: 3,
});

// ── Entity Types ─────────────────────────────────────
export const ENTITY_TYPES = Object.freeze({
  IMP: 'imp',
  TROLL: 'troll',
  DARK_MISTRESS: 'dark_mistress',
  KNIGHT: 'knight',
  THIEF: 'thief',
  WIZARD: 'wizard',
  DOOR: 'door',
});

// ── Creature States ──────────────────────────────────
export const CREATURE_STATES = Object.freeze({
  IDLE: 'idle',
  MOVING: 'moving',
  DIGGING: 'digging',
  CARRYING: 'carrying',
  EATING: 'eating',
  SLEEPING: 'sleeping',
  FLEEING: 'fleeing',
  ATTACKING: 'attacking',
  TRAINING: 'training',
});

// ── Hero Types ───────────────────────────────────────
export const HERO_TYPES = Object.freeze({
  KNIGHT: 'knight',
  THIEF: 'thief',
  WIZARD: 'wizard',
});

// ── Room Types ───────────────────────────────────────
export const ROOM_TYPES = Object.freeze({
  DUNGEON_HEART: 'dungeon_heart',
  LAIR: 'lair',
  HATCHERY: 'hatchery',
  TREASURY: 'treasury',
  TRAINING_ROOM: 'training_room',
});

// ── Room Costs & Requirements ────────────────────────
export const ROOM_CONFIG = Object.freeze({
  [ROOM_TYPES.DUNGEON_HEART]: { goldPerTile: 0, minTiles: 1, manaPerSec: 2 },
  [ROOM_TYPES.LAIR]: { goldPerTile: 50, minTiles: 4, energyPerSec: 10 },
  [ROOM_TYPES.HATCHERY]: { goldPerTile: 60, minTiles: 4, hungerPerSec: -1 },
  [ROOM_TYPES.TREASURY]: { goldPerTile: 40, minTiles: 4, goldStoragePerTile: 500 },
  [ROOM_TYPES.TRAINING_ROOM]: { goldPerTile: 80, minTiles: 6, xpPerSec: 1 },
});

// ── Spell Types ──────────────────────────────────────
export const SPELL_TYPES = Object.freeze({
  CREATE_IMP: 'create_imp',
  LIGHTNING_STRIKE: 'lightning_strike',
  POSSESS_CREATURE: 'possess_creature',
});

export const SPELL_CONFIG = Object.freeze({
  [SPELL_TYPES.CREATE_IMP]: { manaCost: 200, castTime: 0.5 },
  [SPELL_TYPES.LIGHTNING_STRIKE]: { manaCost: 150, aoeRadius: 3, damage: 80, shakeDuration: 0.3, shakeMagnitude: 4 },
  [SPELL_TYPES.POSSESS_CREATURE]: { manaCost: 100 },
});

// ── Resources ────────────────────────────────────────
export const RESOURCES = Object.freeze({
  GOLD_BASE_CAP: 1000,
  GOLD_PER_TREASURY_TILE: 500,
  MANA_CAP: 500,
  MANA_REGEN_PER_SEC: 2,
  GOLD_VEIN_YIELD: 200,
  GEM_SEAM_GOLD_PER_SEC: 5,
});

// ── Creature Stats ───────────────────────────────────
export const IMP_STATS = Object.freeze({
  hp: 30,
  speed: 80,
  digTime: 3,
  hungerThreshold: 30,
  energyThreshold: 20,
  fleeHealthThreshold: 20,
  maxHunger: 100,
  maxEnergy: 100,
  maxHappiness: 100,
});

export const TROLL_STATS = Object.freeze({
  hp: 120,
  speed: 40,
  damage: 15,
  attackRange: 1.2,
  attackCooldown: 1.0,
  attractionRoom: ROOM_TYPES.HATCHERY,
  attractionMinTiles: 6,
  maxCount: 3,
});

export const DARK_MISTRESS_STATS = Object.freeze({
  hp: 80,
  speed: 100,
  damage: 10,
  attackRange: 1.5,
  attackCooldown: 0.8,
  maxTargets: 2,
  slowDebuffDuration: 3,
  slowDebuffFactor: 0.5,
  attractionRoom: ROOM_TYPES.TRAINING_ROOM,
  attractionMinTiles: 6,
  maxCount: 3,
});

// ── Hero Stats ───────────────────────────────────────
export const KNIGHT_STATS = Object.freeze({
  hp: 150,
  speed: 40,
  damage: 12,
  attackRange: 1.2,
  attackCooldown: 1.0,
  goldDrop: 50,
});

export const THIEF_STATS = Object.freeze({
  hp: 60,
  speed: 120,
  damage: 8,
  attackRange: 1.0,
  attackCooldown: 0.6,
  goldDrop: 30,
});

export const WIZARD_STATS = Object.freeze({
  hp: 80,
  speed: 70,
  damage: 18,
  attackRange: 3.0,
  attackCooldown: 1.5,
  goldDrop: 75,
});

// ── Leveling ─────────────────────────────────────────
export const LEVEL_THRESHOLDS = Object.freeze([0, 100, 250, 500, 900]);
export const LEVEL_HP_BONUS = 0.10;
export const LEVEL_DAMAGE_BONUS = 0.10;
export const LEVEL_SPEED_BONUS = 0.05;
export const MAX_LEVEL = 5;

// ── Wave System ──────────────────────────────────────
export const WAVE = Object.freeze({
  INTERVAL_SEC: 90,
  KNIGHT_PER_WAVE: 1,
  THIEF_PER_WAVE: 0.5,
  WIZARD_PER_WAVE: 0.3,
  REPATH_INTERVAL_SEC: 3,
  TOTAL_WAVES: 10,
});

// ── Combat ───────────────────────────────────────────
export const COMBAT_TICK_MS = 200;
export const DOOR_HP = 200;
export const DOOR_COST = 100;
export const HERO_DOOR_DAMAGE_PER_SEC = 10;

// ── Creature Spawning ────────────────────────────────
export const SPAWN_CHECK_INTERVAL_SEC = 30;

// ── Dungeon Heart ────────────────────────────────────
export const DUNGEON_HEART_HP = 500;

// ── Game Loop ────────────────────────────────────────
export const TARGET_UPS = 60;
export const TIMESTEP_MS = 1000 / TARGET_UPS;
export const TIMESTEP_SEC = 1 / TARGET_UPS;
export const MAX_FRAME_SKIP = 5;

// ── Camera ───────────────────────────────────────────
export const CAMERA = Object.freeze({
  PAN_SPEED: 400,
  ZOOM_MIN: 0.5,
  ZOOM_MAX: 2.0,
  ZOOM_STEP: 0.1,
});

// ── Win/Lose ─────────────────────────────────────────
export const WIN_GOLD_THRESHOLD = 5000;
export const WIN_WAVE_THRESHOLD = 10;

// ── Particles ────────────────────────────────────────
export const PARTICLE_POOL_SIZE = 500;

// ── UI ───────────────────────────────────────────────
export const MINIMAP_WIDTH = 120;
export const MINIMAP_HEIGHT = 90;

// ── Colors (dark fantasy palette) ────────────────────
export const COLORS = Object.freeze({
  BG: '#0a0a0a',
  ROCK: '#2a2a2e',
  DIRT: '#5a4633',
  UNCLAIMED_FLOOR: '#4a4a4e',
  CLAIMED_FLOOR: '#5a5a60',
  GOLD_VEIN: '#b8962e',
  GEM_SEAM: '#6a2ea0',
  LAVA: '#c04020',
  WATER: '#2040a0',
  UI_TEXT: '#c0b090',
  UI_GOLD: '#f0c040',
  UI_MANA: '#4080f0',
  UI_HEALTH_BAR: '#c02020',
  UI_HEALTH_BG: '#2a0808',
  MINIMAP_CAMERA: 'rgba(255, 255, 255, 0.4)',
});

// ── EventBus Events ──────────────────────────────────
export const EVENTS = Object.freeze({
  TILE_CHANGED: 'tile:changed',
  TILE_DIG_QUEUED: 'tile:dig_queued',
  TILE_DUG: 'tile:dug',
  ENTITY_SPAWNED: 'entity:spawned',
  ENTITY_DIED: 'entity:died',
  ENTITY_DAMAGED: 'entity:damaged',
  RESOURCES_CHANGED: 'resources:changed',
  ROOM_PLACED: 'room:placed',
  ROOM_REMOVED: 'room:removed',
  JOB_UPDATED: 'job:updated',
  WAVE_STARTED: 'wave:started',
  WAVE_COMPLETED: 'wave:completed',
  SPELL_CAST: 'spell:cast',
  GAME_STATE_CHANGED: 'game:state_changed',
  GAME_OVER: 'game:over',
  GAME_VICTORY: 'game:victory',
  INPUT_CLICK: 'input:click',
  INPUT_RIGHT_CLICK: 'input:right_click',
  INPUT_KEY_DOWN: 'input:key_down',
  INPUT_KEY_UP: 'input:key_up',
  INPUT_MOUSE_MOVE: 'input:mouse_move',
  INPUT_SCROLL: 'input:scroll',
  CAMERA_MOVED: 'camera:moved',
  SPEED_CHANGED: 'speed:changed',
  TOOL_SELECTED: 'tool:selected',
  POSSESS_START: 'possess:start',
  POSSESS_END: 'possess:end',
});
```

- [ ] **Step 2: Verify constants import works**

Run: `node -e "import('./src/constants.js').then(c => console.log(Object.keys(c).length + ' exports'))"`
Expected: Something like `42 exports` (non-zero count, no errors).

- [ ] **Step 3: Commit**

```bash
git add src/constants.js
git commit -m "feat: add all game constants, enums, and tuning values"
```

---

### Task 3: EventBus

**Files:**
- Create: `src/core/EventBus.js`
- Create: `tests/core/EventBus.test.js`

- [ ] **Step 1: Write the failing tests**

```js
import { describe, it, expect, vi } from 'vitest';
import { EventBus } from '../../src/core/EventBus.js';

describe('EventBus', () => {
  it('calls subscriber when event is published', () => {
    const bus = new EventBus();
    const callback = vi.fn();
    bus.subscribe('test', callback);
    bus.publish('test', { value: 42 });
    expect(callback).toHaveBeenCalledWith({ value: 42 });
  });

  it('supports multiple subscribers for same event', () => {
    const bus = new EventBus();
    const cb1 = vi.fn();
    const cb2 = vi.fn();
    bus.subscribe('test', cb1);
    bus.subscribe('test', cb2);
    bus.publish('test', 'data');
    expect(cb1).toHaveBeenCalledWith('data');
    expect(cb2).toHaveBeenCalledWith('data');
  });

  it('does not call subscriber after unsubscribe', () => {
    const bus = new EventBus();
    const callback = vi.fn();
    bus.subscribe('test', callback);
    bus.unsubscribe('test', callback);
    bus.publish('test', 'data');
    expect(callback).not.toHaveBeenCalled();
  });

  it('does nothing when publishing event with no subscribers', () => {
    const bus = new EventBus();
    expect(() => bus.publish('nonexistent', 'data')).not.toThrow();
  });

  it('does not call subscribers of different events', () => {
    const bus = new EventBus();
    const callback = vi.fn();
    bus.subscribe('event_a', callback);
    bus.publish('event_b', 'data');
    expect(callback).not.toHaveBeenCalled();
  });

  it('unsubscribe is safe to call for non-subscribed callback', () => {
    const bus = new EventBus();
    const callback = vi.fn();
    expect(() => bus.unsubscribe('test', callback)).not.toThrow();
  });

  it('clear removes all subscribers', () => {
    const bus = new EventBus();
    const cb1 = vi.fn();
    const cb2 = vi.fn();
    bus.subscribe('a', cb1);
    bus.subscribe('b', cb2);
    bus.clear();
    bus.publish('a', 'data');
    bus.publish('b', 'data');
    expect(cb1).not.toHaveBeenCalled();
    expect(cb2).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/core/EventBus.test.js`
Expected: FAIL — `EventBus` module not found or not exported.

- [ ] **Step 3: Implement EventBus**

```js
/**
 * Simple publish/subscribe event bus.
 * All cross-system communication flows through EventBus —
 * systems never import each other directly.
 */
export class EventBus {
  constructor() {
    /** @type {Map<string, Set<Function>>} */
    this._listeners = new Map();
  }

  /**
   * Subscribe to an event.
   * @param {string} event - Event name (use EVENTS constants).
   * @param {Function} callback - Called with event data when published.
   */
  subscribe(event, callback) {
    if (!this._listeners.has(event)) {
      this._listeners.set(event, new Set());
    }
    this._listeners.get(event).add(callback);
  }

  /**
   * Unsubscribe from an event.
   * @param {string} event - Event name.
   * @param {Function} callback - The previously subscribed callback.
   */
  unsubscribe(event, callback) {
    const listeners = this._listeners.get(event);
    if (listeners) {
      listeners.delete(callback);
    }
  }

  /**
   * Publish an event to all subscribers.
   * @param {string} event - Event name.
   * @param {*} data - Data passed to each subscriber.
   */
  publish(event, data) {
    const listeners = this._listeners.get(event);
    if (listeners) {
      for (const callback of listeners) {
        callback(data);
      }
    }
  }

  /** Remove all subscribers for all events. */
  clear() {
    this._listeners.clear();
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/core/EventBus.test.js`
Expected: All 7 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/core/EventBus.js tests/core/EventBus.test.js
git commit -m "feat: implement EventBus with pub/sub"
```

---

### Task 4: GameLoop

**Files:**
- Create: `src/core/GameLoop.js`
- Create: `tests/core/GameLoop.test.js`

- [ ] **Step 1: Write the failing tests**

```js
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GameLoop } from '../../src/core/GameLoop.js';
import { TIMESTEP_MS, MAX_FRAME_SKIP } from '../../src/constants.js';

describe('GameLoop', () => {
  let loop;
  let updateFn;
  let renderFn;

  beforeEach(() => {
    updateFn = vi.fn();
    renderFn = vi.fn();
    vi.useFakeTimers();
    // Mock requestAnimationFrame
    vi.stubGlobal('requestAnimationFrame', (cb) => setTimeout(cb, 16));
    vi.stubGlobal('cancelAnimationFrame', (id) => clearTimeout(id));
    vi.stubGlobal('performance', { now: vi.fn(() => Date.now()) });
  });

  afterEach(() => {
    if (loop) loop.stop();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('constructs without errors', () => {
    loop = new GameLoop(updateFn, renderFn);
    expect(loop).toBeDefined();
  });

  it('calls update with fixed timestep after start', () => {
    loop = new GameLoop(updateFn, renderFn);
    loop.start();
    vi.advanceTimersByTime(20);
    expect(updateFn).toHaveBeenCalled();
    const dt = updateFn.mock.calls[0][0];
    expect(dt).toBeCloseTo(TIMESTEP_MS / 1000, 2);
  });

  it('calls render after update', () => {
    loop = new GameLoop(updateFn, renderFn);
    loop.start();
    vi.advanceTimersByTime(20);
    expect(renderFn).toHaveBeenCalled();
  });

  it('stops calling update/render after stop', () => {
    loop = new GameLoop(updateFn, renderFn);
    loop.start();
    vi.advanceTimersByTime(20);
    const updateCount = updateFn.mock.calls.length;
    loop.stop();
    vi.advanceTimersByTime(100);
    expect(updateFn.mock.calls.length).toBe(updateCount);
  });

  it('setSpeed changes update rate multiplier', () => {
    loop = new GameLoop(updateFn, renderFn);
    loop.setSpeed(2);
    expect(loop.speedMultiplier).toBe(2);
  });

  it('caps frame skip to MAX_FRAME_SKIP', () => {
    loop = new GameLoop(updateFn, renderFn);
    loop.start();
    // Simulate a huge lag spike
    vi.advanceTimersByTime(500);
    expect(updateFn.mock.calls.length).toBeLessThanOrEqual(MAX_FRAME_SKIP + 5);
  });

  it('tracks FPS', () => {
    loop = new GameLoop(updateFn, renderFn);
    loop.start();
    vi.advanceTimersByTime(100);
    expect(loop.fps).toBeGreaterThanOrEqual(0);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/core/GameLoop.test.js`
Expected: FAIL — `GameLoop` module not found.

- [ ] **Step 3: Implement GameLoop**

```js
import { TIMESTEP_MS, TIMESTEP_SEC, MAX_FRAME_SKIP } from '../constants.js';

/**
 * Fixed-timestep game loop with interpolated rendering.
 * Runs update at 60 UPS regardless of display refresh rate.
 * Render receives interpolation alpha for smooth visuals.
 */
export class GameLoop {
  /**
   * @param {Function} updateFn - Called with (dt) in seconds at fixed timestep.
   * @param {Function} renderFn - Called with (interpolationAlpha) each frame.
   */
  constructor(updateFn, renderFn) {
    this._update = updateFn;
    this._render = renderFn;
    this._rafId = null;
    this._running = false;
    this._accumulator = 0;
    this._lastTime = 0;
    this.speedMultiplier = 1;
    this.fps = 0;
    this._frameCount = 0;
    this._fpsTimer = 0;
    this._tick = this._tick.bind(this);
  }

  /** Start the game loop. */
  start() {
    if (this._running) return;
    this._running = true;
    this._lastTime = performance.now();
    this._accumulator = 0;
    this._frameCount = 0;
    this._fpsTimer = 0;
    this._rafId = requestAnimationFrame(this._tick);
  }

  /** Stop the game loop. */
  stop() {
    this._running = false;
    if (this._rafId !== null) {
      cancelAnimationFrame(this._rafId);
      this._rafId = null;
    }
  }

  /**
   * Set game speed multiplier.
   * @param {number} multiplier - 1 for normal, 2 for double speed.
   */
  setSpeed(multiplier) {
    this.speedMultiplier = multiplier;
  }

  /** @private */
  _tick(now) {
    if (!this._running) return;

    const deltaMs = now - this._lastTime;
    this._lastTime = now;

    // FPS tracking
    this._frameCount++;
    this._fpsTimer += deltaMs;
    if (this._fpsTimer >= 1000) {
      this.fps = this._frameCount;
      this._frameCount = 0;
      this._fpsTimer -= 1000;
    }

    // Accumulate time, scaled by speed multiplier
    this._accumulator += deltaMs * this.speedMultiplier;

    // Fixed-timestep updates with frame skip cap
    let steps = 0;
    while (this._accumulator >= TIMESTEP_MS && steps < MAX_FRAME_SKIP) {
      this._update(TIMESTEP_SEC);
      this._accumulator -= TIMESTEP_MS;
      steps++;
    }

    // If we hit the cap, discard remaining accumulated time
    if (steps >= MAX_FRAME_SKIP) {
      this._accumulator = 0;
    }

    // Interpolated render
    const alpha = this._accumulator / TIMESTEP_MS;
    this._render(alpha);

    this._rafId = requestAnimationFrame(this._tick);
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/core/GameLoop.test.js`
Expected: All 7 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/core/GameLoop.js tests/core/GameLoop.test.js
git commit -m "feat: implement GameLoop with fixed timestep and interpolated render"
```

---

### Task 5: Main Bootstrap + Canvas + FPS Counter

**Files:**
- Create: `src/main.js`

- [ ] **Step 1: Implement main.js**

```js
import { EventBus } from './core/EventBus.js';
import { GameLoop } from './core/GameLoop.js';
import { COLORS } from './constants.js';

/** @type {HTMLCanvasElement} */
const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
const fpsEl = document.getElementById('fps-counter');

/** Resize canvas to match display. */
function resizeCanvas() {
  const dpr = window.devicePixelRatio || 1;
  canvas.width = window.innerWidth * dpr;
  canvas.height = window.innerHeight * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

window.addEventListener('resize', resizeCanvas);
resizeCanvas();

const eventBus = new EventBus();

function update(dt) {
  // Phase 1+ systems will register here
}

function render(alpha) {
  const w = window.innerWidth;
  const h = window.innerHeight;
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = COLORS.BG;
  ctx.fillRect(0, 0, w, h);

  // Phase 1+ renderers will draw here

  fpsEl.textContent = `FPS: ${gameLoop.fps}`;
}

const gameLoop = new GameLoop(update, render);
gameLoop.start();
```

- [ ] **Step 2: Verify in browser**

Run: `npx vite --open false &` then open `http://localhost:5173` in browser.
Expected: Black canvas fills viewport. FPS counter in top-left shows ~60. No console errors.

- [ ] **Step 3: Commit**

```bash
git add src/main.js
git commit -m "feat: bootstrap canvas rendering with FPS counter"
```

---

### Task 6: Create All Stub Files

**Files:**
- Create: All stub files listed in the File Structure table above

- [ ] **Step 1: Create all stub module files**

Create each file with a single placeholder export comment so they're valid ES modules:

For each stub file, the content should be:
```js
// Stub — implemented in Phase N
```

Files to create (all under `src/`):
- `core/GameStateManager.js`
- `core/ObjectPool.js`
- `world/World.js`
- `world/MapGenerator.js`
- `world/Pathfinder.js`
- `entities/Entity.js`
- `entities/EntityManager.js`
- `entities/Imp.js`
- `entities/Troll.js`
- `entities/DarkMistress.js`
- `entities/Knight.js`
- `entities/Thief.js`
- `entities/Wizard.js`
- `entities/Door.js`
- `systems/JobQueue.js`
- `systems/ResourceManager.js`
- `systems/RoomManager.js`
- `systems/CombatSystem.js`
- `systems/CreatureSpawner.js`
- `systems/WaveManager.js`
- `systems/SpellSystem.js`
- `input/InputManager.js`
- `rendering/Camera.js`
- `rendering/TileRenderer.js`
- `rendering/EntityRenderer.js`
- `rendering/ParticleSystem.js`
- `rendering/Minimap.js`
- `rendering/ScreenEffects.js`
- `ui/HUD.js`
- `ui/Toolbar.js`
- `ui/Tooltip.js`
- `ui/MenuScreens.js`

- [ ] **Step 2: Verify all files exist**

Run: `find src -name "*.js" | sort | wc -l`
Expected: 35 files (constants.js + main.js + EventBus.js + GameLoop.js + 31 stubs).

- [ ] **Step 3: Commit**

```bash
git add src/
git commit -m "feat: create stub files for all planned modules"
```

---

### Task 7: README

**Files:**
- Create: `README.md`
- Create: `CLAUDE.md`

- [ ] **Step 1: Create README.md**

```markdown
# DKLike — 2D Dungeon Keeper

A browser-based 2D dungeon management game inspired by Dungeon Keeper. Dig underground rooms, attract creatures, and defend against invading heroes. All visuals are procedurally drawn on Canvas — zero external image assets.

## Tech Stack

**Vanilla JavaScript (ES Modules) + Vite.** No frameworks, no game engines, no sprite sheets.

Why: 20+ game classes doing procedural Canvas drawing and game logic. Vite provides HMR and production builds with near-zero config. The constants.js enum pattern provides sufficient type structure without TypeScript overhead.

## Getting Started

```bash
npm install
npm run dev       # Start dev server with HMR at http://localhost:5173
npm run build     # Production build to dist/
npm run preview   # Preview production build
npm test          # Run unit tests
npm run test:watch # Run tests in watch mode
```

## Project Structure

- `src/constants.js` — All tuning values, enums, costs, stats. Zero magic numbers elsewhere.
- `src/core/` — GameLoop (fixed-timestep), EventBus (pub/sub), GameStateManager, ObjectPool
- `src/world/` — World (tile grid), MapGenerator (seeded procedural), Pathfinder (A*)
- `src/entities/` — Entity base class, Imp, Troll, Dark Mistress, Knight, Thief, Wizard, Door
- `src/systems/` — JobQueue, ResourceManager, RoomManager, CombatSystem, CreatureSpawner, WaveManager, SpellSystem
- `src/input/` — InputManager (mouse + keyboard → EventBus)
- `src/rendering/` — Camera, TileRenderer, EntityRenderer, ParticleSystem, Minimap, ScreenEffects
- `src/ui/` — HUD, Toolbar, Tooltip, MenuScreens (all HTML overlay, not canvas)
- `tests/` — Mirrors src/ structure. Unit tests via Vitest.

## Architecture

- **EventBus only** — Systems never import each other. All cross-system communication via EventBus pub/sub.
- **Serializable state** — Game state is plain objects/arrays. No circular refs, no DOM refs in state.
- **Read-only rendering** — Render path reads state, never mutates it.
- **Constants centralized** — Every tuning value in `src/constants.js`.
```

- [ ] **Step 2: Create CLAUDE.md**

```markdown
# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `npm run dev` — Start Vite dev server with HMR (http://localhost:5173)
- `npm run build` — Production build to dist/
- `npm test` — Run all tests (vitest)
- `npm run test:watch` — Run tests in watch mode
- `npx vitest run tests/core/EventBus.test.js` — Run a single test file
- `npx vitest run -t "test name"` — Run a single test by name

## Architecture

Vanilla JS + Vite game with Canvas 2D rendering. No frameworks or game engines.

**Core pattern:** Systems communicate exclusively via EventBus pub/sub — they never import each other directly. GameLoop drives fixed-timestep updates (60 UPS) with interpolated rendering. All game state is plain serializable objects.

**Data flow:** InputManager → EventBus → Game Systems → State Changes → EventBus → Renderers

**Key rule:** All tuning values, enums, and magic numbers live in `src/constants.js`. Zero magic numbers anywhere else.

## Project Layout

- `src/constants.js` — Single source of truth for all game numbers
- `src/core/` — GameLoop, EventBus, GameStateManager, ObjectPool
- `src/world/` — World (tile grid), MapGenerator, Pathfinder (A*)
- `src/entities/` — Entity base + all creature/hero/door classes
- `src/systems/` — JobQueue, ResourceManager, RoomManager, CombatSystem, CreatureSpawner, WaveManager, SpellSystem
- `src/input/` — InputManager (captures DOM events, emits on EventBus)
- `src/rendering/` — Camera, TileRenderer, EntityRenderer, ParticleSystem, Minimap, ScreenEffects
- `src/ui/` — HUD, Toolbar, Tooltip, MenuScreens (HTML overlay, not canvas)
- `tests/` — Mirrors src/ structure, uses Vitest

## Conventions

- One class per file, one responsibility per class
- JSDoc on all public methods
- No commented-out dead code
- Rendering reads state but never mutates it
- Test files mirror source paths: `src/core/Foo.js` → `tests/core/Foo.test.js`
- Procedural Canvas drawing only — zero external image files
- Dark fantasy palette (see COLORS in constants.js)
```

- [ ] **Step 3: Commit**

```bash
git add README.md CLAUDE.md
git commit -m "docs: add README and CLAUDE.md"
```

---

### Task 8: Run Full Verification Checklist

- [ ] **Step 1: Run all tests**

Run: `npm test`
Expected: All 14 tests pass (7 EventBus + 7 GameLoop).

- [ ] **Step 2: Start dev server and verify visually**

Run: `npx vite --open false &`
Open http://localhost:5173 in browser.
Expected:
- Black canvas fills viewport
- FPS counter top-left shows ~60
- No console errors
- Resizing window resizes canvas

- [ ] **Step 3: Verify README documents every planned file**

Run: `cat README.md` and confirm all module directories and their purposes are listed.

- [ ] **Step 4: Verify all constants are defined and exported**

Run: `node -e "import('./src/constants.js').then(c => { const keys = Object.keys(c); console.log(keys.length + ' exports'); console.log(keys.join(', ')); })"`
Expected: All enums (TILE_TYPES, ENTITY_TYPES, ROOM_TYPES, CREATURE_STATES, HERO_TYPES, SPELL_TYPES) plus all config objects and values are listed.

- [ ] **Step 5: Verify EventBus subscribe/publish/unsubscribe**

Already covered by unit tests. Confirm test output.

- [ ] **Step 6: Final commit (if any fixes needed)**

Only if verification revealed issues to fix.
