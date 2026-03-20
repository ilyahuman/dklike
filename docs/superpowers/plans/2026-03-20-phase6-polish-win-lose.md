# Phase 6 — Polish, Win/Lose & Final Integration

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the game with win/lose conditions, game state management, pause menu, main menu, victory/defeat screens, performance optimization, and visual polish.

**Architecture:** GameStateManager is a simple state machine (MENU → PLAYING ↔ PAUSED → GAME_OVER/VICTORY). Dungeon Heart HP is tracked in ResourceManager (single source of truth). Spatial hash grid replaces brute-force entity radius queries. Menu/end-game screens are HTML overlays consistent with HUD/Toolbar pattern. All game state transitions use EventBus.

**Tech Stack:** Vanilla JavaScript (ES Modules), Canvas 2D, Vitest for testing.

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `src/core/GameStateManager.js` | Replace stub | State machine: MENU, PLAYING, PAUSED, GAME_OVER, VICTORY |
| `src/core/GameLoop.js` | Modify | Add `pause()`, `resume()`, `isPaused` |
| `src/systems/ResourceManager.js` | Modify | Add Dungeon Heart HP tracking |
| `src/entities/EntityManager.js` | Modify | Add spatial hash grid for `getEntitiesInRadius` |
| `src/ui/MenuScreen.js` | Create | Main menu, game over, victory HTML overlays |
| `src/main.js` | Modify | Wire GameStateManager, win/lose checks, menu screens, restart |
| `src/rendering/TileRenderer.js` | Modify | Add room placement fade-in animation |
| `tests/core/GameStateManager.test.js` | Create | State transition tests |
| `tests/entities/EntityManager.test.js` | Modify | Add spatial hash tests |

**Already done (from earlier phases — no work needed):**
- Lava tile shimmer animation ✅ (TileRenderer)
- Water tile ripple animation ✅ (TileRenderer)
- Gold counter tween animation ✅ (HUD)
- Mana bar smooth fill ✅ (HUD, CSS transition)
- Dungeon Heart pulsing glow ✅ (TileRenderer)
- All creature walk animations ✅ (EntityRenderer)
- ParticleSystem object pooling ✅ (500 pre-allocated)

---

### Task 1: GameStateManager — State Machine

**Files:**
- Replace: `src/core/GameStateManager.js`
- Create: `tests/core/GameStateManager.test.js`

- [ ] **Step 1: Write failing tests**

```js
// tests/core/GameStateManager.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GameStateManager } from '../../src/core/GameStateManager.js';
import { EVENTS } from '../../src/constants.js';

function makeEventBus() {
  return {
    publish: vi.fn(),
    subscribe: vi.fn(),
  };
}

describe('GameStateManager', () => {
  let gsm, eventBus;

  beforeEach(() => {
    eventBus = makeEventBus();
    gsm = new GameStateManager(eventBus);
  });

  it('should start in MENU state', () => {
    expect(gsm.state).toBe('menu');
  });

  it('should transition MENU → PLAYING via startGame()', () => {
    gsm.startGame();
    expect(gsm.state).toBe('playing');
    expect(eventBus.publish).toHaveBeenCalledWith(EVENTS.GAME_STATE_CHANGED, { state: 'playing' });
  });

  it('should transition PLAYING → PAUSED via pause()', () => {
    gsm.startGame();
    gsm.pause();
    expect(gsm.state).toBe('paused');
  });

  it('should transition PAUSED → PLAYING via resume()', () => {
    gsm.startGame();
    gsm.pause();
    gsm.resume();
    expect(gsm.state).toBe('playing');
  });

  it('should transition PLAYING → GAME_OVER via gameOver()', () => {
    gsm.startGame();
    gsm.gameOver();
    expect(gsm.state).toBe('game_over');
    expect(eventBus.publish).toHaveBeenCalledWith(EVENTS.GAME_OVER, expect.any(Object));
  });

  it('should transition PLAYING → VICTORY via victory()', () => {
    gsm.startGame();
    gsm.victory();
    expect(gsm.state).toBe('victory');
    expect(eventBus.publish).toHaveBeenCalledWith(EVENTS.GAME_VICTORY, expect.any(Object));
  });

  it('should not allow invalid transitions', () => {
    gsm.pause(); // Can't pause from MENU
    expect(gsm.state).toBe('menu');
  });

  it('should track stats', () => {
    gsm.startGame();
    gsm.addStat('heroesKilled', 5);
    gsm.addStat('heroesKilled', 3);
    gsm.addStat('goldEarned', 1000);
    expect(gsm.getStat('heroesKilled')).toBe(8);
    expect(gsm.getStat('goldEarned')).toBe(1000);
  });

  it('should include stats in gameOver event', () => {
    gsm.startGame();
    gsm.addStat('heroesKilled', 5);
    gsm.gameOver();
    const call = eventBus.publish.mock.calls.find(c => c[0] === EVENTS.GAME_OVER);
    expect(call[1].stats.heroesKilled).toBe(5);
  });

  it('should reset all state via restart()', () => {
    gsm.startGame();
    gsm.addStat('heroesKilled', 5);
    gsm.restart();
    expect(gsm.state).toBe('menu');
    expect(gsm.getStat('heroesKilled')).toBe(0);
  });

  it('should track elapsed time', () => {
    gsm.startGame();
    gsm.updateTime(1.5);
    gsm.updateTime(2.0);
    expect(gsm.elapsedTime).toBeCloseTo(3.5);
  });
});
```

- [ ] **Step 2: Run tests — expect FAIL**

Run: `npx vitest run tests/core/GameStateManager.test.js`

- [ ] **Step 3: Implement GameStateManager**

```js
// src/core/GameStateManager.js
import { EVENTS } from '../constants.js';

const STATES = Object.freeze({
  MENU: 'menu',
  PLAYING: 'playing',
  PAUSED: 'paused',
  GAME_OVER: 'game_over',
  VICTORY: 'victory',
});

/**
 * Simple state machine for game lifecycle.
 * Manages transitions: MENU → PLAYING ↔ PAUSED → GAME_OVER/VICTORY.
 * Tracks session stats (waves survived, gold earned, etc.).
 */
export class GameStateManager {
  /** @param {import('./EventBus.js').EventBus} eventBus */
  constructor(eventBus) {
    this._eventBus = eventBus;
    this._state = STATES.MENU;
    this._stats = {};
    this._elapsedTime = 0;
    this._resetStats();
  }

  get state() { return this._state; }
  get elapsedTime() { return this._elapsedTime; }

  startGame() {
    if (this._state !== STATES.MENU) return;
    this._state = STATES.PLAYING;
    this._elapsedTime = 0;
    this._resetStats();
    this._eventBus.publish(EVENTS.GAME_STATE_CHANGED, { state: STATES.PLAYING });
  }

  pause() {
    if (this._state !== STATES.PLAYING) return;
    this._state = STATES.PAUSED;
    this._eventBus.publish(EVENTS.GAME_STATE_CHANGED, { state: STATES.PAUSED });
  }

  resume() {
    if (this._state !== STATES.PAUSED) return;
    this._state = STATES.PLAYING;
    this._eventBus.publish(EVENTS.GAME_STATE_CHANGED, { state: STATES.PLAYING });
  }

  gameOver() {
    if (this._state !== STATES.PLAYING && this._state !== STATES.PAUSED) return;
    this._state = STATES.GAME_OVER;
    this._eventBus.publish(EVENTS.GAME_OVER, {
      stats: { ...this._stats },
      elapsedTime: this._elapsedTime,
    });
    this._eventBus.publish(EVENTS.GAME_STATE_CHANGED, { state: STATES.GAME_OVER });
  }

  victory() {
    if (this._state !== STATES.PLAYING) return;
    this._state = STATES.VICTORY;
    this._eventBus.publish(EVENTS.GAME_VICTORY, {
      stats: { ...this._stats },
      elapsedTime: this._elapsedTime,
    });
    this._eventBus.publish(EVENTS.GAME_STATE_CHANGED, { state: STATES.VICTORY });
  }

  restart() {
    this._state = STATES.MENU;
    this._elapsedTime = 0;
    this._resetStats();
    this._eventBus.publish(EVENTS.GAME_STATE_CHANGED, { state: STATES.MENU });
  }

  /** @param {number} dt - Seconds since last update. */
  updateTime(dt) {
    if (this._state === STATES.PLAYING) {
      this._elapsedTime += dt;
    }
  }

  addStat(key, value) {
    this._stats[key] = (this._stats[key] || 0) + value;
  }

  getStat(key) {
    return this._stats[key] || 0;
  }

  getStats() {
    return { ...this._stats, elapsedTime: this._elapsedTime };
  }

  /** @private */
  _resetStats() {
    this._stats = {
      wavesSurvived: 0,
      goldEarned: 0,
      creaturesLost: 0,
      heroesKilled: 0,
    };
  }
}

export { STATES as GAME_STATES };
```

- [ ] **Step 4: Run tests — expect PASS**

Run: `npx vitest run tests/core/GameStateManager.test.js`

- [ ] **Step 5: Commit**

```bash
git add src/core/GameStateManager.js tests/core/GameStateManager.test.js
git commit -m "feat(phase6): implement GameStateManager state machine with stats tracking"
```

---

### Task 2: GameLoop Pause Support

**Files:**
- Modify: `src/core/GameLoop.js`
- Modify: `tests/core/GameLoop.test.js`

- [ ] **Step 1: Add pause tests**

Add to `tests/core/GameLoop.test.js`:

```js
describe('pause/resume', () => {
  it('isPaused should default to false', () => {
    const gl = new GameLoop(() => {}, () => {});
    expect(gl.isPaused).toBe(false);
  });

  it('pause() should set isPaused to true', () => {
    const gl = new GameLoop(() => {}, () => {});
    gl.pause();
    expect(gl.isPaused).toBe(true);
  });

  it('resume() should set isPaused to false', () => {
    const gl = new GameLoop(() => {}, () => {});
    gl.pause();
    gl.resume();
    expect(gl.isPaused).toBe(false);
  });
});
```

- [ ] **Step 2: Implement pause in GameLoop**

Read `src/core/GameLoop.js`. Add to constructor:
```js
this._paused = false;
```

Add methods:
```js
get isPaused() { return this._paused; }
pause() { this._paused = true; }
resume() { this._paused = false; }
```

In `_tick(now)`, skip update and accumulator when paused — only continue rendering:
```js
// After FPS tracking, before accumulator addition:
if (this._paused) {
  this._render(0); // Render without interpolation
  this._rafId = requestAnimationFrame((t) => this._tick(t));
  return;
}
```

- [ ] **Step 3: Run tests — expect PASS**

Run: `npx vitest run tests/core/GameLoop.test.js`

- [ ] **Step 4: Commit**

```bash
git add src/core/GameLoop.js tests/core/GameLoop.test.js
git commit -m "feat(phase6): add pause/resume to GameLoop"
```

---

### Task 3: Dungeon Heart HP in ResourceManager

**Files:**
- Modify: `src/systems/ResourceManager.js`
- Modify: `tests/systems/ResourceManager.test.js`

- [ ] **Step 1: Add Dungeon Heart HP tests**

Add to `tests/systems/ResourceManager.test.js`:

```js
// Add DUNGEON_HEART_HP to imports at the top of the test file:
// import { RESOURCES, EVENTS, DUNGEON_HEART_HP } from '../../src/constants.js';

describe('Dungeon Heart HP', () => {
  it('should start with full HP', () => {
    const rm = new ResourceManager(new EventBus());
    expect(rm.heartHP).toBe(DUNGEON_HEART_HP);
    expect(rm.heartMaxHP).toBe(DUNGEON_HEART_HP);
  });

  it('damageHeart should reduce HP', () => {
    const rm = new ResourceManager(new EventBus());
    rm.damageHeart(100);
    expect(rm.heartHP).toBe(DUNGEON_HEART_HP - 100);
  });

  it('damageHeart should not go below 0', () => {
    const rm = new ResourceManager(new EventBus());
    rm.damageHeart(DUNGEON_HEART_HP + 100);
    expect(rm.heartHP).toBe(0);
  });

  it('should return true from isHeartDestroyed when HP is 0', () => {
    const rm = new ResourceManager(new EventBus());
    rm.damageHeart(DUNGEON_HEART_HP);
    expect(rm.isHeartDestroyed).toBe(true);
  });

  it('should publish RESOURCES_CHANGED when heart damaged', () => {
    const eb = new EventBus();
    vi.spyOn(eb, 'publish');
    const rm = new ResourceManager(eb);
    rm.damageHeart(50);
    expect(eb.publish).toHaveBeenCalledWith(EVENTS.RESOURCES_CHANGED, expect.objectContaining({ heartHP: DUNGEON_HEART_HP - 50 }));
  });
});
```

- [ ] **Step 2: Implement Dungeon Heart HP**

In `src/systems/ResourceManager.js`, add import for `DUNGEON_HEART_HP`:
```js
import { RESOURCES, EVENTS, DUNGEON_HEART_HP } from '../constants.js';
```

Add to constructor:
```js
this._heartHP = DUNGEON_HEART_HP;
this._heartMaxHP = DUNGEON_HEART_HP;
```

Add getters and methods:
```js
get heartHP() { return this._heartHP; }
get heartMaxHP() { return this._heartMaxHP; }
get isHeartDestroyed() { return this._heartHP <= 0; }

damageHeart(amount) {
  this._heartHP = Math.max(0, this._heartHP - amount);
  this._publish();
}

resetHeart() {
  this._heartHP = this._heartMaxHP;
  this._publish();
}
```

Update `getSnapshot()` to include heartHP:
```js
getSnapshot() {
  return {
    gold: this._gold, mana: this._mana,
    goldCap: this._goldCap, manaCap: this._manaCap,
    heartHP: this._heartHP, heartMaxHP: this._heartMaxHP,
  };
}
```

- [ ] **Step 3: Run tests — expect PASS**

Run: `npx vitest run tests/systems/ResourceManager.test.js`

- [ ] **Step 4: Commit**

```bash
git add src/systems/ResourceManager.js tests/systems/ResourceManager.test.js
git commit -m "feat(phase6): add Dungeon Heart HP tracking to ResourceManager"
```

---

### Task 4: Spatial Hash for EntityManager

**Files:**
- Modify: `src/entities/EntityManager.js`
- Modify: `tests/entities/EntityManager.test.js`

- [ ] **Step 1: Add spatial hash tests**

Add to `tests/entities/EntityManager.test.js`:

```js
describe('spatial hash - getEntitiesInRadius', () => {
  it('should find entities within radius', () => {
    const em = new EntityManager();
    const e1 = { id: 1, x: 100, y: 100, prevX: 100, prevY: 100, alive: true, update: vi.fn() };
    const e2 = { id: 2, x: 500, y: 500, prevX: 500, prevY: 500, alive: true, update: vi.fn() };
    em.add(e1);
    em.add(e2);
    em.rebuildSpatialHash();
    const nearby = em.getEntitiesInRadius(100, 100, 50);
    expect(nearby).toContain(e1);
    expect(nearby).not.toContain(e2);
  });

  it('should return empty array when no entities nearby', () => {
    const em = new EntityManager();
    em.rebuildSpatialHash();
    expect(em.getEntitiesInRadius(100, 100, 50)).toEqual([]);
  });

  it('should handle entities at cell boundaries', () => {
    const em = new EntityManager();
    const e1 = { id: 1, x: 128, y: 128, prevX: 128, prevY: 128, alive: true, update: vi.fn() };
    em.add(e1);
    em.rebuildSpatialHash();
    const nearby = em.getEntitiesInRadius(130, 130, 50);
    expect(nearby).toContain(e1);
  });
});
```

- [ ] **Step 2: Implement spatial hash**

Replace `getEntitiesInRadius` with a grid-based spatial hash. Read the file first. The hash is rebuilt each update cycle (after entity positions change).

Add to constructor:
```js
this._spatialGrid = new Map();
this._cellSize = 128; // 4 tiles (TILE_SIZE=32)
```

Add methods:
```js
/** Rebuild spatial hash from current entity positions. */
rebuildSpatialHash() {
  this._spatialGrid.clear();
  for (const entity of this._entities.values()) {
    if (!entity.alive) continue;
    const cellKey = this._getCellKey(entity.x, entity.y);
    if (!this._spatialGrid.has(cellKey)) {
      this._spatialGrid.set(cellKey, []);
    }
    this._spatialGrid.get(cellKey).push(entity);
  }
}

/** @private */
_getCellKey(x, y) {
  const cx = Math.floor(x / this._cellSize);
  const cy = Math.floor(y / this._cellSize);
  return (cx << 16) | (cy & 0xFFFF);
}
```

Replace `getEntitiesInRadius`:
```js
getEntitiesInRadius(x, y, radius) {
  const r2 = radius * radius;
  const result = [];
  const minCx = Math.floor((x - radius) / this._cellSize);
  const maxCx = Math.floor((x + radius) / this._cellSize);
  const minCy = Math.floor((y - radius) / this._cellSize);
  const maxCy = Math.floor((y + radius) / this._cellSize);

  for (let cx = minCx; cx <= maxCx; cx++) {
    for (let cy = minCy; cy <= maxCy; cy++) {
      const key = (cx << 16) | (cy & 0xFFFF);
      const cell = this._spatialGrid.get(key);
      if (!cell) continue;
      for (const e of cell) {
        if (!e.alive) continue;
        const dx = e.x - x;
        const dy = e.y - y;
        if (dx * dx + dy * dy <= r2) {
          result.push(e);
        }
      }
    }
  }
  return result;
}
```

In `update(dt)`, call `rebuildSpatialHash()` after removing dead entities:
```js
update(dt) {
  // ... existing update + dead removal ...
  this.rebuildSpatialHash();
}
```

- [ ] **Step 3: Run tests — expect PASS**

Run: `npx vitest run tests/entities/EntityManager.test.js`

- [ ] **Step 4: Run full suite for regressions**

Run: `npx vitest run`

- [ ] **Step 5: Commit**

```bash
git add src/entities/EntityManager.js tests/entities/EntityManager.test.js
git commit -m "feat(phase6): add spatial hash grid for O(1) entity radius queries"
```

---

### Task 5: MenuScreen UI (Main Menu + Game Over + Victory)

**Files:**
- Create: `src/ui/MenuScreen.js`

- [ ] **Step 1: Implement MenuScreen**

```js
// src/ui/MenuScreen.js
import { EVENTS } from '../constants.js';

/**
 * HTML overlay screens for main menu, game over, and victory.
 * Manages three distinct screen states, all rendered as HTML overlays.
 */
export class MenuScreen {
  /**
   * @param {HTMLElement} container - The #hud-overlay element.
   * @param {import('../core/EventBus.js').EventBus} eventBus
   */
  constructor(container, eventBus) {
    this._container = container;
    this._eventBus = eventBus;
    this._buildMainMenu();
    this._buildGameOver();
    this._buildVictory();
    this._buildPauseMenu();
  }

  /** @private */
  _buildMainMenu() {
    this._menuEl = document.createElement('div');
    this._menuEl.id = 'main-menu';
    this._menuEl.style.cssText = `
      position:fixed;top:0;left:0;width:100%;height:100%;
      display:flex;flex-direction:column;align-items:center;justify-content:center;
      background:radial-gradient(ellipse at center, #1a1510 0%, #0a0a08 70%);
      z-index:500;pointer-events:auto;
    `;
    this._menuEl.innerHTML = `
      <h1 style="font-family:'MedievalSharp',cursive;font-size:64px;color:#c0a060;
        text-shadow:0 0 20px rgba(192,160,96,0.4),0 4px 8px rgba(0,0,0,0.8);
        margin-bottom:16px;">Dungeon Keeper</h1>
      <p style="font-family:'Inter',sans-serif;font-size:14px;color:#706050;
        max-width:400px;text-align:center;margin-bottom:40px;line-height:1.6;">
        Carve your domain from the earth. Build rooms to attract creatures.
        Defend your Dungeon Heart against the heroes of the realm.
        Survive ten waves and amass 5000 gold to claim victory.</p>
      <button id="btn-begin" style="font-family:'MedievalSharp',cursive;font-size:28px;
        color:#f0d080;background:linear-gradient(180deg,#4a4238 0%,#3a3228 100%);
        border:2px solid #8a7a5a;border-radius:6px;padding:12px 48px;cursor:pointer;
        transition:all 0.2s;letter-spacing:2px;">BEGIN</button>
    `;
    this._container.appendChild(this._menuEl);

    this._menuEl.querySelector('#btn-begin').addEventListener('click', () => {
      this._eventBus.publish('menu:start', {});
    });
    this._menuEl.querySelector('#btn-begin').addEventListener('mouseenter', (e) => {
      e.target.style.borderColor = '#c0a060';
      e.target.style.color = '#ffe0a0';
      e.target.style.transform = 'scale(1.05)';
    });
    this._menuEl.querySelector('#btn-begin').addEventListener('mouseleave', (e) => {
      e.target.style.borderColor = '#8a7a5a';
      e.target.style.color = '#f0d080';
      e.target.style.transform = 'scale(1)';
    });
  }

  /** @private */
  _buildGameOver() {
    this._gameOverEl = document.createElement('div');
    this._gameOverEl.id = 'game-over-screen';
    this._gameOverEl.style.cssText = `
      position:fixed;top:0;left:0;width:100%;height:100%;
      display:none;flex-direction:column;align-items:center;justify-content:center;
      background:rgba(10,0,0,0.85);z-index:500;pointer-events:auto;
    `;
    this._gameOverEl.innerHTML = `
      <h1 style="font-family:'MedievalSharp',cursive;font-size:56px;color:#c04040;
        text-shadow:0 0 30px rgba(200,0,0,0.5),0 4px 8px rgba(0,0,0,0.8);
        margin-bottom:24px;">YOUR DUNGEON FALLS</h1>
      <div id="go-stats" style="font-family:'Inter',sans-serif;font-size:14px;
        color:#a09080;max-width:350px;text-align:left;line-height:2;
        background:rgba(30,25,20,0.8);padding:20px 30px;border:1px solid #4a3a2a;
        border-radius:6px;margin-bottom:30px;"></div>
      <button id="btn-restart-go" style="font-family:'MedievalSharp',cursive;font-size:24px;
        color:#c0a060;background:linear-gradient(180deg,#4a4238 0%,#3a3228 100%);
        border:2px solid #6a5a45;border-radius:6px;padding:10px 36px;cursor:pointer;">
        RESTART</button>
    `;
    this._container.appendChild(this._gameOverEl);

    this._gameOverEl.querySelector('#btn-restart-go').addEventListener('click', () => {
      this._eventBus.publish('menu:restart', {});
    });
  }

  /** @private */
  _buildVictory() {
    this._victoryEl = document.createElement('div');
    this._victoryEl.id = 'victory-screen';
    this._victoryEl.style.cssText = `
      position:fixed;top:0;left:0;width:100%;height:100%;
      display:none;flex-direction:column;align-items:center;justify-content:center;
      background:rgba(10,8,0,0.85);z-index:500;pointer-events:auto;
    `;
    this._victoryEl.innerHTML = `
      <h1 style="font-family:'MedievalSharp',cursive;font-size:56px;color:#f0c040;
        text-shadow:0 0 30px rgba(240,192,64,0.5),0 4px 8px rgba(0,0,0,0.8);
        margin-bottom:24px;">THE REALM IS YOURS</h1>
      <div id="vic-stats" style="font-family:'Inter',sans-serif;font-size:14px;
        color:#a09080;max-width:350px;text-align:left;line-height:2;
        background:rgba(30,25,20,0.8);padding:20px 30px;border:1px solid #5a4a2a;
        border-radius:6px;margin-bottom:30px;"></div>
      <button id="btn-restart-vic" style="font-family:'MedievalSharp',cursive;font-size:24px;
        color:#f0d080;background:linear-gradient(180deg,#4a4238 0%,#3a3228 100%);
        border:2px solid #8a7a5a;border-radius:6px;padding:10px 36px;cursor:pointer;">
        RESTART</button>
    `;
    this._container.appendChild(this._victoryEl);

    this._victoryEl.querySelector('#btn-restart-vic').addEventListener('click', () => {
      this._eventBus.publish('menu:restart', {});
    });
  }

  /** @private */
  _buildPauseMenu() {
    this._pauseEl = document.createElement('div');
    this._pauseEl.id = 'pause-menu';
    this._pauseEl.style.cssText = `
      position:fixed;top:0;left:0;width:100%;height:100%;
      display:none;flex-direction:column;align-items:center;justify-content:center;
      background:rgba(10,10,10,0.7);z-index:500;pointer-events:auto;
    `;
    this._pauseEl.innerHTML = `
      <h1 style="font-family:'MedievalSharp',cursive;font-size:48px;color:#c0b090;
        text-shadow:0 4px 8px rgba(0,0,0,0.8);margin-bottom:30px;">PAUSED</h1>
      <div style="display:flex;flex-direction:column;gap:12px;">
        <button class="pause-btn" id="btn-resume" style="font-family:'MedievalSharp',cursive;
          font-size:22px;color:#c0a060;background:linear-gradient(180deg,#4a4238 0%,#3a3228 100%);
          border:2px solid #6a5a45;border-radius:6px;padding:10px 36px;cursor:pointer;
          min-width:200px;">RESUME</button>
        <button class="pause-btn" id="btn-restart-pause" style="font-family:'MedievalSharp',cursive;
          font-size:22px;color:#a08060;background:linear-gradient(180deg,#4a4238 0%,#3a3228 100%);
          border:2px solid #6a5a45;border-radius:6px;padding:10px 36px;cursor:pointer;
          min-width:200px;">RESTART</button>
        <button class="pause-btn" id="btn-quit" style="font-family:'MedievalSharp',cursive;
          font-size:22px;color:#806050;background:linear-gradient(180deg,#4a4238 0%,#3a3228 100%);
          border:2px solid #5a4a35;border-radius:6px;padding:10px 36px;cursor:pointer;
          min-width:200px;">QUIT</button>
      </div>
    `;
    this._container.appendChild(this._pauseEl);

    this._pauseEl.querySelector('#btn-resume').addEventListener('click', () => {
      this._eventBus.publish('menu:resume', {});
    });
    this._pauseEl.querySelector('#btn-restart-pause').addEventListener('click', () => {
      this._eventBus.publish('menu:restart', {});
    });
    this._pauseEl.querySelector('#btn-quit').addEventListener('click', () => {
      this._eventBus.publish('menu:quit', {});
    });
  }

  /** Show main menu, hide others. */
  showMenu() {
    this._menuEl.style.display = 'flex';
    this._gameOverEl.style.display = 'none';
    this._victoryEl.style.display = 'none';
    this._pauseEl.style.display = 'none';
  }

  /** Hide all screens. */
  hideAll() {
    this._menuEl.style.display = 'none';
    this._gameOverEl.style.display = 'none';
    this._victoryEl.style.display = 'none';
    this._pauseEl.style.display = 'none';
  }

  /** Show game over screen with stats. */
  showGameOver(stats) {
    this._menuEl.style.display = 'none';
    this._pauseEl.style.display = 'none';
    this._gameOverEl.style.display = 'flex';
    this._gameOverEl.querySelector('#go-stats').innerHTML = this._formatStats(stats);
  }

  /** Show victory screen with stats. */
  showVictory(stats) {
    this._menuEl.style.display = 'none';
    this._pauseEl.style.display = 'none';
    this._victoryEl.style.display = 'flex';
    this._victoryEl.querySelector('#vic-stats').innerHTML = this._formatStats(stats);
  }

  /** Show pause overlay. */
  showPause() {
    this._pauseEl.style.display = 'flex';
  }

  /** Hide pause overlay. */
  hidePause() {
    this._pauseEl.style.display = 'none';
  }

  /** @private */
  _formatStats(stats) {
    const time = stats.elapsedTime || 0;
    const min = Math.floor(time / 60);
    const sec = Math.floor(time % 60);
    return `
      <div>Waves Survived: <span style="color:#e0d0a0">${stats.wavesSurvived || 0}</span></div>
      <div>Gold Earned: <span style="color:#f0c040">${stats.goldEarned || 0}</span></div>
      <div>Heroes Killed: <span style="color:#c06040">${stats.heroesKilled || 0}</span></div>
      <div>Creatures Lost: <span style="color:#a04040">${stats.creaturesLost || 0}</span></div>
      <div>Time: <span style="color:#e0d0a0">${min}m ${sec}s</span></div>
    `;
  }
}
```

- [ ] **Step 2: Write MenuScreen tests**

Create `tests/ui/MenuScreen.test.js`:

```js
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MenuScreen } from '../../src/ui/MenuScreen.js';

function makeContainer() {
  const el = document.createElement('div');
  document.body.appendChild(el);
  return el;
}

function makeEventBus() {
  return { publish: vi.fn(), subscribe: vi.fn() };
}

describe('MenuScreen', () => {
  let container, eventBus, ms;

  beforeEach(() => {
    document.body.innerHTML = '';
    container = makeContainer();
    eventBus = makeEventBus();
    ms = new MenuScreen(container, eventBus);
  });

  it('should create all four screen elements', () => {
    expect(container.querySelector('#main-menu')).not.toBeNull();
    expect(container.querySelector('#game-over-screen')).not.toBeNull();
    expect(container.querySelector('#victory-screen')).not.toBeNull();
    expect(container.querySelector('#pause-menu')).not.toBeNull();
  });

  it('showMenu should show main menu and hide others', () => {
    ms.showMenu();
    expect(container.querySelector('#main-menu').style.display).toBe('flex');
    expect(container.querySelector('#game-over-screen').style.display).toBe('none');
    expect(container.querySelector('#victory-screen').style.display).toBe('none');
    expect(container.querySelector('#pause-menu').style.display).toBe('none');
  });

  it('hideAll should hide all screens', () => {
    ms.showMenu();
    ms.hideAll();
    expect(container.querySelector('#main-menu').style.display).toBe('none');
  });

  it('showGameOver should show game over screen with stats', () => {
    ms.showGameOver({ wavesSurvived: 3, goldEarned: 500, heroesKilled: 10, creaturesLost: 2, elapsedTime: 125 });
    expect(container.querySelector('#game-over-screen').style.display).toBe('flex');
    expect(container.querySelector('#go-stats').innerHTML).toContain('3');
    expect(container.querySelector('#go-stats').innerHTML).toContain('500');
  });

  it('showVictory should show victory screen with stats', () => {
    ms.showVictory({ wavesSurvived: 10, goldEarned: 5000, heroesKilled: 50, creaturesLost: 5, elapsedTime: 300 });
    expect(container.querySelector('#victory-screen').style.display).toBe('flex');
    expect(container.querySelector('#vic-stats').innerHTML).toContain('10');
  });

  it('showPause should show pause overlay', () => {
    ms.showPause();
    expect(container.querySelector('#pause-menu').style.display).toBe('flex');
  });

  it('BEGIN button should publish menu:start', () => {
    container.querySelector('#btn-begin').click();
    expect(eventBus.publish).toHaveBeenCalledWith('menu:start', {});
  });

  it('RESTART button on game over should publish menu:restart', () => {
    ms.showGameOver({ wavesSurvived: 0, elapsedTime: 0 });
    container.querySelector('#btn-restart-go').click();
    expect(eventBus.publish).toHaveBeenCalledWith('menu:restart', {});
  });

  it('RESUME button should publish menu:resume', () => {
    ms.showPause();
    container.querySelector('#btn-resume').click();
    expect(eventBus.publish).toHaveBeenCalledWith('menu:resume', {});
  });

  it('QUIT button should publish menu:quit', () => {
    ms.showPause();
    container.querySelector('#btn-quit').click();
    expect(eventBus.publish).toHaveBeenCalledWith('menu:quit', {});
  });
});
```

- [ ] **Step 3: Run full test suite**

Run: `npx vitest run`

- [ ] **Step 4: Commit**

```bash
git add src/ui/MenuScreen.js tests/ui/MenuScreen.test.js
git commit -m "feat(phase6): create MenuScreen with main menu, game over, victory, and pause overlays"
```

---

### Task 6: Room Placement Fade-In Animation

**Files:**
- Modify: `src/rendering/TileRenderer.js`
- Modify: `src/systems/RoomManager.js`

- [ ] **Step 1: Add room placement timestamp to RoomManager**

In `src/systems/RoomManager.js`, in the `placeRoom` method, add a `placedAt` timestamp to the room object. Change:
```js
const room = { id, type, tiles: tiles.map(t => ({ x: t.x, y: t.y })) };
```
to:
```js
const room = { id, type, tiles: tiles.map(t => ({ x: t.x, y: t.y })), placedAt: performance.now() };
```

No new methods needed — TileRenderer already calls `getRoomAt(x, y)` and gets the room object, which will now include `placedAt`.

- [ ] **Step 2: Add fade-in to TileRenderer room overlay**

Read `src/rendering/TileRenderer.js`. In the room tile rendering section (around line 47-52), wrap the room overlay draw with a fade-in alpha based on `room.placedAt`:

```js
// Draw room overlay if this tile belongs to a room
if (this._roomManager) {
  const room = this._roomManager.getRoomAt(x, y);
  if (room) {
    const age = (performance.now() - (room.placedAt || 0)) / 1000;
    const fadeAlpha = Math.min(1, age / 0.3);
    ctx.globalAlpha = fadeAlpha;
    this._drawRoomOverlay(ctx, room.type, sx, sy, size, noise);
    ctx.globalAlpha = 1;
  }
}
```

- [ ] **Step 3: Run tests — no regressions**

Run: `npx vitest run`

- [ ] **Step 4: Commit**

```bash
git add src/systems/RoomManager.js src/rendering/TileRenderer.js
git commit -m "feat(phase6): add 0.3s fade-in animation for room placement"
```

---

### Task 7: main.js Integration — Win/Lose, Pause, Menu, Restart, Stats

**Files:**
- Modify: `src/main.js`

This is the core integration task. All game state management, win/lose checking, pause, menu screens, restart logic, and stat tracking.

- [ ] **Step 1: Add imports**

```js
import { GameStateManager, GAME_STATES } from './core/GameStateManager.js';
import { MenuScreen } from './ui/MenuScreen.js';
import { WIN_GOLD_THRESHOLD, WIN_WAVE_THRESHOLD, DUNGEON_HEART_HP } from './constants.js';
```

- [ ] **Step 2: Create GameStateManager and MenuScreen instances**

After the Phase 5 systems initialization:
```js
// Phase 6 systems
const gameStateManager = new GameStateManager(eventBus);
const menuScreen = new MenuScreen(hudOverlay, eventBus);
```

- [ ] **Step 3: Wire menu events**

```js
// Menu events
eventBus.subscribe('menu:start', () => {
  gameStateManager.startGame();
  menuScreen.hideAll();
  gameLoop.resume();
});

eventBus.subscribe('menu:resume', () => {
  gameStateManager.resume();
  menuScreen.hidePause();
  gameLoop.resume();
});

eventBus.subscribe('menu:restart', () => {
  // Full restart — reload page for clean state (simplest way to guarantee no ghost state)
  window.location.reload();
});

eventBus.subscribe('menu:quit', () => {
  // Quit returns to main menu — also reload for clean state
  window.location.reload();
});
```

- [ ] **Step 4: Wire pause (P or Escape when not possessing)**

Modify the existing `EVENTS.INPUT_KEY_DOWN` handler. Add before the possess ESC check:

```js
// Pause toggle (P key or Escape, only when NOT possessing)
if (!spellSystem.isPossessing && (e.code === 'KeyP' || e.code === 'Escape')) {
  if (gameStateManager.state === 'playing') {
    gameStateManager.pause();
    gameLoop.pause();
    menuScreen.showPause();
    return;
  } else if (gameStateManager.state === 'paused') {
    gameStateManager.resume();
    gameLoop.resume();
    menuScreen.hidePause();
    return;
  }
}
```

- [ ] **Step 5: Wire win/lose conditions in update loop**

Add to the `update(dt)` function, at the end:

```js
// Track elapsed time
gameStateManager.updateTime(dt);

// Lose condition: Dungeon Heart destroyed
if (resourceManager.isHeartDestroyed && gameStateManager.state === 'playing') {
  gameStateManager.gameOver();
  // Slow-motion for 1 second, then pause (see GAME_OVER event handler)
  gameLoop.setSpeed(0.2);
  return;
}
```

**Note:** The win condition is checked when a wave is completed (Step 7), NOT in the update loop, since "survive 10 waves" means completing wave 10.

- [ ] **Step 6: Wire game over/victory screen display**

Add a new flash timer variable near the other VFX timers:
```js
let gameOverFlashTimer = 0;
```

```js
eventBus.subscribe(EVENTS.GAME_OVER, (e) => {
  // Dramatic effects: screen shake + red flash
  screenShakeTimer = 1.0;
  screenShakeMagnitude = 6;
  gameOverFlashTimer = 1.0; // 1s red flash overlay
  // After 1 second of slow-motion, fully pause and show screen
  setTimeout(() => {
    gameLoop.pause();
    gameLoop.setSpeed(1); // Reset speed for when they restart
    menuScreen.showGameOver(e.stats);
  }, 1000);
});

eventBus.subscribe(EVENTS.GAME_VICTORY, (e) => {
  gameLoop.pause();
  menuScreen.showVictory(e.stats);
});
```

In the render function, add the game-over red flash overlay (near the other flash overlays):
```js
// Game over red flash overlay
if (gameOverFlashTimer > 0) {
  gameOverFlashTimer -= renderDt;
  ctx.fillStyle = `rgba(200, 0, 0, ${Math.min(1, gameOverFlashTimer) * 0.5})`;
  ctx.fillRect(0, 0, w, h);
}
```

- [ ] **Step 7: Wire stat tracking events**

```js
// Track stats for game session
eventBus.subscribe(EVENTS.ENTITY_DIED, (e) => {
  if (e.team === 'enemy') {
    gameStateManager.addStat('heroesKilled', 1);
  }
  if (e.team === 'player' && e.type !== ENTITY_TYPES.DOOR) {
    gameStateManager.addStat('creaturesLost', 1);
  }
});

// Track gold earned via RESOURCES_CHANGED delta
let lastGold = 0;
eventBus.subscribe(EVENTS.RESOURCES_CHANGED, (data) => {
  if (data.gold > lastGold) {
    gameStateManager.addStat('goldEarned', data.gold - lastGold);
  }
  lastGold = data.gold;
});

// Track waves survived + check win condition on wave completion
eventBus.subscribe(EVENTS.WAVE_COMPLETED, (e) => {
  gameStateManager.addStat('wavesSurvived', 1);
  // Win condition: survived 10 waves AND have 5000+ gold
  if (gameStateManager.getStat('wavesSurvived') >= WIN_WAVE_THRESHOLD
      && resourceManager.gold >= WIN_GOLD_THRESHOLD
      && gameStateManager.state === 'playing') {
    gameStateManager.victory();
  }
});
```

- [ ] **Step 8: Heroes damage Dungeon Heart when they reach it**

Add to the existing update function or as a new check:

```js
// Check if any hero has reached the Dungeon Heart
const heartCenterX = heartCx * TILE_SIZE + TILE_SIZE / 2;
const heartCenterY = heartCy * TILE_SIZE + TILE_SIZE / 2;
const heroesAtHeart = entityManager.getEntitiesInRadius(heartCenterX, heartCenterY, TILE_SIZE * 2);
for (const hero of heroesAtHeart) {
  if (hero.team === 'enemy' && hero.alive) {
    resourceManager.damageHeart(hero.damage * dt);
  }
}
```

- [ ] **Step 9: Start game paused at menu**

At the bottom of main.js, change the game start:

```js
const gameLoop = new GameLoop(update, render);
gameLoop.start();
gameLoop.pause(); // Start paused at menu
menuScreen.showMenu();
```

- [ ] **Step 10: Add Dungeon Heart HP bar to HUD**

In the HUD's `_subscribe` handler for `RESOURCES_CHANGED`, add heart HP display. Modify `src/ui/HUD.js`:

Add to the `_build()` method, in the hud-bar HTML:
```html
<div class="hud-item">
  <span class="hud-label">Heart</span>
  <div class="mana-bar-bg" style="border-color:#c04040;">
    <div class="mana-bar-fill" id="hud-heart-fill" style="background:linear-gradient(90deg,#a02020,#c04040);"></div>
  </div>
  <span id="hud-heart-text" style="color:#c04040;font-size:12px;">500</span>
</div>
```

In `_build()`, store refs:
```js
this._heartFill = this._el.querySelector('#hud-heart-fill');
this._heartText = this._el.querySelector('#hud-heart-text');
```

In `_subscribe()`, update heart display:
```js
// In the RESOURCES_CHANGED handler:
if (data.heartHP !== undefined) {
  const heartPercent = (data.heartHP / data.heartMaxHP) * 100;
  this._heartFill.style.width = `${heartPercent}%`;
  this._heartText.textContent = `${Math.floor(data.heartHP)}`;
}
```

- [ ] **Step 11: Run full test suite**

Run: `npx vitest run`

- [ ] **Step 12: Commit**

```bash
git add src/main.js src/ui/HUD.js
git commit -m "feat(phase6): integrate win/lose conditions, pause menu, stats tracking, and Dungeon Heart HP display"
```

---

### Task 8: Performance Audit & Per-Frame Allocation Cleanup

**Files:**
- Modify: `src/entities/EntityManager.js` (already optimized in Task 4)
- Modify: `src/rendering/EntityRenderer.js`

- [ ] **Step 1: Cache getAll() result per frame in EntityRenderer**

In `EntityRenderer.render()`, the entities array is already used once per render. The spatial hash in EntityManager already reduces allocation. But ensure EntityRenderer doesn't re-allocate:

Read EntityRenderer. If it calls `this._entityManager.getAll()` per render, this creates a new array. Since entities are already iterable via the internal Map.values(), we can iterate directly.

In EntityManager, add:
```js
/** Iterate all entities without allocating an array. */
[Symbol.iterator]() {
  return this._entities.values();
}
```

In EntityRenderer.render(), change:
```js
for (const entity of this._entityManager.getAll()) {
```
to:
```js
for (const entity of this._entityManager) {
```

- [ ] **Step 2: Run full test suite**

Run: `npx vitest run`

- [ ] **Step 3: Commit**

```bash
git add src/entities/EntityManager.js src/rendering/EntityRenderer.js
git commit -m "perf(phase6): add iterator to EntityManager, eliminate per-frame array allocation in renderer"
```

---

### Task 9: EventBus Subscription Audit

**Files:**
- Audit: all files that call `eventBus.subscribe()`

- [ ] **Step 1: Grep for all subscribe calls**

Run: `grep -rn "subscribe\|unsubscribe" src/ --include="*.js"`

Document all subscriptions. Focus on finding subscriptions made by entities or short-lived objects that should clean up after themselves.

- [ ] **Step 2: Verify no leaks from entity lifecycle**

Known patterns that are safe (subscribe once, live forever):
- `main.js` — top-level event wiring (lives for entire session)
- `HUD`, `Toolbar`, `Tooltip`, `Minimap` — UI components (live for entire session)
- `CombatSystem`, `WaveManager`, `CreatureSpawner` — system singletons (live for entire session)

Patterns to check:
- Do `Imp`, `Creature`, `Hero`, `Door` entities subscribe to EventBus? If so, they must unsubscribe on death.
- Does `SpellSystem` clean up its possess mode subscriptions?

Read each Entity subclass (`Imp.js`, `Creature.js`, `Hero.js`, `Door.js`) and verify they do NOT subscribe to EventBus directly. If any do, add `unsubscribe()` calls in their `die()` methods.

- [ ] **Step 3: Document findings and fix any leaks**

If leaks found: add cleanup. If none found (expected — entities communicate via EntityManager, not EventBus): document in commit message.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore(phase6): audit EventBus subscriptions, confirm no listener leaks"
```

---

### Task 10: Final Verification

- [ ] **Step 1: Run full test suite**

Run: `npx vitest run`
Expected: All tests pass

- [ ] **Step 2: Verify build succeeds**

Run: `npx vite build`
Expected: Clean build, no errors

- [ ] **Step 3: Verify Phase 6 checklist**

From the Master Build Plan:
- [ ] Pause works from any non-possess game state
- [ ] Game Over triggers correctly, shows accurate stats
- [ ] Victory triggers when both conditions met simultaneously
- [ ] Restart resets ALL state (no ghost entities, no leftover timers)
- [ ] No console errors during a full session
- [ ] Frame time ≤ 8ms under wave-10 load (DevTools Performance tab)
- [ ] Zero per-frame allocations in hot path (Memory tab, no sawtooth)
- [ ] All visual polish items present
- [ ] Lava and water tiles animate
- [ ] Main menu renders and transitions to game

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "feat(phase6): Phase 6 — Polish, Win/Lose & Final Integration complete"
```
