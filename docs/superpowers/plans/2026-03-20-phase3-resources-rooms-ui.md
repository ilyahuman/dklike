# Phase 3 — Resources, Rooms & UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement ResourceManager (gold/mana), RoomManager (5 room types), room placement flow with visual preview, HUD (top bar), Toolbar (bottom bar with hotkeys), Tooltip (hover info), room-specific floor art, and Imp room integration (Hatchery eating / Lair sleeping) — resulting in a playable dungeon economy where gold is earned from digging, rooms are placed with gold, and imps use rooms for their needs.

**Architecture:** ResourceManager tracks gold/mana as single source of truth, publishes RESOURCES_CHANGED events. RoomManager stores rooms as tile sets with spatial lookup. HUD/Toolbar/Tooltip are HTML overlay elements that read state from systems. Toolbar publishes TOOL_SELECTED and SPEED_CHANGED events. Room placement flow lives in main.js, rendering green/red tile previews on canvas. Imp gets optional RoomManager reference to seek Hatchery/Lair rooms. All cross-system communication via EventBus.

**Tech Stack:** Vanilla JS (ES Modules), Canvas 2D, HTML/CSS overlays, Vitest

---

## File Structure

| File | Action | Purpose |
|------|--------|---------|
| `src/systems/ResourceManager.js` | Replace stub | Gold/mana tracking, caps, mana regen, events |
| `src/systems/RoomManager.js` | Replace stub | Room CRUD, tile→room lookup, spatial queries |
| `src/ui/HUD.js` | Replace stub | Top bar: gold (tween), mana bar, imp count, wave timer |
| `src/ui/Toolbar.js` | Replace stub | Bottom bar: tool buttons, hotkeys 1–9, speed toggle |
| `src/ui/Tooltip.js` | Replace stub | Hover info for tiles, rooms, creatures |
| `src/rendering/TileRenderer.js` | Modify | Room-specific floor art for 5 room types |
| `src/entities/Imp.js` | Modify | Room-based eating/sleeping, gem seam handling |
| `src/main.js` | Modify | Full integration + room placement flow |
| `index.html` | Modify | Add CSS styles for HUD, Toolbar, Tooltip |
| `tests/systems/ResourceManager.test.js` | Create | ResourceManager unit tests |
| `tests/systems/RoomManager.test.js` | Create | RoomManager unit tests |
| `tests/entities/Imp.test.js` | Modify | Add room integration + gem seam tests |

---

### Task 1: ResourceManager

**Files:**
- Replace: `src/systems/ResourceManager.js`
- Create: `tests/systems/ResourceManager.test.js`

- [ ] **Step 1: Write failing tests**

```js
import { describe, it, expect, vi } from 'vitest';
import { ResourceManager } from '../../src/systems/ResourceManager.js';
import { EventBus } from '../../src/core/EventBus.js';
import { RESOURCES, EVENTS } from '../../src/constants.js';

describe('ResourceManager', () => {
  it('starts with zero gold and zero mana', () => {
    const rm = new ResourceManager(new EventBus());
    expect(rm.gold).toBe(0);
    expect(rm.mana).toBe(0);
  });

  it('earnGold adds gold up to cap', () => {
    const rm = new ResourceManager(new EventBus());
    rm.earnGold(500);
    expect(rm.gold).toBe(500);
    rm.earnGold(800);
    expect(rm.gold).toBe(RESOURCES.GOLD_BASE_CAP);
  });

  it('spendGold deducts gold and returns true', () => {
    const rm = new ResourceManager(new EventBus());
    rm.earnGold(500);
    expect(rm.spendGold(200)).toBe(true);
    expect(rm.gold).toBe(300);
  });

  it('spendGold returns false if insufficient gold', () => {
    const rm = new ResourceManager(new EventBus());
    rm.earnGold(100);
    expect(rm.spendGold(200)).toBe(false);
    expect(rm.gold).toBe(100);
  });

  it('mana regenerates via update(dt)', () => {
    const rm = new ResourceManager(new EventBus());
    rm.update(1.0);
    expect(rm.mana).toBeCloseTo(RESOURCES.MANA_REGEN_PER_SEC);
  });

  it('mana clamped to MANA_CAP', () => {
    const rm = new ResourceManager(new EventBus());
    rm.update(9999);
    expect(rm.mana).toBe(RESOURCES.MANA_CAP);
  });

  it('setTreasuryTileCount scales gold cap', () => {
    const rm = new ResourceManager(new EventBus());
    rm.setTreasuryTileCount(4);
    const expectedCap = RESOURCES.GOLD_BASE_CAP + 4 * RESOURCES.GOLD_PER_TREASURY_TILE;
    expect(rm.goldCap).toBe(expectedCap);
  });

  it('publishes RESOURCES_CHANGED on earnGold', () => {
    const eventBus = new EventBus();
    const spy = vi.fn();
    eventBus.subscribe(EVENTS.RESOURCES_CHANGED, spy);
    const rm = new ResourceManager(eventBus);
    rm.earnGold(100);
    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ gold: 100 }));
  });

  it('spendMana deducts mana and returns true', () => {
    const rm = new ResourceManager(new EventBus());
    rm.update(10); // Accumulate some mana
    const before = rm.mana;
    expect(rm.spendMana(10)).toBe(true);
    expect(rm.mana).toBeCloseTo(before - 10);
  });

  it('spendMana returns false if insufficient', () => {
    const rm = new ResourceManager(new EventBus());
    expect(rm.spendMana(100)).toBe(false);
    expect(rm.mana).toBe(0);
  });

  it('getSnapshot returns current state', () => {
    const rm = new ResourceManager(new EventBus());
    rm.earnGold(300);
    rm.update(1.0);
    const snap = rm.getSnapshot();
    expect(snap.gold).toBe(300);
    expect(snap.mana).toBeCloseTo(RESOURCES.MANA_REGEN_PER_SEC);
    expect(snap.goldCap).toBe(RESOURCES.GOLD_BASE_CAP);
    expect(snap.manaCap).toBe(RESOURCES.MANA_CAP);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/systems/ResourceManager.test.js`
Expected: FAIL — ResourceManager is a stub.

- [ ] **Step 3: Implement ResourceManager**

```js
import { RESOURCES, EVENTS } from '../constants.js';

/**
 * Tracks gold and mana resources.
 * Gold: integer, capped by base + treasury. Mana: float, regens from Dungeon Heart.
 * Single source of truth for resource amounts.
 */
export class ResourceManager {
  /** @param {import('../core/EventBus.js').EventBus} eventBus */
  constructor(eventBus) {
    this._eventBus = eventBus;
    this._gold = 0;
    this._mana = 0;
    this._goldCap = RESOURCES.GOLD_BASE_CAP;
    this._manaCap = RESOURCES.MANA_CAP;
  }

  get gold() { return this._gold; }
  get mana() { return this._mana; }
  get goldCap() { return this._goldCap; }
  get manaCap() { return this._manaCap; }

  /**
   * Add gold, clamped to cap.
   * @param {number} amount
   * @returns {boolean} True if gold was capped (overflow).
   */
  earnGold(amount) {
    const prev = this._gold;
    this._gold = Math.min(this._goldCap, this._gold + amount);
    if (this._gold !== prev) this._publish();
    return this._gold === this._goldCap && prev + amount > this._goldCap;
  }

  /**
   * Spend gold if sufficient.
   * @param {number} amount
   * @returns {boolean} True if successful.
   */
  spendGold(amount) {
    if (this._gold < amount) return false;
    this._gold -= amount;
    this._publish();
    return true;
  }

  /**
   * Add mana, clamped to cap.
   * @param {number} amount
   */
  earnMana(amount) {
    const prev = this._mana;
    this._mana = Math.min(this._manaCap, this._mana + amount);
    if (this._mana !== prev) this._publish();
  }

  /**
   * Spend mana if sufficient.
   * @param {number} amount
   * @returns {boolean} True if successful.
   */
  spendMana(amount) {
    if (this._mana < amount) return false;
    this._mana -= amount;
    this._publish();
    return true;
  }

  /**
   * Update treasury-based gold cap.
   * @param {number} tileCount - Total treasury tiles placed.
   */
  setTreasuryTileCount(tileCount) {
    this._goldCap = RESOURCES.GOLD_BASE_CAP + tileCount * RESOURCES.GOLD_PER_TREASURY_TILE;
    if (this._gold > this._goldCap) this._gold = this._goldCap;
    this._publish();
  }

  /**
   * Called each tick. Regenerates mana from Dungeon Heart.
   * @param {number} dt - Seconds.
   */
  update(dt) {
    const prev = this._mana;
    this._mana = Math.min(this._manaCap, this._mana + RESOURCES.MANA_REGEN_PER_SEC * dt);
    if (this._mana !== prev) this._publish();
  }

  /** @returns {{ gold: number, mana: number, goldCap: number, manaCap: number }} */
  getSnapshot() {
    return {
      gold: this._gold,
      mana: this._mana,
      goldCap: this._goldCap,
      manaCap: this._manaCap,
    };
  }

  /** @private */
  _publish() {
    this._eventBus.publish(EVENTS.RESOURCES_CHANGED, this.getSnapshot());
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/systems/ResourceManager.test.js`
Expected: 11 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/systems/ResourceManager.js tests/systems/ResourceManager.test.js
git commit -m "feat(phase3): implement ResourceManager with gold/mana tracking"
```

---

### Task 2: RoomManager

**Files:**
- Replace: `src/systems/RoomManager.js`
- Create: `tests/systems/RoomManager.test.js`

- [ ] **Step 1: Write failing tests**

```js
import { describe, it, expect, vi } from 'vitest';
import { RoomManager } from '../../src/systems/RoomManager.js';
import { EventBus } from '../../src/core/EventBus.js';
import { ROOM_TYPES, EVENTS } from '../../src/constants.js';

describe('RoomManager', () => {
  it('starts with no rooms', () => {
    const rm = new RoomManager(new EventBus());
    expect(rm.getRoomsOfType(ROOM_TYPES.LAIR)).toEqual([]);
  });

  it('placeRoom adds a room and returns id', () => {
    const rm = new RoomManager(new EventBus());
    const id = rm.placeRoom(ROOM_TYPES.LAIR, [{ x: 5, y: 5 }, { x: 5, y: 6 }, { x: 6, y: 5 }, { x: 6, y: 6 }]);
    expect(id).toBeGreaterThan(0);
    const rooms = rm.getRoomsOfType(ROOM_TYPES.LAIR);
    expect(rooms.length).toBe(1);
    expect(rooms[0].tiles.length).toBe(4);
  });

  it('getRoomAt returns room for occupied tile', () => {
    const rm = new RoomManager(new EventBus());
    rm.placeRoom(ROOM_TYPES.HATCHERY, [{ x: 10, y: 10 }, { x: 10, y: 11 }, { x: 11, y: 10 }, { x: 11, y: 11 }]);
    const room = rm.getRoomAt(10, 10);
    expect(room).not.toBeNull();
    expect(room.type).toBe(ROOM_TYPES.HATCHERY);
  });

  it('getRoomAt returns null for empty tile', () => {
    const rm = new RoomManager(new EventBus());
    expect(rm.getRoomAt(99, 99)).toBeNull();
  });

  it('removeRoom clears room and tile lookup', () => {
    const rm = new RoomManager(new EventBus());
    const id = rm.placeRoom(ROOM_TYPES.LAIR, [{ x: 5, y: 5 }]);
    rm.removeRoom(id);
    expect(rm.getRoomAt(5, 5)).toBeNull();
    expect(rm.getRoomsOfType(ROOM_TYPES.LAIR)).toEqual([]);
  });

  it('isRoomTile returns true/false correctly', () => {
    const rm = new RoomManager(new EventBus());
    rm.placeRoom(ROOM_TYPES.TREASURY, [{ x: 3, y: 3 }]);
    expect(rm.isRoomTile(3, 3)).toBe(true);
    expect(rm.isRoomTile(4, 4)).toBe(false);
  });

  it('getTotalTilesOfType counts all tiles for a room type', () => {
    const rm = new RoomManager(new EventBus());
    rm.placeRoom(ROOM_TYPES.TREASURY, [{ x: 1, y: 1 }, { x: 1, y: 2 }]);
    rm.placeRoom(ROOM_TYPES.TREASURY, [{ x: 3, y: 3 }, { x: 3, y: 4 }, { x: 4, y: 3 }]);
    expect(rm.getTotalTilesOfType(ROOM_TYPES.TREASURY)).toBe(5);
  });

  it('getRoomTilesOfType returns all tiles across rooms', () => {
    const rm = new RoomManager(new EventBus());
    rm.placeRoom(ROOM_TYPES.HATCHERY, [{ x: 1, y: 1 }]);
    rm.placeRoom(ROOM_TYPES.HATCHERY, [{ x: 5, y: 5 }]);
    const tiles = rm.getRoomTilesOfType(ROOM_TYPES.HATCHERY);
    expect(tiles.length).toBe(2);
  });

  it('publishes ROOM_PLACED on placeRoom', () => {
    const eventBus = new EventBus();
    const spy = vi.fn();
    eventBus.subscribe(EVENTS.ROOM_PLACED, spy);
    const rm = new RoomManager(eventBus);
    rm.placeRoom(ROOM_TYPES.LAIR, [{ x: 1, y: 1 }]);
    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ type: ROOM_TYPES.LAIR }));
  });

  it('publishes ROOM_REMOVED on removeRoom', () => {
    const eventBus = new EventBus();
    const spy = vi.fn();
    eventBus.subscribe(EVENTS.ROOM_REMOVED, spy);
    const rm = new RoomManager(eventBus);
    const id = rm.placeRoom(ROOM_TYPES.LAIR, [{ x: 1, y: 1 }]);
    rm.removeRoom(id);
    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ type: ROOM_TYPES.LAIR }));
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/systems/RoomManager.test.js`
Expected: FAIL — RoomManager is a stub.

- [ ] **Step 3: Implement RoomManager**

```js
import { EVENTS } from '../constants.js';

/**
 * Manages placed rooms. Each room is a set of tile positions + type.
 * Provides spatial lookup: tile → room.
 * Single source of truth for room existence and layout.
 */
export class RoomManager {
  /** @param {import('../core/EventBus.js').EventBus} eventBus */
  constructor(eventBus) {
    this._eventBus = eventBus;
    /** @type {Map<number, {id: number, type: string, tiles: {x:number,y:number}[]}>} */
    this._rooms = new Map();
    /** @type {Map<string, number>} "x,y" → roomId */
    this._tileToRoom = new Map();
    this._nextId = 1;
  }

  /**
   * Place a new room.
   * @param {string} type - ROOM_TYPES value.
   * @param {{x: number, y: number}[]} tiles
   * @returns {number} Room id.
   */
  placeRoom(type, tiles) {
    const id = this._nextId++;
    const room = { id, type, tiles: tiles.map(t => ({ x: t.x, y: t.y })) };
    this._rooms.set(id, room);
    for (const t of room.tiles) {
      this._tileToRoom.set(`${t.x},${t.y}`, id);
    }
    this._eventBus.publish(EVENTS.ROOM_PLACED, { roomId: id, type, tiles: room.tiles });
    return id;
  }

  /**
   * Remove a room by id.
   * @param {number} roomId
   */
  removeRoom(roomId) {
    const room = this._rooms.get(roomId);
    if (!room) return;
    for (const t of room.tiles) {
      this._tileToRoom.delete(`${t.x},${t.y}`);
    }
    this._rooms.delete(roomId);
    this._eventBus.publish(EVENTS.ROOM_REMOVED, { roomId, type: room.type, tiles: room.tiles });
  }

  /**
   * Get room at tile position.
   * @param {number} x
   * @param {number} y
   * @returns {{id: number, type: string, tiles: {x:number,y:number}[]}|null}
   */
  getRoomAt(x, y) {
    const id = this._tileToRoom.get(`${x},${y}`);
    if (id === undefined) return null;
    return this._rooms.get(id) || null;
  }

  /**
   * Get all rooms of a type.
   * @param {string} type - ROOM_TYPES value.
   * @returns {{id: number, type: string, tiles: {x:number,y:number}[]}[]}
   */
  getRoomsOfType(type) {
    const result = [];
    for (const room of this._rooms.values()) {
      if (room.type === type) result.push(room);
    }
    return result;
  }

  /**
   * Get all tiles belonging to rooms of a specific type.
   * @param {string} type - ROOM_TYPES value.
   * @returns {{x: number, y: number}[]}
   */
  getRoomTilesOfType(type) {
    const tiles = [];
    for (const room of this._rooms.values()) {
      if (room.type === type) {
        for (const t of room.tiles) tiles.push(t);
      }
    }
    return tiles;
  }

  /**
   * Get total tile count for a room type (across all rooms of that type).
   * @param {string} type
   * @returns {number}
   */
  getTotalTilesOfType(type) {
    let count = 0;
    for (const room of this._rooms.values()) {
      if (room.type === type) count += room.tiles.length;
    }
    return count;
  }

  /**
   * Check if a tile belongs to any room.
   * @param {number} x
   * @param {number} y
   * @returns {boolean}
   */
  isRoomTile(x, y) {
    return this._tileToRoom.has(`${x},${y}`);
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/systems/RoomManager.test.js`
Expected: 9 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/systems/RoomManager.js tests/systems/RoomManager.test.js
git commit -m "feat(phase3): implement RoomManager with tile-based room tracking"
```

---

### Task 3: HUD (HTML Overlay)

**Files:**
- Replace: `src/ui/HUD.js`
- Modify: `index.html` (add HUD CSS)

This is a DOM-based UI component. No unit tests (rendering-only, like TileRenderer/EntityRenderer).

- [ ] **Step 1: Add HUD CSS to index.html**

Add inside the existing `<style>` block, before `</style>`:

```css
    /* ── HUD ───────────────────────────────────────────── */
    #hud-bar {
      position: fixed;
      top: 0;
      left: 50%;
      transform: translateX(-50%);
      display: flex;
      align-items: center;
      gap: 24px;
      padding: 8px 28px;
      background: linear-gradient(180deg, #3a352e 0%, #2a2520 100%);
      border-bottom: 2px solid #5a4a35;
      border-radius: 0 0 8px 8px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.6);
      font-family: 'MedievalSharp', cursive;
      font-size: 16px;
      color: #c0b090;
      z-index: 200;
      pointer-events: auto;
    }
    .hud-item {
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .hud-label {
      font-size: 12px;
      color: #908070;
      font-family: 'Inter', sans-serif;
    }
    .gold-icon {
      display: inline-block;
      width: 14px;
      height: 14px;
      background: radial-gradient(circle at 40% 35%, #f0d060, #b89020);
      border-radius: 50%;
      border: 1px solid #806020;
    }
    .hud-gold-val { color: #f0c040; }
    .mana-bar-bg {
      width: 80px;
      height: 12px;
      background: #1a1825;
      border: 1px solid #4060a0;
      border-radius: 2px;
      overflow: hidden;
    }
    .mana-bar-fill {
      height: 100%;
      background: linear-gradient(90deg, #3060c0, #4080f0);
      transition: width 0.3s ease;
      width: 0%;
    }
    .hud-mana-val { color: #4080f0; font-size: 12px; }
    .hud-imp-val { color: #c0b090; }
    .hud-wave-val { color: #c06040; }
```

- [ ] **Step 2: Implement HUD**

```js
import { EVENTS, ENTITY_TYPES } from '../constants.js';

/**
 * Top-bar HUD overlay showing gold, mana, imp count, wave timer.
 * HTML overlay — not canvas-drawn. Reads state, never mutates.
 */
export class HUD {
  /**
   * @param {HTMLElement} container - The #hud-overlay element.
   * @param {import('../core/EventBus.js').EventBus} eventBus
   * @param {import('../systems/ResourceManager.js').ResourceManager} resourceManager
   * @param {import('../entities/EntityManager.js').EntityManager} entityManager
   */
  constructor(container, eventBus, resourceManager, entityManager) {
    this._eventBus = eventBus;
    this._resourceManager = resourceManager;
    this._entityManager = entityManager;
    this._displayGold = 0;
    this._targetGold = 0;
    this._build(container);
    this._subscribe();
  }

  /** @private */
  _build(container) {
    this._el = document.createElement('div');
    this._el.id = 'hud-bar';
    this._el.innerHTML = `
      <div class="hud-item">
        <span class="gold-icon"></span>
        <span class="hud-gold-val" id="hud-gold">0</span>
      </div>
      <div class="hud-item">
        <span class="hud-label">Mana</span>
        <div class="mana-bar-bg"><div class="mana-bar-fill" id="hud-mana-fill"></div></div>
        <span class="hud-mana-val" id="hud-mana-text">0</span>
      </div>
      <div class="hud-item">
        <span class="hud-label">Imps</span>
        <span class="hud-imp-val" id="hud-imp-count">0</span>
      </div>
      <div class="hud-item">
        <span class="hud-label">Wave</span>
        <span class="hud-wave-val" id="hud-wave-timer">---</span>
      </div>
    `;
    container.appendChild(this._el);

    this._goldEl = this._el.querySelector('#hud-gold');
    this._manaFill = this._el.querySelector('#hud-mana-fill');
    this._manaText = this._el.querySelector('#hud-mana-text');
    this._impCountEl = this._el.querySelector('#hud-imp-count');
    this._waveTimerEl = this._el.querySelector('#hud-wave-timer');
  }

  /** @private */
  _subscribe() {
    this._eventBus.subscribe(EVENTS.RESOURCES_CHANGED, (data) => {
      this._targetGold = Math.floor(data.gold);
      const manaPercent = (data.mana / data.manaCap) * 100;
      this._manaFill.style.width = `${manaPercent}%`;
      this._manaText.textContent = `${Math.floor(data.mana)}/${data.manaCap}`;
    });
  }

  /**
   * Called each render frame. Tweens gold display and updates imp count.
   * @param {number} dt - Seconds since last frame.
   */
  update(dt) {
    // Gold tween animation
    if (this._displayGold !== this._targetGold) {
      const diff = this._targetGold - this._displayGold;
      const step = Math.max(1, Math.ceil(Math.abs(diff) * 5 * dt));
      if (Math.abs(diff) <= step) {
        this._displayGold = this._targetGold;
      } else {
        this._displayGold += Math.sign(diff) * step;
      }
      this._goldEl.textContent = this._displayGold;
    }

    // Imp count from EntityManager
    const impCount = this._entityManager.getByType(ENTITY_TYPES.IMP).length;
    this._impCountEl.textContent = impCount;
  }

  /**
   * Update wave timer display. Call from main loop when WaveManager exists.
   * @param {string} text - Timer text (e.g., "45s" or "---").
   */
  setWaveTimer(text) {
    this._waveTimerEl.textContent = text;
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add src/ui/HUD.js index.html
git commit -m "feat(phase3): implement HUD with gold tween, mana bar, imp count"
```

---

### Task 4: Toolbar (HTML Overlay)

**Files:**
- Replace: `src/ui/Toolbar.js`
- Modify: `index.html` (add Toolbar CSS)

DOM-based UI component. No unit tests.

- [ ] **Step 1: Add Toolbar CSS to index.html**

Add inside the existing `<style>` block:

```css
    /* ── Toolbar ───────────────────────────────────────── */
    #toolbar {
      position: fixed;
      bottom: 0;
      left: 50%;
      transform: translateX(-50%);
      display: flex;
      align-items: stretch;
      gap: 4px;
      padding: 6px 12px;
      background: linear-gradient(0deg, #3a352e 0%, #2a2520 100%);
      border-top: 2px solid #5a4a35;
      border-radius: 8px 8px 0 0;
      box-shadow: 0 -2px 8px rgba(0,0,0,0.6);
      z-index: 200;
      pointer-events: auto;
    }
    .tool-btn {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 4px 8px;
      background: linear-gradient(180deg, #4a4238 0%, #3a3228 100%);
      border: 1px solid #6a5a45;
      border-radius: 4px;
      color: #c0b090;
      cursor: pointer;
      font-family: 'Inter', sans-serif;
      font-size: 11px;
      min-width: 56px;
      transition: background 0.15s;
      user-select: none;
    }
    .tool-btn:hover:not(.disabled) {
      background: linear-gradient(180deg, #5a5248 0%, #4a4238 100%);
    }
    .tool-btn.active {
      background: linear-gradient(180deg, #6a5a3a 0%, #5a4a2a 100%);
      border-color: #c0a060;
      color: #f0d080;
    }
    .tool-btn.disabled {
      opacity: 0.35;
      cursor: not-allowed;
    }
    .tool-name { font-weight: 600; font-size: 11px; }
    .tool-cost { font-size: 9px; color: #908070; }
    .tool-hotkey {
      font-size: 9px;
      color: #706050;
      margin-top: 2px;
    }
    .toolbar-divider {
      width: 1px;
      background: #5a4a35;
      margin: 0 4px;
    }
    #speed-toggle {
      font-family: 'MedievalSharp', cursive;
      font-size: 14px;
    }
```

- [ ] **Step 2: Implement Toolbar**

```js
import { EVENTS, ROOM_TYPES, ROOM_CONFIG } from '../constants.js';

/**
 * Bottom toolbar with room/spell/door tools, speed toggle, and hotkeys.
 * Publishes TOOL_SELECTED and SPEED_CHANGED events on EventBus.
 */
export class Toolbar {
  /**
   * @param {HTMLElement} container - The #hud-overlay element.
   * @param {import('../core/EventBus.js').EventBus} eventBus
   */
  constructor(container, eventBus) {
    this._eventBus = eventBus;
    this._activeTool = 'dig';
    this._speed = 1;
    this._build(container);
    this._bindKeys();
  }

  /** @returns {string} Current active tool id. */
  get activeTool() { return this._activeTool; }

  /** @private */
  _build(container) {
    this._el = document.createElement('div');
    this._el.id = 'toolbar';

    const tools = [
      { id: 'dig', label: 'Dig', hotkey: '1' },
      { id: `room:${ROOM_TYPES.LAIR}`, label: 'Lair', hotkey: '2', cost: `${ROOM_CONFIG[ROOM_TYPES.LAIR].goldPerTile}g` },
      { id: `room:${ROOM_TYPES.HATCHERY}`, label: 'Hatchery', hotkey: '3', cost: `${ROOM_CONFIG[ROOM_TYPES.HATCHERY].goldPerTile}g` },
      { id: `room:${ROOM_TYPES.TREASURY}`, label: 'Treasury', hotkey: '4', cost: `${ROOM_CONFIG[ROOM_TYPES.TREASURY].goldPerTile}g` },
      { id: `room:${ROOM_TYPES.TRAINING_ROOM}`, label: 'Training', hotkey: '5', cost: `${ROOM_CONFIG[ROOM_TYPES.TRAINING_ROOM].goldPerTile}g` },
    ];

    const disabledTools = [
      { id: 'spell:create_imp', label: 'Imp', hotkey: '6', cost: '200m' },
      { id: 'spell:lightning', label: 'Lightning', hotkey: '7', cost: '150m' },
      { id: 'spell:possess', label: 'Possess', hotkey: '8', cost: '100m' },
      { id: 'door', label: 'Door', hotkey: '9', cost: '100g' },
    ];

    for (const t of tools) {
      this._el.appendChild(this._createButton(t, false));
    }

    // Divider
    const div = document.createElement('div');
    div.className = 'toolbar-divider';
    this._el.appendChild(div);

    for (const t of disabledTools) {
      this._el.appendChild(this._createButton(t, true));
    }

    // Another divider
    const div2 = document.createElement('div');
    div2.className = 'toolbar-divider';
    this._el.appendChild(div2);

    // Speed toggle
    this._speedBtn = document.createElement('button');
    this._speedBtn.className = 'tool-btn';
    this._speedBtn.id = 'speed-toggle';
    this._speedBtn.innerHTML = '<span class="tool-name">1×</span>';
    this._speedBtn.addEventListener('click', () => this._toggleSpeed());
    this._el.appendChild(this._speedBtn);

    container.appendChild(this._el);

    // Set initial active state
    this._updateActiveState();
  }

  /** @private */
  _createButton(tool, disabled) {
    const btn = document.createElement('button');
    btn.className = `tool-btn${disabled ? ' disabled' : ''}`;
    btn.dataset.toolId = tool.id;

    let html = `<span class="tool-name">${tool.label}</span>`;
    if (tool.cost) html += `<span class="tool-cost">${tool.cost}</span>`;
    html += `<span class="tool-hotkey">${tool.hotkey}</span>`;
    btn.innerHTML = html;

    if (!disabled) {
      btn.addEventListener('click', () => this._selectTool(tool.id));
    }
    return btn;
  }

  /** @private */
  _bindKeys() {
    this._eventBus.subscribe(EVENTS.INPUT_KEY_DOWN, (e) => {
      const map = {
        'Digit1': 'dig',
        'Digit2': `room:${ROOM_TYPES.LAIR}`,
        'Digit3': `room:${ROOM_TYPES.HATCHERY}`,
        'Digit4': `room:${ROOM_TYPES.TREASURY}`,
        'Digit5': `room:${ROOM_TYPES.TRAINING_ROOM}`,
        'Digit6': 'spell:create_imp',
        'Digit7': 'spell:lightning',
        'Digit8': 'spell:possess',
        'Digit9': 'door',
      };
      const tool = map[e.code];
      if (tool) {
        // Only select if not disabled (tools 6-9 are disabled in Phase 3)
        const btn = this._el.querySelector(`[data-tool-id="${tool}"]`);
        if (btn && !btn.classList.contains('disabled')) {
          this._selectTool(tool);
        }
      }
    });
  }

  /** @private */
  _selectTool(toolId) {
    this._activeTool = toolId;
    this._updateActiveState();
    this._eventBus.publish(EVENTS.TOOL_SELECTED, { tool: toolId });
  }

  /** @private */
  _updateActiveState() {
    for (const btn of this._el.querySelectorAll('.tool-btn')) {
      btn.classList.toggle('active', btn.dataset.toolId === this._activeTool);
    }
  }

  /** @private */
  _toggleSpeed() {
    this._speed = this._speed === 1 ? 2 : 1;
    this._speedBtn.querySelector('.tool-name').textContent = `${this._speed}×`;
    this._eventBus.publish(EVENTS.SPEED_CHANGED, { speed: this._speed });
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add src/ui/Toolbar.js index.html
git commit -m "feat(phase3): implement Toolbar with room tools, hotkeys, speed toggle"
```

---

### Task 5: Tooltip (HTML Overlay)

**Files:**
- Replace: `src/ui/Tooltip.js`
- Modify: `index.html` (add Tooltip CSS)

DOM-based UI component. No unit tests.

- [ ] **Step 1: Add Tooltip CSS to index.html**

Add inside the existing `<style>` block:

```css
    /* ── Tooltip ───────────────────────────────────────── */
    #tooltip {
      position: fixed;
      padding: 8px 12px;
      background: rgba(30, 25, 20, 0.95);
      border: 1px solid #6a5a45;
      border-radius: 4px;
      color: #c0b090;
      font-family: 'Inter', sans-serif;
      font-size: 12px;
      pointer-events: none;
      z-index: 300;
      max-width: 200px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.8);
      display: none;
    }
    .tt-title {
      font-family: 'MedievalSharp', cursive;
      font-size: 14px;
      color: #e0d0a0;
      margin-bottom: 4px;
      text-transform: capitalize;
    }
    .tt-row {
      font-size: 11px;
      color: #a09080;
    }
```

- [ ] **Step 2: Implement Tooltip**

```js
import { TILE_SIZE, TILE_TYPES, ENTITY_TYPES } from '../constants.js';

/**
 * Floating tooltip showing info about the tile/room/creature under cursor.
 * HTML overlay — reads state, never mutates.
 */
export class Tooltip {
  /**
   * @param {HTMLElement} container - The #hud-overlay element.
   * @param {import('../world/World.js').World} world
   * @param {import('../systems/RoomManager.js').RoomManager} roomManager
   * @param {import('../entities/EntityManager.js').EntityManager} entityManager
   */
  constructor(container, world, roomManager, entityManager) {
    this._world = world;
    this._roomManager = roomManager;
    this._entityManager = entityManager;

    this._el = document.createElement('div');
    this._el.id = 'tooltip';
    container.appendChild(this._el);
  }

  /**
   * Update tooltip for the given cursor position.
   * @param {number} screenX
   * @param {number} screenY
   * @param {number} worldX - World-space X in pixels.
   * @param {number} worldY - World-space Y in pixels.
   */
  show(screenX, screenY, worldX, worldY) {
    const tileX = Math.floor(worldX / TILE_SIZE);
    const tileY = Math.floor(worldY / TILE_SIZE);
    let lines = [];

    // Check entities first (highest priority)
    const entities = this._entityManager.getEntitiesInRadius(worldX, worldY, TILE_SIZE * 0.6);
    if (entities.length > 0) {
      const e = entities[0];
      lines.push(`<div class="tt-title">${this._formatType(e.type)}</div>`);
      lines.push(`<div class="tt-row">HP: ${Math.ceil(e.health)} / ${e.maxHealth}</div>`);
      lines.push(`<div class="tt-row">State: ${e.state}</div>`);
      if (e.hunger !== undefined) {
        lines.push(`<div class="tt-row">Hunger: ${Math.floor(e.hunger)}</div>`);
        lines.push(`<div class="tt-row">Energy: ${Math.floor(e.energy)}</div>`);
      }
    }

    // Room info
    const room = this._roomManager.getRoomAt(tileX, tileY);
    if (room && lines.length === 0) {
      lines.push(`<div class="tt-title">${this._formatType(room.type)}</div>`);
      lines.push(`<div class="tt-row">Tiles: ${room.tiles.length}</div>`);
    }

    // Tile info (fallback)
    const tile = this._world.getTile(tileX, tileY);
    if (tile && lines.length === 0) {
      lines.push(`<div class="tt-title">${this._formatType(tile)}</div>`);
    }

    if (lines.length === 0) {
      this.hide();
      return;
    }

    this._el.innerHTML = lines.join('');
    this._el.style.display = 'block';

    // Position near cursor, keep on screen
    const pad = 16;
    let x = screenX + pad;
    let y = screenY + pad;

    // Need to measure after display is set
    const rect = this._el.getBoundingClientRect();
    if (x + rect.width > window.innerWidth) x = screenX - rect.width - pad;
    if (y + rect.height > window.innerHeight) y = screenY - rect.height - pad;

    this._el.style.left = `${x}px`;
    this._el.style.top = `${y}px`;
  }

  /** Hide the tooltip. */
  hide() {
    this._el.style.display = 'none';
  }

  /**
   * Format type string for display (e.g., "gold_vein" → "Gold Vein").
   * @private
   */
  _formatType(type) {
    return type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add src/ui/Tooltip.js index.html
git commit -m "feat(phase3): implement Tooltip with tile/room/creature info"
```

---

### Task 6: Room Floor Art in TileRenderer

**Files:**
- Modify: `src/rendering/TileRenderer.js`

No unit tests (rendering-only). TileRenderer needs a RoomManager reference to know which tiles are rooms and draw room-specific floor art.

- [ ] **Step 1: Modify TileRenderer constructor to accept RoomManager**

Add `roomManager` parameter:

```js
constructor(ctx, world, camera, roomManager) {
    this._ctx = ctx;
    this._world = world;
    this._camera = camera;
    this._roomManager = roomManager;
    // ... rest unchanged
}
```

- [ ] **Step 2: Modify render method to check for room floor art**

In the `render()` method, after getting tile type and before calling `_drawTile`, add room check:

```js
render(_alpha) {
    const ctx = this._ctx;
    const bounds = this._camera.getViewportTileBounds();

    for (let y = bounds.startY; y < bounds.endY; y++) {
      for (let x = bounds.startX; x < bounds.endX; x++) {
        const type = this._world.getTile(x, y);
        if (type === null) continue;

        const [sx, sy] = this._camera.worldToScreen(x * TILE_SIZE, y * TILE_SIZE);
        const size = TILE_SIZE * this._camera.zoom;
        const noise = this._noiseSeed[y * this._world.width + x];

        // Draw base tile
        this._drawTile(ctx, type, sx, sy, size, noise, x, y);

        // Draw room overlay if this tile belongs to a room
        if (this._roomManager) {
          const room = this._roomManager.getRoomAt(x, y);
          if (room) {
            this._drawRoomOverlay(ctx, room.type, sx, sy, size, noise);
          }
        }
      }
    }
  }
```

- [ ] **Step 3: Add room-specific drawing methods**

Add to TileRenderer class, after existing draw methods:

```js
  /** @private */
  _drawRoomOverlay(ctx, roomType, x, y, size, noise) {
    switch (roomType) {
      case ROOM_TYPES.DUNGEON_HEART:
        this._drawDungeonHeartOverlay(ctx, x, y, size, noise);
        break;
      case ROOM_TYPES.LAIR:
        this._drawLairOverlay(ctx, x, y, size, noise);
        break;
      case ROOM_TYPES.HATCHERY:
        this._drawHatcheryOverlay(ctx, x, y, size, noise);
        break;
      case ROOM_TYPES.TREASURY:
        this._drawTreasuryOverlay(ctx, x, y, size, noise);
        break;
      case ROOM_TYPES.TRAINING_ROOM:
        this._drawTrainingOverlay(ctx, x, y, size, noise);
        break;
    }
  }

  /** Dungeon Heart: pulsing red glow. @private */
  _drawDungeonHeartOverlay(ctx, x, y, size, noise) {
    const t = performance.now() / 1000;
    const pulse = 0.15 + Math.sin(t * 2) * 0.08;
    ctx.fillStyle = `rgba(200, 40, 40, ${pulse})`;
    ctx.fillRect(x, y, size, size);
    // Center gem
    ctx.fillStyle = '#e02020';
    ctx.beginPath();
    const cx = x + size / 2;
    const cy = y + size / 2;
    ctx.arc(cx, cy, size / 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = `rgba(255, 100, 100, ${0.5 + Math.sin(t * 3) * 0.3})`;
    ctx.beginPath();
    ctx.arc(cx, cy, size / 10, 0, Math.PI * 2);
    ctx.fill();
  }

  /** Lair: bedding texture (brown patches). @private */
  _drawLairOverlay(ctx, x, y, size, noise) {
    ctx.fillStyle = 'rgba(100, 70, 40, 0.3)';
    ctx.fillRect(x + size * 0.15, y + size * 0.15, size * 0.7, size * 0.7);
    // Hay strands
    ctx.strokeStyle = 'rgba(180, 150, 80, 0.4)';
    ctx.lineWidth = 0.5;
    for (let i = 0; i < 4; i++) {
      const sx = x + ((noise * (i + 1) * 13) % 20 + 6) * size / 32;
      const sy = y + ((noise * (i + 2) * 7) % 20 + 6) * size / 32;
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(sx + size / 8, sy + size / 12);
      ctx.stroke();
    }
  }

  /** Hatchery: chicken coop/food tiles. @private */
  _drawHatcheryOverlay(ctx, x, y, size, noise) {
    ctx.fillStyle = 'rgba(60, 100, 40, 0.25)';
    ctx.fillRect(x, y, size, size);
    // Food bowl shape
    ctx.fillStyle = 'rgba(140, 100, 50, 0.5)';
    ctx.beginPath();
    ctx.ellipse(x + size / 2, y + size * 0.6, size / 4, size / 8, 0, 0, Math.PI * 2);
    ctx.fill();
    // Food bits
    ctx.fillStyle = 'rgba(200, 160, 60, 0.6)';
    for (let i = 0; i < 3; i++) {
      const fx = x + size * 0.35 + (noise * (i + 1) % 10) * size / 32;
      const fy = y + size * 0.5 + (noise * (i + 2) % 6) * size / 32;
      ctx.fillRect(fx, fy, size / 12, size / 12);
    }
  }

  /** Treasury: gold pile pattern. @private */
  _drawTreasuryOverlay(ctx, x, y, size, noise) {
    ctx.fillStyle = 'rgba(180, 140, 30, 0.15)';
    ctx.fillRect(x, y, size, size);
    // Gold coins
    ctx.fillStyle = 'rgba(240, 200, 60, 0.5)';
    for (let i = 0; i < 5; i++) {
      const cx = x + ((noise * (i + 1) * 11) % 24 + 4) * size / 32;
      const cy = y + ((noise * (i + 2) * 17) % 24 + 4) * size / 32;
      ctx.beginPath();
      ctx.arc(cx, cy, size / 14, 0, Math.PI * 2);
      ctx.fill();
    }
    // Gold highlight
    ctx.fillStyle = 'rgba(255, 230, 100, 0.3)';
    ctx.beginPath();
    ctx.arc(x + size / 2, y + size / 2, size / 5, 0, Math.PI * 2);
    ctx.fill();
  }

  /** Training Room: target dummy / crossed swords. @private */
  _drawTrainingOverlay(ctx, x, y, size, noise) {
    ctx.fillStyle = 'rgba(80, 40, 40, 0.2)';
    ctx.fillRect(x, y, size, size);
    // Training dummy (simple circle + line)
    ctx.strokeStyle = 'rgba(160, 120, 80, 0.5)';
    ctx.lineWidth = 1;
    const cx = x + size / 2;
    const cy = y + size / 2;
    // Stand
    ctx.beginPath();
    ctx.moveTo(cx, cy - size / 5);
    ctx.lineTo(cx, cy + size / 4);
    ctx.stroke();
    // Cross bar
    ctx.beginPath();
    ctx.moveTo(cx - size / 6, cy - size / 10);
    ctx.lineTo(cx + size / 6, cy - size / 10);
    ctx.stroke();
    // Head
    ctx.beginPath();
    ctx.arc(cx, cy - size / 4, size / 10, 0, Math.PI * 2);
    ctx.stroke();
  }
```

- [ ] **Step 4: Add ROOM_TYPES import to TileRenderer**

Add to the import line at the top of TileRenderer.js:

```js
import { TILE_TYPES, TILE_SIZE, COLORS, ROOM_TYPES } from '../constants.js';
```

- [ ] **Step 5: Commit**

```bash
git add src/rendering/TileRenderer.js
git commit -m "feat(phase3): add room-specific floor art overlays to TileRenderer"
```

---

### Task 7: Imp Room Integration + Gem Seam Handling

**Files:**
- Modify: `src/entities/Imp.js`
- Modify: `tests/entities/Imp.test.js`

- [ ] **Step 1: Add new tests to Imp.test.js**

Append to the existing `describe('Imp', ...)` block:

```js
  it('seeks Hatchery room when hungry (if RoomManager provided)', () => {
    const cx = Math.floor(world.width / 2);
    const cy = Math.floor(world.height / 2);
    // Create RoomManager with a Hatchery nearby
    const roomManager = new RoomManager(eventBus);
    // Hatchery at (cx+3, cy)
    roomManager.placeRoom('hatchery', [
      { x: cx + 3, y: cy }, { x: cx + 3, y: cy + 1 },
      { x: cx + 4, y: cy }, { x: cx + 4, y: cy + 1 },
    ]);
    const imp = new Imp(cx * TILE_SIZE + 16, cy * TILE_SIZE + 16, world, eventBus, jobQueue, roomManager);
    imp.hunger = IMP_STATS.hungerThreshold - 1;
    imp.update(0.016);
    // Should be MOVING toward hatchery, not eating in place
    expect(imp.state).toBe(CREATURE_STATES.MOVING);
  });

  it('eats in place when no RoomManager provided', () => {
    const cx = Math.floor(world.width / 2);
    const cy = Math.floor(world.height / 2);
    const imp = new Imp(cx * TILE_SIZE + 16, cy * TILE_SIZE + 16, world, eventBus, jobQueue);
    imp.hunger = IMP_STATS.hungerThreshold - 1;
    imp.update(0.016);
    expect(imp.state).toBe(CREATURE_STATES.EATING);
  });

  it('seeks Lair room when tired (if RoomManager provided)', () => {
    const cx = Math.floor(world.width / 2);
    const cy = Math.floor(world.height / 2);
    const roomManager = new RoomManager(eventBus);
    // Lair at (cx+3, cy)
    roomManager.placeRoom('lair', [
      { x: cx + 3, y: cy }, { x: cx + 3, y: cy + 1 },
      { x: cx + 4, y: cy }, { x: cx + 4, y: cy + 1 },
    ]);
    const imp = new Imp(cx * TILE_SIZE + 16, cy * TILE_SIZE + 16, world, eventBus, jobQueue, roomManager);
    imp.energy = IMP_STATS.energyThreshold - 1;
    imp.hunger = IMP_STATS.maxHunger;
    imp.update(0.016);
    expect(imp.state).toBe(CREATURE_STATES.MOVING);
  });

  it('continuously mines gem seam without consuming tile', () => {
    const cx = Math.floor(world.width / 2);
    const cy = Math.floor(world.height / 2);
    world.setTile(cx + 6, cy, TILE_TYPES.GEM_SEAM);
    jobQueue.addDigJob(cx + 6, cy);
    const imp = new Imp(cx * TILE_SIZE + 16, cy * TILE_SIZE + 16, world, eventBus, jobQueue);
    imp.update(0.016); // Claim and start moving
    // Teleport imp adjacent to dig target
    imp.x = (cx + 5) * TILE_SIZE + TILE_SIZE / 2;
    imp.y = cy * TILE_SIZE + TILE_SIZE / 2;
    imp.state = CREATURE_STATES.DIGGING;
    imp._digProgress = 0;
    imp._currentJob = jobQueue.getJobForImp(imp.id);
    // Run dig past completion (3s dig + 2s mining = 5s at 0.016 = 313 ticks)
    const goldEvents = [];
    eventBus.subscribe(EVENTS.TILE_DUG, (e) => { if (e.goldAmount) goldEvents.push(e); });
    for (let i = 0; i < 400; i++) imp.update(0.016);
    // Gem seam tile preserved
    expect(world.getTile(cx + 6, cy)).toBe(TILE_TYPES.GEM_SEAM);
    // Imp should still be DIGGING (continuous mining)
    expect(imp.state).toBe(CREATURE_STATES.DIGGING);
    // Should have published gold events from continuous mining
    expect(goldEvents.length).toBeGreaterThan(0);
    expect(goldEvents[0].goldAmount).toBe(RESOURCES.GEM_SEAM_GOLD_PER_SEC);
  });
```

**Important notes for the test file:**
- Add `import { RoomManager } from '../../src/systems/RoomManager.js';` as a static import at the top of the file (alongside other imports). Do NOT use dynamic `import()`.
- Add `RESOURCES` to the existing constants import: `import { TILE_TYPES, TILE_SIZE, CREATURE_STATES, IMP_STATS, EVENTS, RESOURCES } from '../../src/constants.js';`

- [ ] **Step 2: Run tests to verify new tests fail**

Run: `npx vitest run tests/entities/Imp.test.js`
Expected: New tests FAIL (Imp doesn't accept roomManager yet).

- [ ] **Step 3: Modify Imp constructor to accept optional RoomManager**

In `src/entities/Imp.js`, change constructor signature and imports:

```js
import { Entity } from './Entity.js';
import { Pathfinder } from '../world/Pathfinder.js';
import { ENTITY_TYPES, CREATURE_STATES, IMP_STATS, TILE_SIZE, TILE_TYPES, EVENTS, ROOM_TYPES, RESOURCES } from '../constants.js';

export class Imp extends Entity {
  /**
   * @param {number} x
   * @param {number} y
   * @param {import('../world/World.js').World} world
   * @param {import('../core/EventBus.js').EventBus} eventBus
   * @param {import('../systems/JobQueue.js').JobQueue} jobQueue
   * @param {import('../systems/RoomManager.js').RoomManager|null} [roomManager=null]
   */
  constructor(x, y, world, eventBus, jobQueue, roomManager = null) {
    super(ENTITY_TYPES.IMP, x, y);
    this.health = IMP_STATS.hp;
    this.maxHealth = IMP_STATS.hp;
    this.hunger = IMP_STATS.maxHunger;
    this.energy = IMP_STATS.maxEnergy;
    this.happiness = IMP_STATS.maxHappiness;
    this.state = CREATURE_STATES.IDLE;

    this._world = world;
    this._eventBus = eventBus;
    this._jobQueue = jobQueue;
    this._roomManager = roomManager;

    /** @type {Array<{x:number,y:number}>|null} */
    this._path = null;
    this._pathIndex = 0;
    this._currentJob = null;
    this._digProgress = 0;
    this._idleTimer = 0;
    this._wanderTarget = null;
    this._facingRight = true;
    this._eatTimer = 0;
    this._sleepTimer = 0;
    /** @type {'dig'|'eat'|'sleep'|'wander'|null} */
    this._moveGoal = null;
    /** @type {boolean} True when continuously mining a gem seam. */
    this._miningGemSeam = false;
    /** @type {number} Accumulator for gem seam gold ticks. */
    this._mineAccumulator = 0;
  }
```

- [ ] **Step 4: Modify _enterEat to seek Hatchery**

Replace the existing `_enterEat()` method:

```js
  /** @private */
  _enterEat() {
    if (this.state === CREATURE_STATES.EATING) return;
    if (this._currentJob) {
      this._jobQueue.releaseJob(this.id);
      this._currentJob = null;
      this._miningGemSeam = false;
    }

    // Try to find a Hatchery room tile
    if (this._roomManager) {
      const tiles = this._roomManager.getRoomTilesOfType(ROOM_TYPES.HATCHERY);
      if (tiles.length > 0) {
        const target = this._findNearestRoomTile(tiles);
        if (target) {
          this._pathToTile(target.x, target.y);
          if (this._path) {
            this._moveGoal = 'eat';
            this.state = CREATURE_STATES.MOVING;
            return;
          }
        }
      }
    }

    // Fallback: eat in place
    this.state = CREATURE_STATES.EATING;
    this._eatTimer = 0;
    this._path = null;
    this._moveGoal = null;
  }
```

- [ ] **Step 5: Modify _enterSleep to seek Lair**

Replace the existing `_enterSleep()` method:

```js
  /** @private */
  _enterSleep() {
    if (this.state === CREATURE_STATES.SLEEPING) return;
    if (this._currentJob) {
      this._jobQueue.releaseJob(this.id);
      this._currentJob = null;
      this._miningGemSeam = false;
    }

    // Try to find a Lair room tile
    if (this._roomManager) {
      const tiles = this._roomManager.getRoomTilesOfType(ROOM_TYPES.LAIR);
      if (tiles.length > 0) {
        const target = this._findNearestRoomTile(tiles);
        if (target) {
          this._pathToTile(target.x, target.y);
          if (this._path) {
            this._moveGoal = 'sleep';
            this.state = CREATURE_STATES.MOVING;
            return;
          }
        }
      }
    }

    // Fallback: sleep in place
    this.state = CREATURE_STATES.SLEEPING;
    this._sleepTimer = 0;
    this._path = null;
    this._moveGoal = null;
  }
```

- [ ] **Step 6: Add _findNearestRoomTile helper**

Add after `_pathToAdjacentWalkable`:

```js
  /**
   * Find the nearest tile from a list of room tiles (Manhattan distance).
   * @param {{x:number, y:number}[]} tiles
   * @returns {{x:number, y:number}|null}
   * @private
   */
  _findNearestRoomTile(tiles) {
    const { tx, ty } = this.getTile(TILE_SIZE);
    let best = null;
    let bestDist = Infinity;
    for (const t of tiles) {
      const dist = Math.abs(t.x - tx) + Math.abs(t.y - ty);
      if (dist < bestDist) {
        bestDist = dist;
        best = t;
      }
    }
    return best;
  }
```

- [ ] **Step 7: Modify _updateMove to handle moveGoal**

Replace the `_updateMove` method:

```js
  /** @private */
  _updateMove(dt) {
    if (!this._path || this._pathIndex >= this._path.length) {
      // Arrived at destination — check moveGoal
      if (this._moveGoal === 'eat') {
        this.state = CREATURE_STATES.EATING;
        this._eatTimer = 0;
        this._moveGoal = null;
        return;
      }
      if (this._moveGoal === 'sleep') {
        this.state = CREATURE_STATES.SLEEPING;
        this._sleepTimer = 0;
        this._moveGoal = null;
        return;
      }
      if (this._currentJob) {
        // Check if adjacent to dig target
        const { tx, ty } = this.getTile(TILE_SIZE);
        const job = this._currentJob;
        const dist = Math.abs(tx - job.x) + Math.abs(ty - job.y);
        if (dist <= 1) {
          this.state = CREATURE_STATES.DIGGING;
          this._digProgress = 0;
          this._moveGoal = null;
          return;
        }
        // Try to pathfind closer
        this._pathToAdjacentWalkable(job.x, job.y);
        if (!this._path) {
          this._jobQueue.releaseJob(this.id);
          this._currentJob = null;
          this.state = CREATURE_STATES.IDLE;
          this._moveGoal = null;
        }
      } else {
        this.state = CREATURE_STATES.IDLE;
        this._moveGoal = null;
      }
      return;
    }
    this._followPath(dt);
  }
```

- [ ] **Step 8: Modify _updateDig for gem seam continuous mining**

Replace the `_updateDig` method. Gem seams are NOT consumed — the Imp stays
and continuously mines at `RESOURCES.GEM_SEAM_GOLD_PER_SEC` gold/sec:

```js
  /** @private */
  _updateDig(dt) {
    if (!this._currentJob) {
      this.state = CREATURE_STATES.IDLE;
      this._miningGemSeam = false;
      return;
    }
    const { x, y } = this._currentJob;
    const tileType = this._world.getTile(x, y);

    // Continuous gem seam mining mode
    if (this._miningGemSeam) {
      this._mineAccumulator += dt;
      if (this._mineAccumulator >= 1.0) {
        this._mineAccumulator -= 1.0;
        this._eventBus.publish(EVENTS.TILE_DUG, {
          x, y, tileType, goldAmount: RESOURCES.GEM_SEAM_GOLD_PER_SEC,
        });
      }
      return;
    }

    this._digProgress += dt;
    if (this._digProgress >= IMP_STATS.digTime) {
      if (tileType === TILE_TYPES.GEM_SEAM) {
        // Gem seam: don't consume tile, enter continuous mining
        this._miningGemSeam = true;
        this._mineAccumulator = 0;
        this._eventBus.publish(EVENTS.TILE_DUG, { x, y, tileType });
        Pathfinder.clearCache();
        return;
      }
      // Normal dig: convert to floor
      this._world.setTile(x, y, TILE_TYPES.UNCLAIMED_FLOOR);
      this._claimAdjacentFloor(x, y);
      this._eventBus.publish(EVENTS.TILE_DUG, { x, y, tileType });
      Pathfinder.clearCache();
      this._jobQueue.completeDigJob(x, y);
      this._currentJob = null;
      this._digProgress = 0;
      this.state = CREATURE_STATES.IDLE;
    }
  }
```

- [ ] **Step 9: Modify _enterFlee to reset gem seam mining**

In the existing `_enterFlee()` method, add `this._miningGemSeam = false;` after releasing the job:

```js
  _enterFlee() {
    if (this.state === CREATURE_STATES.FLEEING) return;
    this.state = CREATURE_STATES.FLEEING;
    if (this._currentJob) {
      this._jobQueue.releaseJob(this.id);
      this._currentJob = null;
      this._miningGemSeam = false;
    }
    // Path toward center of map (dungeon heart area)
    const cx = Math.floor(this._world.width / 2);
    const cy = Math.floor(this._world.height / 2);
    this._pathToTile(cx, cy);
  }
```

- [ ] **Step 10: Set _moveGoal = 'dig' in _decideAction**

In the `_decideAction` method, after successfully claiming a dig job and finding a path, add `this._moveGoal = 'dig';`:

```js
  _decideAction() {
    if (this.energy > IMP_STATS.energyThreshold && !this._currentJob) {
      const job = this._jobQueue.claimDigJob(this.id);
      if (job) {
        this._currentJob = job;
        this._pathToAdjacentWalkable(job.x, job.y);
        if (!this._path) {
          this._jobQueue.releaseJob(this.id);
          this._currentJob = null;
        } else {
          this._moveGoal = 'dig';
          return;
        }
      }
    }
    this.state = CREATURE_STATES.IDLE;
    this._moveGoal = null;
  }
```

- [ ] **Step 11: Run all Imp tests**

Run: `npx vitest run tests/entities/Imp.test.js`
Expected: All tests PASS (including 4 new tests: seek Hatchery, eat in place, seek Lair, gem seam continuous mining).

- [ ] **Step 12: Commit**

```bash
git add src/entities/Imp.js tests/entities/Imp.test.js
git commit -m "feat(phase3): Imp seeks Hatchery/Lair rooms, gem seam dig preserved"
```

---

### Task 8: Room Placement Flow + main.js Integration

**Files:**
- Modify: `src/main.js`
- Modify: `index.html` (add placement preview CSS)

This is the largest task — wires up all Phase 3 systems and implements the room placement flow (tool selection → tile painting → green/red preview → confirm/cancel).

- [ ] **Step 1: Add placement CSS to index.html**

```css
    /* ── Placement Preview ─────────────────────────────── */
    #placement-info {
      position: fixed;
      bottom: 60px;
      left: 50%;
      transform: translateX(-50%);
      padding: 6px 16px;
      background: rgba(30, 25, 20, 0.9);
      border: 1px solid #6a5a45;
      border-radius: 4px;
      color: #c0b090;
      font-family: 'Inter', sans-serif;
      font-size: 13px;
      z-index: 201;
      pointer-events: none;
      display: none;
    }
    .placement-valid { color: #80c040; }
    .placement-invalid { color: #c04040; }
```

- [ ] **Step 2: Rewrite main.js with all Phase 3 integrations**

Complete replacement of `src/main.js`:

```js
import { EventBus } from './core/EventBus.js';
import { GameLoop } from './core/GameLoop.js';
import { World } from './world/World.js';
import { MapGenerator } from './world/MapGenerator.js';
import { Pathfinder } from './world/Pathfinder.js';
import { Camera } from './rendering/Camera.js';
import { TileRenderer } from './rendering/TileRenderer.js';
import { Minimap } from './rendering/Minimap.js';
import { InputManager } from './input/InputManager.js';
import { EntityManager } from './entities/EntityManager.js';
import { EntityRenderer } from './rendering/EntityRenderer.js';
import { ParticleSystem } from './rendering/ParticleSystem.js';
import { JobQueue } from './systems/JobQueue.js';
import { ResourceManager } from './systems/ResourceManager.js';
import { RoomManager } from './systems/RoomManager.js';
import { Imp } from './entities/Imp.js';
import { HUD } from './ui/HUD.js';
import { Toolbar } from './ui/Toolbar.js';
import { Tooltip } from './ui/Tooltip.js';
import {
  COLORS, EVENTS, TILE_SIZE, TILE_TYPES, ROOM_TYPES,
  ROOM_CONFIG, RESOURCES, ENTITY_TYPES,
} from './constants.js';

// ── Canvas setup ─────────────────────────────────────
/** @type {HTMLCanvasElement} */
const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
const fpsEl = document.getElementById('fps-counter');
const hudOverlay = document.getElementById('hud-overlay');

function resizeCanvas() {
  const dpr = window.devicePixelRatio || 1;
  canvas.width = window.innerWidth * dpr;
  canvas.height = window.innerHeight * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  if (camera) camera.resize(window.innerWidth, window.innerHeight);
}

// ── Initialize systems ───────────────────────────────
const eventBus = new EventBus();
const world = new World();

const seed = Math.floor(Math.random() * 1000000);
MapGenerator.generate(world, seed);

const camera = new Camera(window.innerWidth, window.innerHeight);
const roomManager = new RoomManager(eventBus);
const tileRenderer = new TileRenderer(ctx, world, camera, roomManager);
const minimap = new Minimap(ctx, world, camera, eventBus);
const inputManager = new InputManager(canvas, camera, eventBus);

const entityManager = new EntityManager();
const entityRenderer = new EntityRenderer(ctx, entityManager, camera);
const particleSystem = new ParticleSystem(ctx, camera);
const jobQueue = new JobQueue(eventBus);
const resourceManager = new ResourceManager(eventBus);

// UI
const hud = new HUD(hudOverlay, eventBus, resourceManager, entityManager);
const toolbar = new Toolbar(hudOverlay, eventBus);
const tooltip = new Tooltip(hudOverlay, world, roomManager, entityManager);

// ── Register Dungeon Heart room ──────────────────────
const heartCx = Math.floor(world.width / 2);
const heartCy = Math.floor(world.height / 2);
const heartTiles = [];
for (let dy = -1; dy <= 1; dy++) {
  for (let dx = -1; dx <= 1; dx++) {
    heartTiles.push({ x: heartCx + dx, y: heartCy + dy });
  }
}
roomManager.placeRoom(ROOM_TYPES.DUNGEON_HEART, heartTiles);

// ── Spawn initial imp ────────────────────────────────
const heartX = heartCx * TILE_SIZE + TILE_SIZE / 2;
const heartY = heartCy * TILE_SIZE + TILE_SIZE / 2;
const startImp = new Imp(heartX, heartY, world, eventBus, jobQueue, roomManager);
entityManager.add(startImp);

// ── Room placement state ─────────────────────────────
let activeTool = 'dig';
/** @type {Set<string>} "x,y" keys for pending room tiles */
const pendingRoomTiles = new Set();
let hoverTileX = -1;
let hoverTileY = -1;

// Placement info overlay
const placementInfoEl = document.createElement('div');
placementInfoEl.id = 'placement-info';
hudOverlay.appendChild(placementInfoEl);

/** Get room type from tool id (e.g., "room:lair" → "lair"). */
function getRoomTypeFromTool(tool) {
  if (tool.startsWith('room:')) return tool.slice(5);
  return null;
}

/** Check if a tile is valid for the current room placement. */
function isValidRoomTile(tx, ty) {
  const tile = world.getTile(tx, ty);
  if (tile !== TILE_TYPES.CLAIMED_FLOOR) return false;
  if (roomManager.isRoomTile(tx, ty)) return false;
  return true;
}

/** Update placement info display. */
function updatePlacementInfo() {
  const roomType = getRoomTypeFromTool(activeTool);
  if (!roomType || pendingRoomTiles.size === 0) {
    placementInfoEl.style.display = 'none';
    return;
  }
  const config = ROOM_CONFIG[roomType];
  const count = pendingRoomTiles.size;
  const cost = count * config.goldPerTile;
  const minMet = count >= config.minTiles;
  const canAfford = resourceManager.gold >= cost;

  placementInfoEl.style.display = 'block';
  placementInfoEl.innerHTML = `
    <span>${roomType.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</span>:
    <span>${count} tiles</span> |
    <span class="${canAfford ? 'placement-valid' : 'placement-invalid'}">${cost}g</span> |
    <span class="${minMet ? 'placement-valid' : 'placement-invalid'}">Min: ${config.minTiles}</span> |
    <span>Enter=confirm Esc=cancel</span>
  `;
}

// ── Event wiring ─────────────────────────────────────

// Tool selection
eventBus.subscribe(EVENTS.TOOL_SELECTED, (e) => {
  // Cancel any pending room placement if switching tools
  if (activeTool !== e.tool) {
    pendingRoomTiles.clear();
    updatePlacementInfo();
  }
  activeTool = e.tool;
});

// Speed toggle
eventBus.subscribe(EVENTS.SPEED_CHANGED, (e) => {
  gameLoop.setSpeed(e.speed);
});

// Mouse move — update hover tile + tooltip
eventBus.subscribe(EVENTS.INPUT_MOUSE_MOVE, (e) => {
  hoverTileX = e.tileX;
  hoverTileY = e.tileY;
  tooltip.show(e.screenX, e.screenY, e.worldX, e.worldY);
});

// Click handling
eventBus.subscribe(EVENTS.INPUT_CLICK, (e) => {
  // Minimap click first
  if (minimap.handleClick(e.screenX, e.screenY)) return;

  const roomType = getRoomTypeFromTool(activeTool);

  if (roomType) {
    // Room placement mode — toggle tile
    const key = `${e.tileX},${e.tileY}`;
    if (pendingRoomTiles.has(key)) {
      pendingRoomTiles.delete(key);
    } else if (isValidRoomTile(e.tileX, e.tileY)) {
      pendingRoomTiles.add(key);
    }
    updatePlacementInfo();
    return;
  }

  if (activeTool === 'dig') {
    // Dig mode
    const { tileX, tileY } = e;
    if (world.isDiggable(tileX, tileY)) {
      const neighbors = world.getNeighbors(tileX, tileY);
      const hasWalkableNeighbor = neighbors.some(n => world.isWalkable(n.x, n.y));
      if (hasWalkableNeighbor) {
        jobQueue.addDigJob(tileX, tileY);
        Pathfinder.clearCache();
      }
    }
  }
});

// Key handling for room placement confirm/cancel
eventBus.subscribe(EVENTS.INPUT_KEY_DOWN, (e) => {
  const roomType = getRoomTypeFromTool(activeTool);

  if (e.code === 'Enter' && roomType && pendingRoomTiles.size > 0) {
    const config = ROOM_CONFIG[roomType];
    // Re-validate all tiles (state may have changed since they were clicked)
    const tiles = [];
    for (const key of pendingRoomTiles) {
      const [x, y] = key.split(',').map(Number);
      if (isValidRoomTile(x, y)) {
        tiles.push({ x, y });
      }
    }

    // Validate min tiles
    if (tiles.length < config.minTiles) return;

    // Validate cost
    const cost = tiles.length * config.goldPerTile;
    if (!resourceManager.spendGold(cost)) return;

    // Place room
    roomManager.placeRoom(roomType, tiles);

    // If treasury, update gold cap
    if (roomType === ROOM_TYPES.TREASURY) {
      const totalTreasury = roomManager.getTotalTilesOfType(ROOM_TYPES.TREASURY);
      resourceManager.setTreasuryTileCount(totalTreasury);
    }

    pendingRoomTiles.clear();
    updatePlacementInfo();
  }

  if (e.code === 'Escape') {
    pendingRoomTiles.clear();
    updatePlacementInfo();
  }
});

// Gold from digging
eventBus.subscribe(EVENTS.TILE_DUG, (e) => {
  const wx = e.x * TILE_SIZE + TILE_SIZE / 2;
  const wy = e.y * TILE_SIZE + TILE_SIZE / 2;

  if (e.tileType === TILE_TYPES.GOLD_VEIN) {
    resourceManager.earnGold(RESOURCES.GOLD_VEIN_YIELD);
    particleSystem.burst(wx, wy, '#f0c040', 15, { speed: 100, life: 0.8, size: 3 });
  } else if (e.tileType === TILE_TYPES.GEM_SEAM) {
    if (e.goldAmount) {
      // Continuous mining yield (goldAmount = GEM_SEAM_GOLD_PER_SEC)
      resourceManager.earnGold(e.goldAmount);
    } else {
      // Initial dig completion — particles only
      particleSystem.burst(wx, wy, '#aa60e0', 12, { speed: 80, life: 0.6, size: 3 });
    }
  } else {
    particleSystem.burst(wx, wy, '#8a7050', 8, { speed: 60, life: 0.5, size: 2 });
  }
});

// Update treasury cap when rooms change
eventBus.subscribe(EVENTS.ROOM_REMOVED, (e) => {
  if (e.type === ROOM_TYPES.TREASURY) {
    const totalTreasury = roomManager.getTotalTilesOfType(ROOM_TYPES.TREASURY);
    resourceManager.setTreasuryTileCount(totalTreasury);
  }
});

window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// ── Game loop ────────────────────────────────────────
function update(dt) {
  inputManager.update(dt);
  entityManager.update(dt);
  particleSystem.update(dt);
  resourceManager.update(dt);
}

let lastRenderTime = performance.now();

function render(alpha) {
  const now = performance.now();
  const renderDt = (now - lastRenderTime) / 1000;
  lastRenderTime = now;

  const w = window.innerWidth;
  const h = window.innerHeight;
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = COLORS.BG;
  ctx.fillRect(0, 0, w, h);

  tileRenderer.render(alpha);
  entityRenderer.render(alpha);
  particleSystem.render();
  minimap.render();

  // Dig queue highlights
  for (const job of jobQueue.getAllDigJobs()) {
    const [sx, sy] = camera.worldToScreen(job.x * TILE_SIZE, job.y * TILE_SIZE);
    const size = TILE_SIZE * camera.zoom;
    ctx.fillStyle = job.assignedTo ? 'rgba(255, 200, 0, 0.2)' : 'rgba(255, 255, 0, 0.3)';
    ctx.fillRect(sx, sy, size, size);
  }

  // Room placement preview
  const roomType = getRoomTypeFromTool(activeTool);
  if (roomType) {
    const size = TILE_SIZE * camera.zoom;

    // Draw pending tiles (green)
    for (const key of pendingRoomTiles) {
      const [tx, ty] = key.split(',').map(Number);
      const [sx, sy] = camera.worldToScreen(tx * TILE_SIZE, ty * TILE_SIZE);
      ctx.fillStyle = 'rgba(80, 200, 80, 0.3)';
      ctx.fillRect(sx, sy, size, size);
      ctx.strokeStyle = 'rgba(80, 200, 80, 0.6)';
      ctx.lineWidth = 1;
      ctx.strokeRect(sx, sy, size, size);
    }

    // Draw hover tile (green if valid, red if invalid)
    if (hoverTileX >= 0 && hoverTileY >= 0) {
      const key = `${hoverTileX},${hoverTileY}`;
      if (!pendingRoomTiles.has(key)) {
        const valid = isValidRoomTile(hoverTileX, hoverTileY);
        const [sx, sy] = camera.worldToScreen(hoverTileX * TILE_SIZE, hoverTileY * TILE_SIZE);
        ctx.fillStyle = valid ? 'rgba(80, 200, 80, 0.2)' : 'rgba(200, 40, 40, 0.2)';
        ctx.fillRect(sx, sy, size, size);
        ctx.strokeStyle = valid ? 'rgba(80, 200, 80, 0.4)' : 'rgba(200, 40, 40, 0.4)';
        ctx.lineWidth = 1;
        ctx.strokeRect(sx, sy, size, size);
      }
    }
  }

  // HUD update (tween gold, imp count)
  hud.update(renderDt);

  fpsEl.textContent = `FPS: ${gameLoop.fps}`;
}

const gameLoop = new GameLoop(update, render);
gameLoop.start();
```

- [ ] **Step 3: Run all tests to confirm no regressions**

Run: `npx vitest run`
Expected: All tests PASS. No regressions from main.js changes (main.js is not unit-tested, only integration).

- [ ] **Step 4: Commit**

```bash
git add src/main.js index.html
git commit -m "feat(phase3): integrate ResourceManager, RoomManager, HUD, Toolbar, Tooltip, room placement flow"
```

---

### Task 9: Verification

- [ ] **Step 1: Run full test suite**

Run: `npx vitest run`
Expected: All tests PASS (~115 tests: 93 existing + 11 ResourceManager + 9 RoomManager + 4 Imp additions minus test adjustments).

- [ ] **Step 2: Launch dev server and visual verification**

Run: `npx vite`

Check the following manually or via browser automation:
1. **HUD visible** — top bar shows gold (0), mana bar (filling), imp count (1), wave timer (---).
2. **Toolbar visible** — bottom bar shows Dig (active), Lair, Hatchery, Treasury, Training buttons. Speed toggle shows 1×.
3. **Mana regenerates** — mana bar fills smoothly over time.
4. **Hotkeys work** — press 2 to select Lair tool, toolbar highlights Lair.
5. **Room placement preview** — with Lair selected, hover over claimed floor shows green tile. Hover over rock/dirt shows red tile.
6. **Room placement** — click 4 claimed floor tiles (green), press Enter. Tiles show Lair floor art (brown patches).
7. **Gold deducted** — placing a 4-tile Lair costs 200g. If insufficient gold, Enter does nothing.
8. **Dig gold vein** — click dirt tiles to dig, find a gold vein. Digging it awards 200 gold (visible in HUD tween).
9. **Dungeon Heart art** — center 3×3 tiles show pulsing red glow.
10. **Tooltip** — hover over tile/room/creature shows info panel.
11. **Speed toggle** — click speed button, game runs at 2× speed.
12. **Treasury cap** — place Treasury room. Gold cap increases beyond 1000.
13. **Imp seeks rooms** — place Hatchery. When Imp gets hungry, it walks toward Hatchery tiles.
14. **Gem seam** — dig a gem seam tile. It yields gold but the tile remains as GEM_SEAM (can be re-queued).
15. **No console errors** — check browser console.

- [ ] **Step 3: Final commit**

```bash
git add -A
git commit -m "feat(phase3): Phase 3 complete — Resources, Rooms & UI"
```
