# Phase 1 — World & Camera Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the tile world, seeded map generation, camera with pan/zoom, procedural tile rendering with viewport culling, minimap, and input management — resulting in a navigable procedurally generated dungeon map.

**Architecture:** World holds pure tile data. MapGenerator populates it. Camera transforms coordinates. TileRenderer reads World state and draws through Camera. InputManager captures DOM events and publishes to EventBus. Minimap renders a scaled-down World view. No system imports another — all communication via EventBus.

**Tech Stack:** Vanilla JS (ES Modules), Canvas 2D, Vitest

---

## File Structure

| File | Action | Purpose |
|------|--------|---------|
| `src/world/World.js` | Replace stub | 2D tile array with getTile/setTile/neighbors/walkable/diggable queries |
| `src/world/MapGenerator.js` | Replace stub | Seeded procedural map generation |
| `src/rendering/Camera.js` | Replace stub | Pan/zoom, world↔screen coordinate conversion, world bounds clamping |
| `src/rendering/TileRenderer.js` | Replace stub | Viewport-culled procedural tile drawing |
| `src/rendering/Minimap.js` | Replace stub | 120×90px map overview, clickable pan |
| `src/input/InputManager.js` | Replace stub | Mouse + keyboard → EventBus, world-space conversion |
| `src/main.js` | Modify | Wire up all Phase 1 systems into update/render loop |
| `tests/world/World.test.js` | Create | Unit tests for World |
| `tests/world/MapGenerator.test.js` | Create | Unit tests for MapGenerator |
| `tests/rendering/Camera.test.js` | Create | Unit tests for Camera coordinate math |

---

### Task 1: World

**Files:**
- Replace: `src/world/World.js`
- Create: `tests/world/World.test.js`

- [ ] **Step 1: Write failing tests**

```js
import { describe, it, expect } from 'vitest';
import { World } from '../../src/world/World.js';
import { TILE_TYPES, MAP_WIDTH, MAP_HEIGHT } from '../../src/constants.js';

describe('World', () => {
  it('creates a grid of correct dimensions', () => {
    const world = new World();
    expect(world.width).toBe(MAP_WIDTH);
    expect(world.height).toBe(MAP_HEIGHT);
  });

  it('initializes all tiles to ROCK', () => {
    const world = new World();
    expect(world.getTile(0, 0)).toBe(TILE_TYPES.ROCK);
    expect(world.getTile(40, 30)).toBe(TILE_TYPES.ROCK);
  });

  it('setTile and getTile round-trip', () => {
    const world = new World();
    world.setTile(5, 5, TILE_TYPES.DIRT);
    expect(world.getTile(5, 5)).toBe(TILE_TYPES.DIRT);
  });

  it('getTile returns null for out-of-bounds', () => {
    const world = new World();
    expect(world.getTile(-1, 0)).toBeNull();
    expect(world.getTile(MAP_WIDTH, 0)).toBeNull();
    expect(world.getTile(0, MAP_HEIGHT)).toBeNull();
  });

  it('getNeighbors returns 4 cardinal neighbors', () => {
    const world = new World();
    const neighbors = world.getNeighbors(5, 5);
    expect(neighbors).toHaveLength(4);
    const coords = neighbors.map(n => `${n.x},${n.y}`);
    expect(coords).toContain('4,5');
    expect(coords).toContain('6,5');
    expect(coords).toContain('5,4');
    expect(coords).toContain('5,6');
  });

  it('getNeighbors excludes out-of-bounds at corner', () => {
    const world = new World();
    const neighbors = world.getNeighbors(0, 0);
    expect(neighbors).toHaveLength(2);
  });

  it('isWalkable returns true for floor tiles', () => {
    const world = new World();
    world.setTile(3, 3, TILE_TYPES.CLAIMED_FLOOR);
    expect(world.isWalkable(3, 3)).toBe(true);
    world.setTile(3, 3, TILE_TYPES.UNCLAIMED_FLOOR);
    expect(world.isWalkable(3, 3)).toBe(true);
  });

  it('isWalkable returns false for solid tiles', () => {
    const world = new World();
    expect(world.isWalkable(3, 3)).toBe(false); // ROCK default
  });

  it('isDiggable returns true for dirt and ore', () => {
    const world = new World();
    world.setTile(3, 3, TILE_TYPES.DIRT);
    expect(world.isDiggable(3, 3)).toBe(true);
    world.setTile(3, 3, TILE_TYPES.GOLD_VEIN);
    expect(world.isDiggable(3, 3)).toBe(true);
  });

  it('isDiggable returns false for rock and floor', () => {
    const world = new World();
    expect(world.isDiggable(3, 3)).toBe(false);
    world.setTile(3, 3, TILE_TYPES.CLAIMED_FLOOR);
    expect(world.isDiggable(3, 3)).toBe(false);
  });

  it('isInBounds checks boundaries correctly', () => {
    const world = new World();
    expect(world.isInBounds(0, 0)).toBe(true);
    expect(world.isInBounds(MAP_WIDTH - 1, MAP_HEIGHT - 1)).toBe(true);
    expect(world.isInBounds(-1, 0)).toBe(false);
    expect(world.isInBounds(MAP_WIDTH, 0)).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/world/World.test.js`

- [ ] **Step 3: Implement World**

```js
import { TILE_TYPES, MAP_WIDTH, MAP_HEIGHT, WALKABLE_TILES, DIGGABLE_TILES } from '../constants.js';

/**
 * 2D tile grid representing the dungeon map.
 * Pure data — no rendering, no DOM refs.
 */
export class World {
  constructor() {
    this.width = MAP_WIDTH;
    this.height = MAP_HEIGHT;
    /** @type {string[]} Flat array, row-major: tiles[y * width + x] */
    this.tiles = new Array(this.width * this.height).fill(TILE_TYPES.ROCK);
  }

  /**
   * Get tile type at position.
   * @param {number} x
   * @param {number} y
   * @returns {string|null} Tile type or null if out of bounds.
   */
  getTile(x, y) {
    if (!this.isInBounds(x, y)) return null;
    return this.tiles[y * this.width + x];
  }

  /**
   * Set tile type at position.
   * @param {number} x
   * @param {number} y
   * @param {string} type - TILE_TYPES value.
   */
  setTile(x, y, type) {
    if (!this.isInBounds(x, y)) return;
    this.tiles[y * this.width + x] = type;
  }

  /**
   * Get cardinal neighbors (up to 4).
   * @param {number} x
   * @param {number} y
   * @returns {{x: number, y: number, type: string}[]}
   */
  getNeighbors(x, y) {
    const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];
    const result = [];
    for (const [dx, dy] of dirs) {
      const nx = x + dx;
      const ny = y + dy;
      if (this.isInBounds(nx, ny)) {
        result.push({ x: nx, y: ny, type: this.getTile(nx, ny) });
      }
    }
    return result;
  }

  /**
   * @param {number} x
   * @param {number} y
   * @returns {boolean}
   */
  isWalkable(x, y) {
    const tile = this.getTile(x, y);
    return tile !== null && WALKABLE_TILES.includes(tile);
  }

  /**
   * @param {number} x
   * @param {number} y
   * @returns {boolean}
   */
  isDiggable(x, y) {
    const tile = this.getTile(x, y);
    return tile !== null && DIGGABLE_TILES.includes(tile);
  }

  /**
   * @param {number} x
   * @param {number} y
   * @returns {boolean}
   */
  isInBounds(x, y) {
    return x >= 0 && x < this.width && y >= 0 && y < this.height;
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/world/World.test.js`
Expected: All 11 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/world/World.js tests/world/World.test.js
git commit -m "feat: implement World tile grid with queries"
```

---

### Task 2: MapGenerator

**Files:**
- Replace: `src/world/MapGenerator.js`
- Create: `tests/world/MapGenerator.test.js`

- [ ] **Step 1: Write failing tests**

```js
import { describe, it, expect } from 'vitest';
import { MapGenerator } from '../../src/world/MapGenerator.js';
import { World } from '../../src/world/World.js';
import { TILE_TYPES, MAP_WIDTH, MAP_HEIGHT, MAP_GEN } from '../../src/constants.js';

describe('MapGenerator', () => {
  it('fills border with ROCK', () => {
    const world = new World();
    MapGenerator.generate(world, 12345);
    // Top and bottom rows
    for (let x = 0; x < MAP_WIDTH; x++) {
      expect(world.getTile(x, 0)).toBe(TILE_TYPES.ROCK);
      expect(world.getTile(x, MAP_HEIGHT - 1)).toBe(TILE_TYPES.ROCK);
    }
    // Left and right columns
    for (let y = 0; y < MAP_HEIGHT; y++) {
      expect(world.getTile(0, y)).toBe(TILE_TYPES.ROCK);
      expect(world.getTile(MAP_WIDTH - 1, y)).toBe(TILE_TYPES.ROCK);
    }
  });

  it('fills interior with DIRT', () => {
    const world = new World();
    MapGenerator.generate(world, 12345);
    let dirtCount = 0;
    for (let y = 1; y < MAP_HEIGHT - 1; y++) {
      for (let x = 1; x < MAP_WIDTH - 1; x++) {
        if (world.getTile(x, y) === TILE_TYPES.DIRT) dirtCount++;
      }
    }
    // Most interior tiles should be dirt
    expect(dirtCount).toBeGreaterThan((MAP_WIDTH - 2) * (MAP_HEIGHT - 2) * 0.7);
  });

  it('places dungeon heart at center as claimed floor', () => {
    const world = new World();
    MapGenerator.generate(world, 12345);
    const cx = Math.floor(MAP_WIDTH / 2);
    const cy = Math.floor(MAP_HEIGHT / 2);
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        expect(world.getTile(cx + dx, cy + dy)).toBe(TILE_TYPES.CLAIMED_FLOOR);
      }
    }
  });

  it('places gold veins within range', () => {
    const world = new World();
    MapGenerator.generate(world, 12345);
    let goldCount = 0;
    for (let y = 0; y < MAP_HEIGHT; y++) {
      for (let x = 0; x < MAP_WIDTH; x++) {
        if (world.getTile(x, y) === TILE_TYPES.GOLD_VEIN) goldCount++;
      }
    }
    expect(goldCount).toBeGreaterThanOrEqual(MAP_GEN.GOLD_VEIN_MIN);
    expect(goldCount).toBeLessThanOrEqual(MAP_GEN.GOLD_VEIN_MAX * 4); // clusters
  });

  it('places gem seams', () => {
    const world = new World();
    MapGenerator.generate(world, 12345);
    let gemCount = 0;
    for (let y = 0; y < MAP_HEIGHT; y++) {
      for (let x = 0; x < MAP_WIDTH; x++) {
        if (world.getTile(x, y) === TILE_TYPES.GEM_SEAM) gemCount++;
      }
    }
    expect(gemCount).toBeGreaterThanOrEqual(MAP_GEN.GEM_SEAM_MIN);
  });

  it('places lava pools', () => {
    const world = new World();
    MapGenerator.generate(world, 12345);
    let lavaCount = 0;
    for (let y = 0; y < MAP_HEIGHT; y++) {
      for (let x = 0; x < MAP_WIDTH; x++) {
        if (world.getTile(x, y) === TILE_TYPES.LAVA) lavaCount++;
      }
    }
    expect(lavaCount).toBeGreaterThanOrEqual(1);
  });

  it('places water channels', () => {
    const world = new World();
    MapGenerator.generate(world, 12345);
    let waterCount = 0;
    for (let y = 0; y < MAP_HEIGHT; y++) {
      for (let x = 0; x < MAP_WIDTH; x++) {
        if (world.getTile(x, y) === TILE_TYPES.WATER) waterCount++;
      }
    }
    expect(waterCount).toBeGreaterThanOrEqual(1);
  });

  it('same seed produces same map', () => {
    const w1 = new World();
    const w2 = new World();
    MapGenerator.generate(w1, 42);
    MapGenerator.generate(w2, 42);
    for (let i = 0; i < w1.tiles.length; i++) {
      expect(w1.tiles[i]).toBe(w2.tiles[i]);
    }
  });

  it('different seed produces different map', () => {
    const w1 = new World();
    const w2 = new World();
    MapGenerator.generate(w1, 100);
    MapGenerator.generate(w2, 200);
    let differences = 0;
    for (let i = 0; i < w1.tiles.length; i++) {
      if (w1.tiles[i] !== w2.tiles[i]) differences++;
    }
    expect(differences).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/world/MapGenerator.test.js`

- [ ] **Step 3: Implement MapGenerator**

```js
import { TILE_TYPES, MAP_WIDTH, MAP_HEIGHT, MAP_GEN } from '../constants.js';

/**
 * Seeded procedural map generator.
 * Same seed always produces the same map.
 */
export class MapGenerator {
  /**
   * Generate a complete dungeon map.
   * @param {import('./World.js').World} world
   * @param {number} seed
   */
  static generate(world, seed) {
    const rng = MapGenerator._createRng(seed);

    // Step 1: Fill everything with rock (already default)
    for (let y = 0; y < MAP_HEIGHT; y++) {
      for (let x = 0; x < MAP_WIDTH; x++) {
        world.setTile(x, y, TILE_TYPES.ROCK);
      }
    }

    // Step 2: Fill interior with dirt
    for (let y = 1; y < MAP_HEIGHT - 1; y++) {
      for (let x = 1; x < MAP_WIDTH - 1; x++) {
        world.setTile(x, y, TILE_TYPES.DIRT);
      }
    }

    // Step 3: Carve dungeon heart at center (3x3 claimed floor)
    const cx = Math.floor(MAP_WIDTH / 2);
    const cy = Math.floor(MAP_HEIGHT / 2);
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        world.setTile(cx + dx, cy + dy, TILE_TYPES.CLAIMED_FLOOR);
      }
    }

    // Step 4: Place gold vein clusters
    const goldCount = MapGenerator._randInt(rng, MAP_GEN.GOLD_VEIN_MIN, MAP_GEN.GOLD_VEIN_MAX);
    for (let i = 0; i < goldCount; i++) {
      MapGenerator._placeCluster(world, rng, TILE_TYPES.GOLD_VEIN, 1, 3);
    }

    // Step 5: Place gem seams
    const gemCount = MapGenerator._randInt(rng, MAP_GEN.GEM_SEAM_MIN, MAP_GEN.GEM_SEAM_MAX);
    for (let i = 0; i < gemCount; i++) {
      MapGenerator._placeCluster(world, rng, TILE_TYPES.GEM_SEAM, 1, 2);
    }

    // Step 6: Place lava pools
    const lavaCount = MapGenerator._randInt(rng, MAP_GEN.LAVA_POOL_MIN, MAP_GEN.LAVA_POOL_MAX);
    for (let i = 0; i < lavaCount; i++) {
      MapGenerator._placeCluster(world, rng, TILE_TYPES.LAVA, 3, 6);
    }

    // Step 7: Place water channels
    const waterCount = MapGenerator._randInt(rng, MAP_GEN.WATER_CHANNEL_MIN, MAP_GEN.WATER_CHANNEL_MAX);
    for (let i = 0; i < waterCount; i++) {
      MapGenerator._placeChannel(world, rng, TILE_TYPES.WATER, 5, 12);
    }
  }

  /**
   * Place a cluster of tiles at a random interior position.
   * @param {import('./World.js').World} world
   * @param {Function} rng
   * @param {string} tileType
   * @param {number} minSize
   * @param {number} maxSize
   */
  static _placeCluster(world, rng, tileType, minSize, maxSize) {
    const x = MapGenerator._randInt(rng, 3, MAP_WIDTH - 4);
    const y = MapGenerator._randInt(rng, 3, MAP_HEIGHT - 4);
    const size = MapGenerator._randInt(rng, minSize, maxSize);

    // Don't overwrite dungeon heart
    const cx = Math.floor(MAP_WIDTH / 2);
    const cy = Math.floor(MAP_HEIGHT / 2);

    world.setTile(x, y, tileType);
    for (let i = 1; i < size; i++) {
      const dx = MapGenerator._randInt(rng, -1, 1);
      const dy = MapGenerator._randInt(rng, -1, 1);
      const nx = x + dx + MapGenerator._randInt(rng, -1, 1);
      const ny = y + dy + MapGenerator._randInt(rng, -1, 1);
      if (nx > 1 && nx < MAP_WIDTH - 2 && ny > 1 && ny < MAP_HEIGHT - 2) {
        if (Math.abs(nx - cx) > 2 || Math.abs(ny - cy) > 2) {
          world.setTile(nx, ny, tileType);
        }
      }
    }
  }

  /**
   * Place a winding channel of tiles.
   * @param {import('./World.js').World} world
   * @param {Function} rng
   * @param {string} tileType
   * @param {number} minLen
   * @param {number} maxLen
   */
  static _placeChannel(world, rng, tileType, minLen, maxLen) {
    let x = MapGenerator._randInt(rng, 5, MAP_WIDTH - 6);
    let y = MapGenerator._randInt(rng, 5, MAP_HEIGHT - 6);
    const len = MapGenerator._randInt(rng, minLen, maxLen);
    const cx = Math.floor(MAP_WIDTH / 2);
    const cy = Math.floor(MAP_HEIGHT / 2);

    for (let i = 0; i < len; i++) {
      if (x > 1 && x < MAP_WIDTH - 2 && y > 1 && y < MAP_HEIGHT - 2) {
        if (Math.abs(x - cx) > 2 || Math.abs(y - cy) > 2) {
          world.setTile(x, y, tileType);
        }
      }
      // Random walk
      const dir = MapGenerator._randInt(rng, 0, 3);
      if (dir === 0) x++;
      else if (dir === 1) x--;
      else if (dir === 2) y++;
      else y--;
    }
  }

  /**
   * Simple seeded PRNG (mulberry32).
   * @param {number} seed
   * @returns {Function} Returns 0-1 float each call.
   */
  static _createRng(seed) {
    let s = seed | 0;
    return () => {
      s |= 0;
      s = s + 0x6D2B79F5 | 0;
      let t = Math.imul(s ^ s >>> 15, 1 | s);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  /**
   * Random integer in [min, max] inclusive.
   * @param {Function} rng
   * @param {number} min
   * @param {number} max
   * @returns {number}
   */
  static _randInt(rng, min, max) {
    return Math.floor(rng() * (max - min + 1)) + min;
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/world/MapGenerator.test.js`
Expected: All 9 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/world/MapGenerator.js tests/world/MapGenerator.test.js
git commit -m "feat: implement seeded procedural MapGenerator"
```

---

### Task 3: Camera

**Files:**
- Replace: `src/rendering/Camera.js`
- Create: `tests/rendering/Camera.test.js`

- [ ] **Step 1: Write failing tests**

```js
import { describe, it, expect } from 'vitest';
import { Camera } from '../../src/rendering/Camera.js';
import { MAP_WIDTH, MAP_HEIGHT, TILE_SIZE, CAMERA } from '../../src/constants.js';

describe('Camera', () => {
  it('initializes at world center', () => {
    const cam = new Camera(800, 600);
    expect(cam.x).toBeCloseTo(MAP_WIDTH * TILE_SIZE / 2);
    expect(cam.y).toBeCloseTo(MAP_HEIGHT * TILE_SIZE / 2);
  });

  it('worldToScreen and screenToWorld are inverses', () => {
    const cam = new Camera(800, 600);
    const wx = 500, wy = 300;
    const [sx, sy] = cam.worldToScreen(wx, wy);
    const [rx, ry] = cam.screenToWorld(sx, sy);
    expect(rx).toBeCloseTo(wx, 1);
    expect(ry).toBeCloseTo(wy, 1);
  });

  it('zoom changes scale', () => {
    const cam = new Camera(800, 600);
    const initialZoom = cam.zoom;
    cam.zoomBy(CAMERA.ZOOM_STEP);
    expect(cam.zoom).toBeGreaterThan(initialZoom);
  });

  it('zoom clamps to min/max', () => {
    const cam = new Camera(800, 600);
    cam.zoom = CAMERA.ZOOM_MIN;
    cam.zoomBy(-1);
    expect(cam.zoom).toBe(CAMERA.ZOOM_MIN);
    cam.zoom = CAMERA.ZOOM_MAX;
    cam.zoomBy(1);
    expect(cam.zoom).toBe(CAMERA.ZOOM_MAX);
  });

  it('pan moves camera position', () => {
    const cam = new Camera(800, 600);
    const startX = cam.x;
    cam.pan(100, 0);
    expect(cam.x).toBeGreaterThan(startX);
  });

  it('clamps to world bounds', () => {
    const cam = new Camera(800, 600);
    cam.pan(-100000, -100000);
    cam.clampToWorld();
    expect(cam.x).toBeGreaterThanOrEqual(0);
    expect(cam.y).toBeGreaterThanOrEqual(0);
  });

  it('getViewportTileBounds returns tile range', () => {
    const cam = new Camera(800, 600);
    const bounds = cam.getViewportTileBounds();
    expect(bounds.startX).toBeGreaterThanOrEqual(0);
    expect(bounds.startY).toBeGreaterThanOrEqual(0);
    expect(bounds.endX).toBeLessThanOrEqual(MAP_WIDTH);
    expect(bounds.endY).toBeLessThanOrEqual(MAP_HEIGHT);
    expect(bounds.endX).toBeGreaterThan(bounds.startX);
    expect(bounds.endY).toBeGreaterThan(bounds.startY);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/rendering/Camera.test.js`

- [ ] **Step 3: Implement Camera**

```js
import { MAP_WIDTH, MAP_HEIGHT, TILE_SIZE, CAMERA } from '../constants.js';

/**
 * Camera for panning and zooming the game view.
 * Position is in world-space pixels. Provides world↔screen conversion.
 */
export class Camera {
  /**
   * @param {number} viewportWidth - Screen width in CSS pixels.
   * @param {number} viewportHeight - Screen height in CSS pixels.
   */
  constructor(viewportWidth, viewportHeight) {
    this.viewportWidth = viewportWidth;
    this.viewportHeight = viewportHeight;
    this.zoom = 1.0;
    // Start centered on the map
    this.x = (MAP_WIDTH * TILE_SIZE) / 2;
    this.y = (MAP_HEIGHT * TILE_SIZE) / 2;
  }

  /**
   * Convert world coordinates to screen coordinates.
   * @param {number} wx - World X in pixels.
   * @param {number} wy - World Y in pixels.
   * @returns {[number, number]} Screen [x, y].
   */
  worldToScreen(wx, wy) {
    const sx = (wx - this.x) * this.zoom + this.viewportWidth / 2;
    const sy = (wy - this.y) * this.zoom + this.viewportHeight / 2;
    return [sx, sy];
  }

  /**
   * Convert screen coordinates to world coordinates.
   * @param {number} sx - Screen X.
   * @param {number} sy - Screen Y.
   * @returns {[number, number]} World [x, y] in pixels.
   */
  screenToWorld(sx, sy) {
    const wx = (sx - this.viewportWidth / 2) / this.zoom + this.x;
    const wy = (sy - this.viewportHeight / 2) / this.zoom + this.y;
    return [wx, wy];
  }

  /**
   * Pan the camera by delta in world pixels.
   * @param {number} dx
   * @param {number} dy
   */
  pan(dx, dy) {
    this.x += dx;
    this.y += dy;
  }

  /**
   * Zoom by delta, clamped to min/max.
   * @param {number} delta - Positive to zoom in, negative to zoom out.
   */
  zoomBy(delta) {
    this.zoom = Math.max(CAMERA.ZOOM_MIN, Math.min(CAMERA.ZOOM_MAX, this.zoom + delta));
  }

  /** Clamp camera position so viewport stays within world bounds. */
  clampToWorld() {
    const worldW = MAP_WIDTH * TILE_SIZE;
    const worldH = MAP_HEIGHT * TILE_SIZE;
    const halfVW = this.viewportWidth / (2 * this.zoom);
    const halfVH = this.viewportHeight / (2 * this.zoom);

    this.x = Math.max(halfVW, Math.min(worldW - halfVW, this.x));
    this.y = Math.max(halfVH, Math.min(worldH - halfVH, this.y));
  }

  /**
   * Get the tile coordinate range visible in the viewport.
   * @returns {{startX: number, startY: number, endX: number, endY: number}}
   */
  getViewportTileBounds() {
    const [topLeftWx, topLeftWy] = this.screenToWorld(0, 0);
    const [botRightWx, botRightWy] = this.screenToWorld(this.viewportWidth, this.viewportHeight);

    return {
      startX: Math.max(0, Math.floor(topLeftWx / TILE_SIZE) - 1),
      startY: Math.max(0, Math.floor(topLeftWy / TILE_SIZE) - 1),
      endX: Math.min(MAP_WIDTH, Math.ceil(botRightWx / TILE_SIZE) + 1),
      endY: Math.min(MAP_HEIGHT, Math.ceil(botRightWy / TILE_SIZE) + 1),
    };
  }

  /**
   * Update viewport dimensions (call on window resize).
   * @param {number} w
   * @param {number} h
   */
  resize(w, h) {
    this.viewportWidth = w;
    this.viewportHeight = h;
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/rendering/Camera.test.js`
Expected: All 7 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/rendering/Camera.js tests/rendering/Camera.test.js
git commit -m "feat: implement Camera with pan/zoom and coordinate conversion"
```

---

### Task 4: InputManager

**Files:**
- Replace: `src/input/InputManager.js`

- [ ] **Step 1: Implement InputManager**

```js
import { EVENTS, CAMERA } from '../constants.js';

/**
 * Captures all mouse and keyboard input, converts to world-space
 * coordinates, and publishes events on the EventBus.
 * Nothing else should read raw DOM events directly.
 */
export class InputManager {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {import('../rendering/Camera.js').Camera} camera
   * @param {import('../core/EventBus.js').EventBus} eventBus
   */
  constructor(canvas, camera, eventBus) {
    this._canvas = canvas;
    this._camera = camera;
    this._eventBus = eventBus;
    this._keysDown = new Set();
    this._middleMouseDown = false;
    this._lastMouseX = 0;
    this._lastMouseY = 0;

    this._bindEvents();
  }

  /** @private */
  _bindEvents() {
    this._canvas.addEventListener('click', (e) => {
      const [wx, wy] = this._camera.screenToWorld(e.clientX, e.clientY);
      this._eventBus.publish(EVENTS.INPUT_CLICK, {
        screenX: e.clientX, screenY: e.clientY,
        worldX: wx, worldY: wy,
        tileX: Math.floor(wx / 32), tileY: Math.floor(wy / 32),
      });
    });

    this._canvas.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      const [wx, wy] = this._camera.screenToWorld(e.clientX, e.clientY);
      this._eventBus.publish(EVENTS.INPUT_RIGHT_CLICK, {
        screenX: e.clientX, screenY: e.clientY,
        worldX: wx, worldY: wy,
        tileX: Math.floor(wx / 32), tileY: Math.floor(wy / 32),
      });
    });

    this._canvas.addEventListener('mousemove', (e) => {
      // Middle-mouse drag for camera pan
      if (this._middleMouseDown) {
        const dx = (this._lastMouseX - e.clientX) / this._camera.zoom;
        const dy = (this._lastMouseY - e.clientY) / this._camera.zoom;
        this._camera.pan(dx, dy);
        this._camera.clampToWorld();
      }
      this._lastMouseX = e.clientX;
      this._lastMouseY = e.clientY;

      const [wx, wy] = this._camera.screenToWorld(e.clientX, e.clientY);
      this._eventBus.publish(EVENTS.INPUT_MOUSE_MOVE, {
        screenX: e.clientX, screenY: e.clientY,
        worldX: wx, worldY: wy,
        tileX: Math.floor(wx / 32), tileY: Math.floor(wy / 32),
      });
    });

    this._canvas.addEventListener('mousedown', (e) => {
      if (e.button === 1) {
        this._middleMouseDown = true;
        this._lastMouseX = e.clientX;
        this._lastMouseY = e.clientY;
        e.preventDefault();
      }
    });

    window.addEventListener('mouseup', (e) => {
      if (e.button === 1) {
        this._middleMouseDown = false;
      }
    });

    this._canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      const delta = e.deltaY < 0 ? CAMERA.ZOOM_STEP : -CAMERA.ZOOM_STEP;
      this._camera.zoomBy(delta);
      this._camera.clampToWorld();
      this._eventBus.publish(EVENTS.INPUT_SCROLL, { delta });
    }, { passive: false });

    window.addEventListener('keydown', (e) => {
      if (this._keysDown.has(e.code)) return; // ignore repeat
      this._keysDown.add(e.code);
      this._eventBus.publish(EVENTS.INPUT_KEY_DOWN, { code: e.code, key: e.key });
    });

    window.addEventListener('keyup', (e) => {
      this._keysDown.delete(e.code);
      this._eventBus.publish(EVENTS.INPUT_KEY_UP, { code: e.code, key: e.key });
    });
  }

  /**
   * Called each update tick to handle continuous key-based panning.
   * @param {number} dt - Delta time in seconds.
   */
  update(dt) {
    const panSpeed = CAMERA.PAN_SPEED * dt / this._camera.zoom;
    let dx = 0, dy = 0;
    if (this._keysDown.has('KeyW') || this._keysDown.has('ArrowUp')) dy -= panSpeed;
    if (this._keysDown.has('KeyS') || this._keysDown.has('ArrowDown')) dy += panSpeed;
    if (this._keysDown.has('KeyA') || this._keysDown.has('ArrowLeft')) dx -= panSpeed;
    if (this._keysDown.has('KeyD') || this._keysDown.has('ArrowRight')) dx += panSpeed;
    if (dx !== 0 || dy !== 0) {
      this._camera.pan(dx, dy);
      this._camera.clampToWorld();
    }
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/input/InputManager.js
git commit -m "feat: implement InputManager with keyboard/mouse to EventBus"
```

---

### Task 5: TileRenderer

**Files:**
- Replace: `src/rendering/TileRenderer.js`

- [ ] **Step 1: Implement TileRenderer**

```js
import { TILE_TYPES, TILE_SIZE, COLORS } from '../constants.js';

/**
 * Draws only the tiles visible in the camera viewport.
 * Each tile type has a distinct procedural appearance.
 * Reads World state — never mutates it.
 */
export class TileRenderer {
  /**
   * @param {CanvasRenderingContext2D} ctx
   * @param {import('../world/World.js').World} world
   * @param {import('./Camera.js').Camera} camera
   */
  constructor(ctx, world, camera) {
    this._ctx = ctx;
    this._world = world;
    this._camera = camera;
    // Pre-generate noise seeds for tile variation
    this._noiseSeed = new Uint8Array(world.width * world.height);
    for (let i = 0; i < this._noiseSeed.length; i++) {
      this._noiseSeed[i] = (i * 7919 + 104729) % 256;
    }
  }

  /**
   * Render all visible tiles.
   * @param {number} _alpha - Interpolation alpha (unused for tiles, they don't move).
   */
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

        this._drawTile(ctx, type, sx, sy, size, noise, x, y);
      }
    }
  }

  /**
   * Draw a single tile procedurally.
   * @private
   */
  _drawTile(ctx, type, sx, sy, size, noise, tx, ty) {
    switch (type) {
      case TILE_TYPES.ROCK:
        this._drawRock(ctx, sx, sy, size, noise);
        break;
      case TILE_TYPES.DIRT:
        this._drawDirt(ctx, sx, sy, size, noise);
        break;
      case TILE_TYPES.UNCLAIMED_FLOOR:
        this._drawFloor(ctx, sx, sy, size, noise, '#4a4a4e');
        break;
      case TILE_TYPES.CLAIMED_FLOOR:
        this._drawFloor(ctx, sx, sy, size, noise, '#5a5a60');
        break;
      case TILE_TYPES.GOLD_VEIN:
        this._drawGoldVein(ctx, sx, sy, size, noise);
        break;
      case TILE_TYPES.GEM_SEAM:
        this._drawGemSeam(ctx, sx, sy, size, noise);
        break;
      case TILE_TYPES.LAVA:
        this._drawLava(ctx, sx, sy, size, noise);
        break;
      case TILE_TYPES.WATER:
        this._drawWater(ctx, sx, sy, size, noise);
        break;
    }
  }

  /** @private */
  _drawRock(ctx, x, y, size, noise) {
    // Dark stone base
    const shade = 30 + (noise % 15);
    ctx.fillStyle = `rgb(${shade}, ${shade}, ${shade + 4})`;
    ctx.fillRect(x, y, size, size);
    // Subtle cracks
    ctx.strokeStyle = `rgba(0, 0, 0, 0.3)`;
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(x + (noise % 10) * size / 32, y + size * 0.3);
    ctx.lineTo(x + size * 0.6, y + size * 0.7 + (noise % 5));
    ctx.stroke();
  }

  /** @private */
  _drawDirt(ctx, x, y, size, noise) {
    // Brown base
    const r = 80 + (noise % 20);
    const g = 60 + (noise % 15);
    const b = 40 + (noise % 10);
    ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
    ctx.fillRect(x, y, size, size);
    // Speckled texture
    ctx.fillStyle = `rgba(100, 80, 50, 0.4)`;
    for (let i = 0; i < 3; i++) {
      const px = x + ((noise * (i + 1) * 13) % 28) * size / 32;
      const py = y + ((noise * (i + 1) * 7) % 28) * size / 32;
      ctx.fillRect(px, py, size / 16, size / 16);
    }
    // Lighter edge on top-left
    ctx.fillStyle = `rgba(140, 110, 70, 0.15)`;
    ctx.fillRect(x, y, size, size / 8);
  }

  /** @private */
  _drawFloor(ctx, x, y, size, noise, baseColor) {
    ctx.fillStyle = baseColor;
    ctx.fillRect(x, y, size, size);
    // Subtle grid lines
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.15)';
    ctx.lineWidth = 0.5;
    ctx.strokeRect(x + 0.5, y + 0.5, size - 1, size - 1);
    // Slight variation
    if (noise % 4 === 0) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.03)';
      ctx.fillRect(x + 2, y + 2, size - 4, size - 4);
    }
  }

  /** @private */
  _drawGoldVein(ctx, x, y, size, noise) {
    // Rock base
    this._drawRock(ctx, x, y, size, noise);
    // Gold flecks
    ctx.fillStyle = COLORS.GOLD_VEIN;
    for (let i = 0; i < 5; i++) {
      const fx = x + ((noise * (i + 3) * 11) % 26) * size / 32;
      const fy = y + ((noise * (i + 2) * 17) % 26) * size / 32;
      const fs = size / 10 + (i % 2) * size / 16;
      ctx.fillRect(fx, fy, fs, fs);
    }
    // Glitter highlight
    ctx.fillStyle = 'rgba(255, 220, 80, 0.5)';
    ctx.beginPath();
    ctx.arc(x + size * 0.5, y + size * 0.4, size / 8, 0, Math.PI * 2);
    ctx.fill();
  }

  /** @private */
  _drawGemSeam(ctx, x, y, size, noise) {
    // Rock base
    this._drawRock(ctx, x, y, size, noise);
    // Crystal facets
    const colors = ['#8a4ec0', '#6a3ea0', '#aa60e0', '#5040b0'];
    for (let i = 0; i < 4; i++) {
      ctx.fillStyle = colors[i % colors.length];
      const cx = x + ((noise * (i + 1) * 7) % 22 + 5) * size / 32;
      const cy = y + ((noise * (i + 2) * 11) % 22 + 5) * size / 32;
      // Diamond shape
      ctx.beginPath();
      const s = size / 12 + (i % 2) * 2;
      ctx.moveTo(cx, cy - s);
      ctx.lineTo(cx + s, cy);
      ctx.lineTo(cx, cy + s);
      ctx.lineTo(cx - s, cy);
      ctx.closePath();
      ctx.fill();
    }
  }

  /** @private */
  _drawLava(ctx, x, y, size, noise) {
    const t = performance.now() / 1000;
    const pulse = Math.sin(t * 2 + noise * 0.1) * 0.15 + 0.85;
    const r = Math.floor(180 * pulse + (noise % 20));
    const g = Math.floor(60 * pulse + (noise % 15));
    ctx.fillStyle = `rgb(${r}, ${g}, 20)`;
    ctx.fillRect(x, y, size, size);
    // Shimmer
    ctx.fillStyle = `rgba(255, 150, 0, ${0.2 + Math.sin(t * 3 + noise) * 0.1})`;
    ctx.fillRect(x + size * 0.2, y + size * 0.2, size * 0.6, size * 0.3);
  }

  /** @private */
  _drawWater(ctx, x, y, size, noise) {
    const t = performance.now() / 1000;
    const wave = Math.sin(t * 1.5 + noise * 0.15) * 0.1 + 0.9;
    ctx.fillStyle = `rgb(30, ${Math.floor(60 * wave)}, ${Math.floor(150 * wave)})`;
    ctx.fillRect(x, y, size, size);
    // Ripple highlights
    ctx.strokeStyle = `rgba(100, 160, 255, ${0.15 + Math.sin(t * 2 + noise * 0.2) * 0.1})`;
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(x + size * 0.1, y + size * (0.4 + Math.sin(t + noise) * 0.05));
    ctx.lineTo(x + size * 0.9, y + size * (0.4 + Math.sin(t + noise + 1) * 0.05));
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x + size * 0.2, y + size * (0.7 + Math.sin(t * 0.8 + noise) * 0.05));
    ctx.lineTo(x + size * 0.8, y + size * (0.7 + Math.sin(t * 0.8 + noise + 1) * 0.05));
    ctx.stroke();
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/rendering/TileRenderer.js
git commit -m "feat: implement TileRenderer with procedural tile art and viewport culling"
```

---

### Task 6: Minimap

**Files:**
- Replace: `src/rendering/Minimap.js`

- [ ] **Step 1: Implement Minimap**

```js
import { TILE_TYPES, MAP_WIDTH, MAP_HEIGHT, TILE_SIZE, MINIMAP_WIDTH, MINIMAP_HEIGHT, COLORS } from '../constants.js';

/**
 * 120×90px minimap overlay in the top-right corner.
 * Shows full map with color-coded tiles. Camera viewport rectangle drawn.
 * Clickable to pan camera.
 */
export class Minimap {
  /**
   * @param {CanvasRenderingContext2D} ctx
   * @param {import('../world/World.js').World} world
   * @param {import('./Camera.js').Camera} camera
   * @param {import('../core/EventBus.js').EventBus} eventBus
   */
  constructor(ctx, world, camera, eventBus) {
    this._ctx = ctx;
    this._world = world;
    this._camera = camera;
    this._eventBus = eventBus;
    this._scaleX = MINIMAP_WIDTH / MAP_WIDTH;
    this._scaleY = MINIMAP_HEIGHT / MAP_HEIGHT;

    // Minimap position (top-right with padding)
    this._offsetX = 0; // Set dynamically in render
    this._offsetY = 8;
    this._padding = 8;
  }

  /** @private */
  _getTileColor(type) {
    switch (type) {
      case TILE_TYPES.ROCK: return COLORS.ROCK;
      case TILE_TYPES.DIRT: return COLORS.DIRT;
      case TILE_TYPES.UNCLAIMED_FLOOR: return COLORS.UNCLAIMED_FLOOR;
      case TILE_TYPES.CLAIMED_FLOOR: return COLORS.CLAIMED_FLOOR;
      case TILE_TYPES.GOLD_VEIN: return COLORS.GOLD_VEIN;
      case TILE_TYPES.GEM_SEAM: return COLORS.GEM_SEAM;
      case TILE_TYPES.LAVA: return COLORS.LAVA;
      case TILE_TYPES.WATER: return COLORS.WATER;
      default: return '#000000';
    }
  }

  /**
   * Render the minimap overlay.
   */
  render() {
    const ctx = this._ctx;
    const viewW = this._camera.viewportWidth;
    this._offsetX = viewW - MINIMAP_WIDTH - this._padding;

    // Background
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(this._offsetX - 2, this._offsetY - 2, MINIMAP_WIDTH + 4, MINIMAP_HEIGHT + 4);

    // Draw tiles
    for (let y = 0; y < MAP_HEIGHT; y++) {
      for (let x = 0; x < MAP_WIDTH; x++) {
        const type = this._world.getTile(x, y);
        ctx.fillStyle = this._getTileColor(type);
        ctx.fillRect(
          this._offsetX + x * this._scaleX,
          this._offsetY + y * this._scaleY,
          Math.ceil(this._scaleX),
          Math.ceil(this._scaleY)
        );
      }
    }

    // Draw camera viewport rectangle
    const bounds = this._camera.getViewportTileBounds();
    ctx.strokeStyle = COLORS.MINIMAP_CAMERA;
    ctx.lineWidth = 1;
    ctx.strokeRect(
      this._offsetX + bounds.startX * this._scaleX,
      this._offsetY + bounds.startY * this._scaleY,
      (bounds.endX - bounds.startX) * this._scaleX,
      (bounds.endY - bounds.startY) * this._scaleY
    );

    // Border
    ctx.strokeStyle = 'rgba(150, 130, 100, 0.5)';
    ctx.lineWidth = 1;
    ctx.strokeRect(this._offsetX - 2, this._offsetY - 2, MINIMAP_WIDTH + 4, MINIMAP_HEIGHT + 4);
  }

  /**
   * Handle click on minimap to pan camera.
   * @param {number} screenX
   * @param {number} screenY
   * @returns {boolean} True if click was on minimap.
   */
  handleClick(screenX, screenY) {
    const viewW = this._camera.viewportWidth;
    const ox = viewW - MINIMAP_WIDTH - this._padding;
    const oy = this._offsetY;

    if (screenX >= ox && screenX <= ox + MINIMAP_WIDTH &&
        screenY >= oy && screenY <= oy + MINIMAP_HEIGHT) {
      // Convert minimap click to world position
      const tileX = (screenX - ox) / this._scaleX;
      const tileY = (screenY - oy) / this._scaleY;
      this._camera.x = tileX * TILE_SIZE;
      this._camera.y = tileY * TILE_SIZE;
      this._camera.clampToWorld();
      return true;
    }
    return false;
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/rendering/Minimap.js
git commit -m "feat: implement Minimap with clickable camera pan"
```

---

### Task 7: Wire Up main.js

**Files:**
- Modify: `src/main.js`

- [ ] **Step 1: Update main.js to integrate all Phase 1 systems**

Replace the entire contents of `src/main.js` with:

```js
import { EventBus } from './core/EventBus.js';
import { GameLoop } from './core/GameLoop.js';
import { World } from './world/World.js';
import { MapGenerator } from './world/MapGenerator.js';
import { Camera } from './rendering/Camera.js';
import { TileRenderer } from './rendering/TileRenderer.js';
import { Minimap } from './rendering/Minimap.js';
import { InputManager } from './input/InputManager.js';
import { COLORS, EVENTS } from './constants.js';

// ── Canvas setup ─────────────────────────────────────
/** @type {HTMLCanvasElement} */
const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
const fpsEl = document.getElementById('fps-counter');

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

// Generate map with random seed
const seed = Math.floor(Math.random() * 1000000);
MapGenerator.generate(world, seed);

const camera = new Camera(window.innerWidth, window.innerHeight);
const tileRenderer = new TileRenderer(ctx, world, camera);
const minimap = new Minimap(ctx, world, camera, eventBus);
const inputManager = new InputManager(canvas, camera, eventBus);

// Handle minimap clicks
eventBus.subscribe(EVENTS.INPUT_CLICK, (e) => {
  minimap.handleClick(e.screenX, e.screenY);
});

window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// ── Game loop ────────────────────────────────────────
function update(dt) {
  inputManager.update(dt);
}

function render(alpha) {
  const w = window.innerWidth;
  const h = window.innerHeight;
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = COLORS.BG;
  ctx.fillRect(0, 0, w, h);

  tileRenderer.render(alpha);
  minimap.render();

  fpsEl.textContent = `FPS: ${gameLoop.fps}`;
}

const gameLoop = new GameLoop(update, render);
gameLoop.start();
```

- [ ] **Step 2: Verify in browser**

Run `npm run dev` and open http://localhost:5173.
Expected:
- Procedurally generated dungeon map visible with distinct tile types
- WASD pans the camera smoothly
- Middle-mouse drag pans the camera
- Scroll wheel zooms in/out
- Minimap in top-right shows full map with camera viewport rectangle
- Clicking minimap pans to that location
- FPS counter shows ~60
- Lava tiles shimmer, water tiles ripple
- No console errors

- [ ] **Step 3: Commit**

```bash
git add src/main.js
git commit -m "feat: wire up World, Camera, TileRenderer, Minimap, InputManager"
```

---

### Task 8: Run Full Phase 1 Verification

- [ ] **Step 1: Run all tests**

Run: `npm test`
Expected: All tests pass (14 Phase 0 + 11 World + 9 MapGenerator + 7 Camera = 41 total).

- [ ] **Step 2: Visual verification in browser**

Checklist:
- [ ] Map generates without errors, looks varied each run (refresh page)
- [ ] All tile types visually distinguishable (rock, dirt, floor, gold, gem, lava, water)
- [ ] Camera pans smoothly with WASD and middle-mouse
- [ ] Camera zoom works, tiles remain crisp
- [ ] Minimap reflects live tile state
- [ ] Minimap click pans camera correctly
- [ ] screenToWorld and worldToScreen are inverses (covered by Camera tests)

- [ ] **Step 3: Final commit if needed**

Only if verification revealed fixes.
