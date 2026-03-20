# Phase 2 — Pathfinding & Imps Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement A* pathfinding, the Entity system, Imp worker AI with full state machine, dig/carry job queue, procedural entity rendering, and pooled particle effects — resulting in imps that autonomously dig tunnels, collect gold, and manage their needs.

**Architecture:** Pathfinder operates on World's walkable grid. Entity is a plain-data base class. EntityManager owns all entities and provides spatial queries. JobQueue manages dig/carry jobs claimed by Imps. Imp extends Entity with a priority-based AI state machine. ParticleSystem uses ObjectPool for zero-allocation particle effects. EntityRenderer reads entity state and draws procedural sprites. All cross-system communication via EventBus.

**Tech Stack:** Vanilla JS (ES Modules), Canvas 2D, Vitest

---

## File Structure

| File | Action | Purpose |
|------|--------|---------|
| `src/core/ObjectPool.js` | Replace stub | Generic pre-allocated object pool |
| `src/world/Pathfinder.js` | Replace stub | A* pathfinding with caching, diagonal movement |
| `src/entities/Entity.js` | Replace stub | Base entity: id, position, velocity, health, state |
| `src/entities/EntityManager.js` | Replace stub | Entity lifecycle, update loop, spatial queries |
| `src/systems/JobQueue.js` | Replace stub | Dig/carry job assignment, one imp per job |
| `src/entities/Imp.js` | Replace stub | Worker AI: dig, carry, eat, sleep, flee, idle |
| `src/rendering/ParticleSystem.js` | Replace stub | Pooled particle effects (500 pre-allocated) |
| `src/rendering/EntityRenderer.js` | Replace stub | Procedural creature sprite drawing |
| `src/main.js` | Modify | Wire up all Phase 2 systems |
| `tests/core/ObjectPool.test.js` | Create | ObjectPool unit tests |
| `tests/world/Pathfinder.test.js` | Create | A* pathfinding unit tests |
| `tests/entities/Entity.test.js` | Create | Entity base class unit tests |
| `tests/entities/EntityManager.test.js` | Create | EntityManager unit tests |
| `tests/systems/JobQueue.test.js` | Create | JobQueue unit tests |
| `tests/entities/Imp.test.js` | Create | Imp AI state machine unit tests |

---

### Task 1: ObjectPool

**Files:**
- Replace: `src/core/ObjectPool.js`
- Create: `tests/core/ObjectPool.test.js`

- [ ] **Step 1: Write failing tests**

```js
import { describe, it, expect } from 'vitest';
import { ObjectPool } from '../../src/core/ObjectPool.js';

describe('ObjectPool', () => {
  it('creates pool with specified size', () => {
    const pool = new ObjectPool(() => ({ x: 0, y: 0 }), 10);
    expect(pool.size).toBe(10);
    expect(pool.activeCount).toBe(0);
  });

  it('acquire returns an object from the pool', () => {
    const pool = new ObjectPool(() => ({ x: 0, y: 0 }), 5);
    const obj = pool.acquire();
    expect(obj).toBeDefined();
    expect(pool.activeCount).toBe(1);
  });

  it('release returns object to pool', () => {
    const pool = new ObjectPool(() => ({ x: 0, y: 0 }), 5);
    const obj = pool.acquire();
    pool.release(obj);
    expect(pool.activeCount).toBe(0);
  });

  it('acquire reuses released objects', () => {
    const pool = new ObjectPool(() => ({ x: 0, y: 0 }), 2);
    const obj1 = pool.acquire();
    obj1.x = 99;
    pool.release(obj1);
    const obj2 = pool.acquire();
    expect(obj2).toBe(obj1); // Same reference
  });

  it('acquire returns null when pool exhausted', () => {
    const pool = new ObjectPool(() => ({ x: 0, y: 0 }), 2);
    pool.acquire();
    pool.acquire();
    const obj = pool.acquire();
    expect(obj).toBeNull();
  });

  it('calls reset function on release if provided', () => {
    const reset = (obj) => { obj.x = 0; obj.y = 0; };
    const pool = new ObjectPool(() => ({ x: 0, y: 0 }), 3, reset);
    const obj = pool.acquire();
    obj.x = 50;
    obj.y = 75;
    pool.release(obj);
    const reused = pool.acquire();
    expect(reused.x).toBe(0);
    expect(reused.y).toBe(0);
  });

  it('forEach iterates only active objects', () => {
    const pool = new ObjectPool(() => ({ x: 0 }), 5);
    pool.acquire().x = 1;
    pool.acquire().x = 2;
    pool.acquire().x = 3;
    const values = [];
    pool.forEach(obj => values.push(obj.x));
    expect(values).toEqual([1, 2, 3]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/core/ObjectPool.test.js`

- [ ] **Step 3: Implement ObjectPool**

```js
/**
 * Generic pre-allocated object pool.
 * Avoids per-frame heap allocations for frequently spawned objects
 * like particles, floating text, etc.
 */
export class ObjectPool {
  /**
   * @param {Function} factory - Creates a new pool object.
   * @param {number} size - Number of objects to pre-allocate.
   * @param {Function} [resetFn] - Optional reset called on release.
   */
  constructor(factory, size, resetFn) {
    this._resetFn = resetFn || null;
    this._pool = [];
    this._active = [];
    for (let i = 0; i < size; i++) {
      this._pool.push(factory());
    }
  }

  /** @returns {number} Total pool capacity. */
  get size() { return this._pool.length + this._active.length; }

  /** @returns {number} Currently active (acquired) objects. */
  get activeCount() { return this._active.length; }

  /**
   * Acquire an object from the pool.
   * @returns {Object|null} Pool object, or null if exhausted.
   */
  acquire() {
    if (this._pool.length === 0) return null;
    const obj = this._pool.pop();
    this._active.push(obj);
    return obj;
  }

  /**
   * Release an object back to the pool.
   * @param {Object} obj
   */
  release(obj) {
    const idx = this._active.indexOf(obj);
    if (idx === -1) return;
    this._active.splice(idx, 1);
    if (this._resetFn) this._resetFn(obj);
    this._pool.push(obj);
  }

  /**
   * Iterate over all active objects.
   * Safe to call release() on items during iteration.
   * @param {Function} fn - Called with each active object.
   */
  forEach(fn) {
    // Snapshot length; iterate backwards so release-splice is safe
    for (let i = this._active.length - 1; i >= 0; i--) {
      if (i < this._active.length) {
        fn(this._active[i]);
      }
    }
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/core/ObjectPool.test.js`
Expected: All 7 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/core/ObjectPool.js tests/core/ObjectPool.test.js
git commit -m "feat: implement ObjectPool for zero-allocation object reuse"
```

---

### Task 2: Pathfinder

**Files:**
- Replace: `src/world/Pathfinder.js`
- Create: `tests/world/Pathfinder.test.js`

- [ ] **Step 1: Write failing tests**

```js
import { describe, it, expect } from 'vitest';
import { Pathfinder } from '../../src/world/Pathfinder.js';
import { World } from '../../src/world/World.js';
import { TILE_TYPES } from '../../src/constants.js';

/**
 * Helper: create a small world with a corridor of walkable floor.
 * Default: 10x10, all rock, with a cleared path.
 */
function makeTestWorld(width = 10, height = 10) {
  const world = new World();
  // Override dimensions for test world
  world.width = width;
  world.height = height;
  world.tiles = new Array(width * height).fill(TILE_TYPES.ROCK);
  return world;
}

function clearRect(world, x1, y1, x2, y2) {
  for (let y = y1; y <= y2; y++) {
    for (let x = x1; x <= x2; x++) {
      world.setTile(x, y, TILE_TYPES.CLAIMED_FLOOR);
    }
  }
}

describe('Pathfinder', () => {
  it('finds straight-line path on open floor', () => {
    const world = makeTestWorld();
    clearRect(world, 0, 0, 9, 9);
    const path = Pathfinder.findPath(world, 0, 0, 5, 0);
    expect(path).not.toBeNull();
    expect(path.length).toBeGreaterThan(0);
    // Path should end at destination
    const last = path[path.length - 1];
    expect(last.x).toBe(5);
    expect(last.y).toBe(0);
  });

  it('returns null when no path exists', () => {
    const world = makeTestWorld();
    // Only clear two disconnected areas
    world.setTile(0, 0, TILE_TYPES.CLAIMED_FLOOR);
    world.setTile(9, 9, TILE_TYPES.CLAIMED_FLOOR);
    const path = Pathfinder.findPath(world, 0, 0, 9, 9);
    expect(path).toBeNull();
  });

  it('navigates around obstacles', () => {
    const world = makeTestWorld();
    clearRect(world, 0, 0, 9, 9);
    // Wall across middle with one gap
    for (let x = 0; x < 9; x++) {
      world.setTile(x, 5, TILE_TYPES.ROCK);
    }
    // Gap at x=9, y=5 (already floor)
    const path = Pathfinder.findPath(world, 0, 0, 0, 9);
    expect(path).not.toBeNull();
    // Path must go around via x=9
    const maxX = Math.max(...path.map(p => p.x));
    expect(maxX).toBeGreaterThanOrEqual(9);
  });

  it('supports diagonal movement', () => {
    const world = makeTestWorld();
    clearRect(world, 0, 0, 9, 9);
    const path = Pathfinder.findPath(world, 0, 0, 3, 3);
    expect(path).not.toBeNull();
    // Diagonal path should be shorter than Manhattan
    expect(path.length).toBeLessThanOrEqual(4);
  });

  it('does not cut corners diagonally', () => {
    const world = makeTestWorld();
    clearRect(world, 0, 0, 4, 4);
    // Block corner: (1,0) and (0,1) are rock, making diagonal (0,0)->(1,1) impossible
    world.setTile(1, 0, TILE_TYPES.ROCK);
    world.setTile(0, 1, TILE_TYPES.ROCK);
    const path = Pathfinder.findPath(world, 0, 0, 1, 1);
    // (0,0) is completely enclosed by rock on two sides — no valid path exists
    // because corner-cutting is disabled and the only exit is diagonal
    expect(path).toBeNull();
  });

  it('returns path that starts adjacent to origin (excludes start tile)', () => {
    const world = makeTestWorld();
    clearRect(world, 0, 0, 5, 5);
    const path = Pathfinder.findPath(world, 0, 0, 3, 0);
    expect(path).not.toBeNull();
    // First tile should not be the start
    expect(path[0].x !== 0 || path[0].y !== 0).toBe(true);
  });

  it('uses cache for repeated identical queries', () => {
    const world = makeTestWorld();
    clearRect(world, 0, 0, 9, 9);
    const path1 = Pathfinder.findPath(world, 0, 0, 5, 5);
    const path2 = Pathfinder.findPath(world, 0, 0, 5, 5);
    expect(path1).toEqual(path2);
  });

  it('clearCache invalidates cached paths', () => {
    const world = makeTestWorld();
    clearRect(world, 0, 0, 9, 9);
    Pathfinder.findPath(world, 0, 0, 5, 5);
    Pathfinder.clearCache();
    // Should still work after cache clear
    const path = Pathfinder.findPath(world, 0, 0, 5, 5);
    expect(path).not.toBeNull();
  });

  it('handles start equals destination', () => {
    const world = makeTestWorld();
    world.setTile(3, 3, TILE_TYPES.CLAIMED_FLOOR);
    const path = Pathfinder.findPath(world, 3, 3, 3, 3);
    expect(path).not.toBeNull();
    expect(path.length).toBe(0);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/world/Pathfinder.test.js`

- [ ] **Step 3: Implement Pathfinder**

```js
/**
 * A* pathfinder on the World tile grid.
 * Supports diagonal movement with no corner-cutting.
 * Caches paths — call clearCache() when world changes.
 */
export class Pathfinder {
  /** @type {Map<string, Array<{x:number,y:number}>|null>} */
  static _cache = new Map();

  /**
   * Find a path from (sx,sy) to (dx,dy) on walkable tiles.
   * @param {import('./World.js').World} world
   * @param {number} sx - Start tile X.
   * @param {number} sy - Start tile Y.
   * @param {number} dx - Destination tile X.
   * @param {number} dy - Destination tile Y.
   * @returns {Array<{x:number,y:number}>|null} Path tiles (excluding start), or null if unreachable.
   */
  static findPath(world, sx, sy, dx, dy) {
    if (sx === dx && sy === dy) return [];

    const key = `${sx},${sy}-${dx},${dy}`;
    if (Pathfinder._cache.has(key)) {
      const cached = Pathfinder._cache.get(key);
      return cached ? cached.map(p => ({ x: p.x, y: p.y })) : cached;
    }

    const result = Pathfinder._astar(world, sx, sy, dx, dy);
    Pathfinder._cache.set(key, result);
    return result ? result.map(p => ({ x: p.x, y: p.y })) : result;
  }

  /** Clear the path cache. Call when tiles change. */
  static clearCache() {
    Pathfinder._cache.clear();
  }

  /**
   * A* implementation.
   * @private
   */
  static _astar(world, sx, sy, dx, dy) {
    const DIRS = [
      [1, 0], [-1, 0], [0, 1], [0, -1],   // Cardinal
      [1, 1], [1, -1], [-1, 1], [-1, -1],  // Diagonal
    ];
    const SQRT2 = Math.SQRT2;

    const w = world.width;
    const openSet = [];
    const gScore = new Map();
    const fScore = new Map();
    const cameFrom = new Map();
    const closedSet = new Set();

    const toKey = (x, y) => y * w + x;
    const heuristic = (x, y) => {
      // Octile distance
      const adx = Math.abs(x - dx);
      const ady = Math.abs(y - dy);
      return Math.max(adx, ady) + (SQRT2 - 1) * Math.min(adx, ady);
    };

    const startKey = toKey(sx, sy);
    gScore.set(startKey, 0);
    fScore.set(startKey, heuristic(sx, sy));
    openSet.push({ x: sx, y: sy, f: fScore.get(startKey) });

    while (openSet.length > 0) {
      // Find node with lowest fScore (simple linear scan — fine for grid sizes up to 80x60)
      let bestIdx = 0;
      for (let i = 1; i < openSet.length; i++) {
        if (openSet[i].f < openSet[bestIdx].f) bestIdx = i;
      }
      const current = openSet.splice(bestIdx, 1)[0];
      const cx = current.x;
      const cy = current.y;
      const cKey = toKey(cx, cy);

      if (cx === dx && cy === dy) {
        return Pathfinder._reconstructPath(cameFrom, cKey, sx, sy, w);
      }

      closedSet.add(cKey);

      for (const [ddx, ddy] of DIRS) {
        const nx = cx + ddx;
        const ny = cy + ddy;

        if (!world.isInBounds(nx, ny)) continue;
        if (!world.isWalkable(nx, ny)) continue;

        const nKey = toKey(nx, ny);
        if (closedSet.has(nKey)) continue;

        // No corner-cutting: for diagonal moves, both adjacent cardinal tiles must be walkable
        if (ddx !== 0 && ddy !== 0) {
          if (!world.isWalkable(cx + ddx, cy) || !world.isWalkable(cx, cy + ddy)) {
            continue;
          }
        }

        const moveCost = (ddx !== 0 && ddy !== 0) ? SQRT2 : 1;
        const tentG = gScore.get(cKey) + moveCost;

        if (!gScore.has(nKey) || tentG < gScore.get(nKey)) {
          cameFrom.set(nKey, cKey);
          gScore.set(nKey, tentG);
          const f = tentG + heuristic(nx, ny);
          fScore.set(nKey, f);

          // Check if already in open set
          const existing = openSet.findIndex(n => toKey(n.x, n.y) === nKey);
          if (existing !== -1) {
            openSet[existing].f = f;
          } else {
            openSet.push({ x: nx, y: ny, f });
          }
        }
      }
    }

    return null; // No path found
  }

  /**
   * Reconstruct path from cameFrom map.
   * @private
   */
  static _reconstructPath(cameFrom, endKey, sx, sy, w) {
    const path = [];
    let current = endKey;
    const startKey = sy * w + sx;

    while (current !== startKey) {
      const x = current % w;
      const y = Math.floor(current / w);
      path.unshift({ x, y });
      current = cameFrom.get(current);
      if (current === undefined) break;
    }

    return path;
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/world/Pathfinder.test.js`
Expected: All 9 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/world/Pathfinder.js tests/world/Pathfinder.test.js
git commit -m "feat: implement A* Pathfinder with diagonal movement and cache"
```

---

### Task 3: Entity Base Class

**Files:**
- Replace: `src/entities/Entity.js`
- Create: `tests/entities/Entity.test.js`

- [ ] **Step 1: Write failing tests**

```js
import { describe, it, expect } from 'vitest';
import { Entity } from '../../src/entities/Entity.js';

describe('Entity', () => {
  it('creates with unique id', () => {
    const e1 = new Entity('imp', 100, 200);
    const e2 = new Entity('imp', 100, 200);
    expect(e1.id).not.toBe(e2.id);
  });

  it('stores type and initial position', () => {
    const e = new Entity('knight', 50, 75);
    expect(e.type).toBe('knight');
    expect(e.x).toBe(50);
    expect(e.y).toBe(75);
  });

  it('has default health, velocity, and state', () => {
    const e = new Entity('imp', 0, 0);
    expect(e.health).toBe(0);
    expect(e.maxHealth).toBe(0);
    expect(e.vx).toBe(0);
    expect(e.vy).toBe(0);
    expect(e.state).toBe('idle');
  });

  it('takeDamage reduces health', () => {
    const e = new Entity('imp', 0, 0);
    e.health = 100;
    e.maxHealth = 100;
    e.takeDamage(30);
    expect(e.health).toBe(70);
  });

  it('takeDamage does not go below zero', () => {
    const e = new Entity('imp', 0, 0);
    e.health = 10;
    e.maxHealth = 100;
    e.takeDamage(50);
    expect(e.health).toBe(0);
  });

  it('isDead returns true when health is zero', () => {
    const e = new Entity('imp', 0, 0);
    e.health = 0;
    expect(e.isDead()).toBe(true);
    e.health = 1;
    expect(e.isDead()).toBe(false);
  });

  it('stores previous position for interpolation', () => {
    const e = new Entity('imp', 10, 20);
    expect(e.prevX).toBe(10);
    expect(e.prevY).toBe(20);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/entities/Entity.test.js`

- [ ] **Step 3: Implement Entity**

```js
/**
 * Base class for all game entities.
 * Pure data — no rendering, no DOM refs.
 * Subclasses add behavior via update(dt).
 */
export class Entity {
  static _nextId = 1;

  /**
   * @param {string} type - ENTITY_TYPES value.
   * @param {number} x - World position in pixels.
   * @param {number} y - World position in pixels.
   */
  constructor(type, x, y) {
    this.id = Entity._nextId++;
    this.type = type;
    this.x = x;
    this.y = y;
    this.prevX = x;
    this.prevY = y;
    this.vx = 0;
    this.vy = 0;
    this.health = 0;
    this.maxHealth = 0;
    this.state = 'idle';
    this.alive = true;
  }

  /**
   * Apply damage to entity.
   * @param {number} amount
   */
  takeDamage(amount) {
    this.health = Math.max(0, this.health - amount);
  }

  /**
   * @returns {boolean} True if health is zero or below.
   */
  isDead() {
    return this.health <= 0;
  }

  /**
   * Get tile coordinates for this entity's position.
   * @param {number} tileSize
   * @returns {{tx: number, ty: number}}
   */
  getTile(tileSize) {
    return {
      tx: Math.floor(this.x / tileSize),
      ty: Math.floor(this.y / tileSize),
    };
  }

  /**
   * Update entity state. Override in subclasses.
   * @param {number} _dt - Delta time in seconds.
   */
  update(_dt) {
    // Base does nothing — subclasses implement behavior
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/entities/Entity.test.js`
Expected: All 7 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/entities/Entity.js tests/entities/Entity.test.js
git commit -m "feat: implement Entity base class with position, health, and damage"
```

---

### Task 4: EntityManager

**Files:**
- Replace: `src/entities/EntityManager.js`
- Create: `tests/entities/EntityManager.test.js`

- [ ] **Step 1: Write failing tests**

```js
import { describe, it, expect, vi } from 'vitest';
import { EntityManager } from '../../src/entities/EntityManager.js';
import { Entity } from '../../src/entities/Entity.js';

describe('EntityManager', () => {
  it('adds and retrieves entities', () => {
    const em = new EntityManager();
    const e = new Entity('imp', 100, 200);
    em.add(e);
    expect(em.getById(e.id)).toBe(e);
  });

  it('removes entities', () => {
    const em = new EntityManager();
    const e = new Entity('imp', 100, 200);
    em.add(e);
    em.remove(e.id);
    expect(em.getById(e.id)).toBeUndefined();
  });

  it('getAll returns all entities', () => {
    const em = new EntityManager();
    em.add(new Entity('imp', 0, 0));
    em.add(new Entity('imp', 100, 100));
    expect(em.getAll().length).toBe(2);
  });

  it('getByType filters by entity type', () => {
    const em = new EntityManager();
    em.add(new Entity('imp', 0, 0));
    em.add(new Entity('knight', 100, 100));
    em.add(new Entity('imp', 200, 200));
    expect(em.getByType('imp').length).toBe(2);
    expect(em.getByType('knight').length).toBe(1);
  });

  it('update calls update on all entities', () => {
    const em = new EntityManager();
    const e = new Entity('imp', 0, 0);
    e.update = vi.fn();
    em.add(e);
    em.update(0.016);
    expect(e.update).toHaveBeenCalledWith(0.016);
  });

  it('update removes dead entities', () => {
    const em = new EntityManager();
    const e = new Entity('imp', 0, 0);
    e.health = 100;
    e.maxHealth = 100;
    em.add(e);
    e.alive = false;
    em.update(0.016);
    expect(em.getAll().length).toBe(0);
  });

  it('getEntitiesInRadius returns nearby entities', () => {
    const em = new EntityManager();
    const e1 = new Entity('imp', 100, 100);
    const e2 = new Entity('imp', 110, 110);
    const e3 = new Entity('imp', 500, 500);
    em.add(e1);
    em.add(e2);
    em.add(e3);
    const nearby = em.getEntitiesInRadius(100, 100, 50);
    expect(nearby.length).toBe(2);
    expect(nearby).toContain(e1);
    expect(nearby).toContain(e2);
  });

  it('stores previous positions before update', () => {
    const em = new EntityManager();
    const e = new Entity('imp', 100, 200);
    e.update = (dt) => { e.x += 10; e.y += 5; };
    em.add(e);
    em.update(0.016);
    expect(e.prevX).toBe(100);
    expect(e.prevY).toBe(200);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/entities/EntityManager.test.js`

- [ ] **Step 3: Implement EntityManager**

```js
/**
 * Manages all game entities — lifecycle, updates, and spatial queries.
 * Single source of truth for entity existence.
 */
export class EntityManager {
  constructor() {
    /** @type {Map<number, import('./Entity.js').Entity>} */
    this._entities = new Map();
  }

  /**
   * Add an entity.
   * @param {import('./Entity.js').Entity} entity
   */
  add(entity) {
    this._entities.set(entity.id, entity);
  }

  /**
   * Remove an entity by id.
   * @param {number} id
   */
  remove(id) {
    this._entities.delete(id);
  }

  /**
   * Get entity by id.
   * @param {number} id
   * @returns {import('./Entity.js').Entity|undefined}
   */
  getById(id) {
    return this._entities.get(id);
  }

  /**
   * Get all entities.
   * @returns {import('./Entity.js').Entity[]}
   */
  getAll() {
    return Array.from(this._entities.values());
  }

  /**
   * Get all entities of a specific type.
   * @param {string} type
   * @returns {import('./Entity.js').Entity[]}
   */
  getByType(type) {
    return this.getAll().filter(e => e.type === type);
  }

  /**
   * Get entities within radius of a point.
   * @param {number} x - Center X in world pixels.
   * @param {number} y - Center Y in world pixels.
   * @param {number} radius - Search radius in pixels.
   * @returns {import('./Entity.js').Entity[]}
   */
  getEntitiesInRadius(x, y, radius) {
    const r2 = radius * radius;
    return this.getAll().filter(e => {
      const dx = e.x - x;
      const dy = e.y - y;
      return dx * dx + dy * dy <= r2;
    });
  }

  /**
   * Update all entities. Stores previous positions for interpolation.
   * Removes dead entities.
   * @param {number} dt - Delta time in seconds.
   */
  update(dt) {
    for (const entity of this._entities.values()) {
      entity.prevX = entity.x;
      entity.prevY = entity.y;
      entity.update(dt);
    }
    // Remove dead entities
    for (const [id, entity] of this._entities) {
      if (!entity.alive) {
        this._entities.delete(id);
      }
    }
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/entities/EntityManager.test.js`
Expected: All 8 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/entities/EntityManager.js tests/entities/EntityManager.test.js
git commit -m "feat: implement EntityManager with lifecycle and spatial queries"
```

---

### Task 5: JobQueue

**Files:**
- Replace: `src/systems/JobQueue.js`
- Create: `tests/systems/JobQueue.test.js`

- [ ] **Step 1: Write failing tests**

```js
import { describe, it, expect, vi } from 'vitest';
import { JobQueue } from '../../src/systems/JobQueue.js';
import { EventBus } from '../../src/core/EventBus.js';

describe('JobQueue', () => {
  it('queues a dig job', () => {
    const eventBus = new EventBus();
    const jq = new JobQueue(eventBus);
    jq.addDigJob(5, 10);
    expect(jq.getPendingDigJobs().length).toBe(1);
    expect(jq.getPendingDigJobs()[0]).toEqual({ x: 5, y: 10, assignedTo: null });
  });

  it('does not duplicate dig jobs at same tile', () => {
    const eventBus = new EventBus();
    const jq = new JobQueue(eventBus);
    jq.addDigJob(5, 10);
    jq.addDigJob(5, 10);
    expect(jq.getPendingDigJobs().length).toBe(1);
  });

  it('claims a job for an imp', () => {
    const eventBus = new EventBus();
    const jq = new JobQueue(eventBus);
    jq.addDigJob(5, 10);
    const job = jq.claimDigJob(42);
    expect(job).not.toBeNull();
    expect(job.assignedTo).toBe(42);
    expect(jq.getPendingDigJobs().length).toBe(0);
  });

  it('claimDigJob returns null when no jobs', () => {
    const eventBus = new EventBus();
    const jq = new JobQueue(eventBus);
    const job = jq.claimDigJob(42);
    expect(job).toBeNull();
  });

  it('completeDigJob removes the job', () => {
    const eventBus = new EventBus();
    const jq = new JobQueue(eventBus);
    jq.addDigJob(5, 10);
    const job = jq.claimDigJob(42);
    jq.completeDigJob(5, 10);
    expect(jq.getAllDigJobs().length).toBe(0);
  });

  it('releaseJob makes it available again', () => {
    const eventBus = new EventBus();
    const jq = new JobQueue(eventBus);
    jq.addDigJob(5, 10);
    jq.claimDigJob(42);
    jq.releaseJob(42);
    expect(jq.getPendingDigJobs().length).toBe(1);
    expect(jq.getPendingDigJobs()[0].assignedTo).toBeNull();
  });

  it('publishes JOB_UPDATED event on add', () => {
    const eventBus = new EventBus();
    const spy = vi.fn();
    eventBus.subscribe('job:updated', spy);
    const jq = new JobQueue(eventBus);
    jq.addDigJob(5, 10);
    expect(spy).toHaveBeenCalled();
  });

  it('isDigQueued checks if a tile has a pending job', () => {
    const eventBus = new EventBus();
    const jq = new JobQueue(eventBus);
    jq.addDigJob(5, 10);
    expect(jq.isDigQueued(5, 10)).toBe(true);
    expect(jq.isDigQueued(1, 1)).toBe(false);
  });

  it('getJobForImp returns the job claimed by a specific imp', () => {
    const eventBus = new EventBus();
    const jq = new JobQueue(eventBus);
    jq.addDigJob(5, 10);
    jq.claimDigJob(42);
    const job = jq.getJobForImp(42);
    expect(job).not.toBeNull();
    expect(job.x).toBe(5);
    expect(job.y).toBe(10);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/systems/JobQueue.test.js`

- [ ] **Step 3: Implement JobQueue**

```js
import { EVENTS } from '../constants.js';

/**
 * Manages dig and carry jobs. Imps claim one job at a time.
 * Job released if imp dies mid-task.
 */
export class JobQueue {
  /**
   * @param {import('../core/EventBus.js').EventBus} eventBus
   */
  constructor(eventBus) {
    this._eventBus = eventBus;
    /** @type {Array<{x: number, y: number, assignedTo: number|null}>} */
    this._digJobs = [];
  }

  /**
   * Queue a dig job at tile position.
   * @param {number} x - Tile X.
   * @param {number} y - Tile Y.
   */
  addDigJob(x, y) {
    // Don't duplicate
    if (this._digJobs.some(j => j.x === x && j.y === y)) return;
    this._digJobs.push({ x, y, assignedTo: null });
    this._eventBus.publish(EVENTS.JOB_UPDATED, { type: 'dig', x, y, action: 'added' });
  }

  /**
   * Claim the nearest unclaimed dig job for an imp.
   * @param {number} impId
   * @returns {{x: number, y: number, assignedTo: number}|null}
   */
  claimDigJob(impId) {
    const job = this._digJobs.find(j => j.assignedTo === null);
    if (!job) return null;
    job.assignedTo = impId;
    return job;
  }

  /**
   * Mark a dig job as complete and remove it.
   * @param {number} x
   * @param {number} y
   */
  completeDigJob(x, y) {
    const idx = this._digJobs.findIndex(j => j.x === x && j.y === y);
    if (idx !== -1) {
      this._digJobs.splice(idx, 1);
      this._eventBus.publish(EVENTS.JOB_UPDATED, { type: 'dig', x, y, action: 'completed' });
    }
  }

  /**
   * Release all jobs assigned to an imp (e.g., on death).
   * @param {number} impId
   */
  releaseJob(impId) {
    for (const job of this._digJobs) {
      if (job.assignedTo === impId) {
        job.assignedTo = null;
      }
    }
  }

  /**
   * Get all unclaimed dig jobs.
   * @returns {Array<{x: number, y: number, assignedTo: null}>}
   */
  getPendingDigJobs() {
    return this._digJobs.filter(j => j.assignedTo === null);
  }

  /**
   * Get all dig jobs (claimed and unclaimed).
   * @returns {Array<{x: number, y: number, assignedTo: number|null}>}
   */
  getAllDigJobs() {
    return this._digJobs;
  }

  /**
   * Check if a tile has a queued dig job.
   * @param {number} x
   * @param {number} y
   * @returns {boolean}
   */
  isDigQueued(x, y) {
    return this._digJobs.some(j => j.x === x && j.y === y);
  }

  /**
   * Get the job currently assigned to an imp.
   * @param {number} impId
   * @returns {{x: number, y: number, assignedTo: number}|null}
   */
  getJobForImp(impId) {
    return this._digJobs.find(j => j.assignedTo === impId) || null;
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/systems/JobQueue.test.js`
Expected: All 9 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/systems/JobQueue.js tests/systems/JobQueue.test.js
git commit -m "feat: implement JobQueue with dig job assignment and release"
```

---

### Task 6: Imp AI

**Files:**
- Replace: `src/entities/Imp.js`
- Create: `tests/entities/Imp.test.js`

- [ ] **Step 1: Write failing tests**

```js
import { describe, it, expect, beforeEach } from 'vitest';
import { Imp } from '../../src/entities/Imp.js';
import { World } from '../../src/world/World.js';
import { EventBus } from '../../src/core/EventBus.js';
import { JobQueue } from '../../src/systems/JobQueue.js';
import { TILE_TYPES, TILE_SIZE, CREATURE_STATES, IMP_STATS } from '../../src/constants.js';

/** Helper: create a small test world with walkable area. */
function makeWorld() {
  const world = new World();
  // Clear a large area for testing
  const cx = Math.floor(world.width / 2);
  const cy = Math.floor(world.height / 2);
  for (let dy = -5; dy <= 5; dy++) {
    for (let dx = -5; dx <= 5; dx++) {
      world.setTile(cx + dx, cy + dy, TILE_TYPES.CLAIMED_FLOOR);
    }
  }
  return world;
}

describe('Imp', () => {
  let world, eventBus, jobQueue;

  beforeEach(() => {
    world = makeWorld();
    eventBus = new EventBus();
    jobQueue = new JobQueue(eventBus);
  });

  it('creates with correct stats from IMP_STATS', () => {
    const cx = Math.floor(world.width / 2);
    const cy = Math.floor(world.height / 2);
    const imp = new Imp(cx * TILE_SIZE + 16, cy * TILE_SIZE + 16, world, eventBus, jobQueue);
    expect(imp.health).toBe(IMP_STATS.hp);
    expect(imp.maxHealth).toBe(IMP_STATS.hp);
    expect(imp.hunger).toBe(IMP_STATS.maxHunger);
    expect(imp.energy).toBe(IMP_STATS.maxEnergy);
  });

  it('starts in IDLE state', () => {
    const cx = Math.floor(world.width / 2);
    const cy = Math.floor(world.height / 2);
    const imp = new Imp(cx * TILE_SIZE + 16, cy * TILE_SIZE + 16, world, eventBus, jobQueue);
    expect(imp.state).toBe(CREATURE_STATES.IDLE);
  });

  it('transitions to MOVING when dig job available', () => {
    const cx = Math.floor(world.width / 2);
    const cy = Math.floor(world.height / 2);
    const imp = new Imp(cx * TILE_SIZE + 16, cy * TILE_SIZE + 16, world, eventBus, jobQueue);
    // Add a diggable tile adjacent to floor
    world.setTile(cx + 6, cy, TILE_TYPES.DIRT);
    jobQueue.addDigJob(cx + 6, cy);
    imp.update(0.016);
    // Should claim job and start moving
    expect([CREATURE_STATES.MOVING, CREATURE_STATES.DIGGING]).toContain(imp.state);
  });

  it('flees when health is low', () => {
    const cx = Math.floor(world.width / 2);
    const cy = Math.floor(world.height / 2);
    const imp = new Imp(cx * TILE_SIZE + 16, cy * TILE_SIZE + 16, world, eventBus, jobQueue);
    imp.health = IMP_STATS.fleeHealthThreshold - 1;
    imp.update(0.016);
    expect(imp.state).toBe(CREATURE_STATES.FLEEING);
  });

  it('hunger decreases over time', () => {
    const cx = Math.floor(world.width / 2);
    const cy = Math.floor(world.height / 2);
    const imp = new Imp(cx * TILE_SIZE + 16, cy * TILE_SIZE + 16, world, eventBus, jobQueue);
    const initialHunger = imp.hunger;
    // Simulate several seconds of updates
    for (let i = 0; i < 60; i++) imp.update(0.5);
    expect(imp.hunger).toBeLessThan(initialHunger);
  });

  it('energy decreases over time', () => {
    const cx = Math.floor(world.width / 2);
    const cy = Math.floor(world.height / 2);
    const imp = new Imp(cx * TILE_SIZE + 16, cy * TILE_SIZE + 16, world, eventBus, jobQueue);
    const initialEnergy = imp.energy;
    for (let i = 0; i < 60; i++) imp.update(0.5);
    expect(imp.energy).toBeLessThan(initialEnergy);
  });

  it('moves along path toward target', () => {
    const cx = Math.floor(world.width / 2);
    const cy = Math.floor(world.height / 2);
    const imp = new Imp(cx * TILE_SIZE + 16, cy * TILE_SIZE + 16, world, eventBus, jobQueue);
    // Add a dig job nearby
    world.setTile(cx + 6, cy, TILE_TYPES.DIRT);
    jobQueue.addDigJob(cx + 6, cy);
    const startX = imp.x;
    // Run many updates to allow movement
    for (let i = 0; i < 120; i++) imp.update(0.016);
    expect(imp.x).not.toBe(startX);
  });

  it('transitions to EATING when hunger is low', () => {
    const cx = Math.floor(world.width / 2);
    const cy = Math.floor(world.height / 2);
    const imp = new Imp(cx * TILE_SIZE + 16, cy * TILE_SIZE + 16, world, eventBus, jobQueue);
    imp.hunger = IMP_STATS.hungerThreshold - 1;
    imp.update(0.016);
    expect(imp.state).toBe(CREATURE_STATES.EATING);
  });

  it('recovers hunger while eating', () => {
    const cx = Math.floor(world.width / 2);
    const cy = Math.floor(world.height / 2);
    const imp = new Imp(cx * TILE_SIZE + 16, cy * TILE_SIZE + 16, world, eventBus, jobQueue);
    imp.hunger = IMP_STATS.hungerThreshold - 1;
    imp.update(0.016); // Enter eating
    const hungerBefore = imp.hunger;
    imp.update(1.0); // Eat for 1 second
    expect(imp.hunger).toBeGreaterThan(hungerBefore);
  });

  it('transitions to SLEEPING when energy is low', () => {
    const cx = Math.floor(world.width / 2);
    const cy = Math.floor(world.height / 2);
    const imp = new Imp(cx * TILE_SIZE + 16, cy * TILE_SIZE + 16, world, eventBus, jobQueue);
    imp.energy = IMP_STATS.energyThreshold - 1;
    imp.hunger = IMP_STATS.maxHunger; // Keep hunger high to avoid eating
    imp.update(0.016);
    expect(imp.state).toBe(CREATURE_STATES.SLEEPING);
  });

  it('recovers energy while sleeping', () => {
    const cx = Math.floor(world.width / 2);
    const cy = Math.floor(world.height / 2);
    const imp = new Imp(cx * TILE_SIZE + 16, cy * TILE_SIZE + 16, world, eventBus, jobQueue);
    imp.energy = IMP_STATS.energyThreshold - 1;
    imp.hunger = IMP_STATS.maxHunger;
    imp.update(0.016); // Enter sleeping
    const energyBefore = imp.energy;
    imp.update(1.0); // Sleep for 1 second
    expect(imp.energy).toBeGreaterThan(energyBefore);
  });

  it('releases job on death', () => {
    const cx = Math.floor(world.width / 2);
    const cy = Math.floor(world.height / 2);
    const imp = new Imp(cx * TILE_SIZE + 16, cy * TILE_SIZE + 16, world, eventBus, jobQueue);
    world.setTile(cx + 6, cy, TILE_TYPES.DIRT);
    jobQueue.addDigJob(cx + 6, cy);
    imp.update(0.016); // Claim job
    imp.alive = false;
    // Check that job is released
    expect(jobQueue.getJobForImp(imp.id)).not.toBeNull();
    jobQueue.releaseJob(imp.id);
    expect(jobQueue.getPendingDigJobs().length).toBe(1);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/entities/Imp.test.js`

- [ ] **Step 3: Implement Imp**

```js
import { Entity } from './Entity.js';
import { Pathfinder } from '../world/Pathfinder.js';
import { ENTITY_TYPES, CREATURE_STATES, IMP_STATS, TILE_SIZE, TILE_TYPES, EVENTS } from '../constants.js';

/**
 * Imp worker creature with autonomous AI.
 * Priority: flee (health < 20) → eat (hunger < 30) → sleep (energy < 20) → dig → idle wander.
 * Note: CARRYING is deferred to Phase 3 when Treasury rooms exist.
 * Imp directly references World and JobQueue for pragmatic pathfinding/job access.
 */
export class Imp extends Entity {
  /**
   * @param {number} x - World X in pixels.
   * @param {number} y - World Y in pixels.
   * @param {import('../world/World.js').World} world
   * @param {import('../core/EventBus.js').EventBus} eventBus
   * @param {import('../systems/JobQueue.js').JobQueue} jobQueue
   */
  constructor(x, y, world, eventBus, jobQueue) {
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
  }

  /**
   * @param {number} dt - Delta time in seconds.
   */
  update(dt) {
    // Drain needs over time
    this.hunger = Math.max(0, this.hunger - dt * 0.5);
    this.energy = Math.max(0, this.energy - dt * 0.3);

    // Priority-based AI: flee → eat → sleep → (continue current) → decide
    if (this.health < IMP_STATS.fleeHealthThreshold) {
      this._enterFlee();
    } else if (this.state === CREATURE_STATES.FLEEING) {
      this._updateFlee(dt);
    } else if (this.state === CREATURE_STATES.EATING) {
      this._updateEat(dt);
    } else if (this.state === CREATURE_STATES.SLEEPING) {
      this._updateSleep(dt);
    } else if (this.hunger < IMP_STATS.hungerThreshold && this.state !== CREATURE_STATES.DIGGING) {
      this._enterEat();
    } else if (this.energy < IMP_STATS.energyThreshold && this.state !== CREATURE_STATES.DIGGING) {
      this._enterSleep();
    } else if (this.state === CREATURE_STATES.DIGGING) {
      this._updateDig(dt);
    } else if (this.state === CREATURE_STATES.MOVING) {
      this._updateMove(dt);
    } else {
      // IDLE — look for work
      this._decideAction();
      if (this.state === CREATURE_STATES.IDLE) {
        this._updateIdle(dt);
      }
    }
  }

  /** @private */
  _decideAction() {
    // Try to claim a dig job (only if energy above threshold)
    if (this.energy > IMP_STATS.energyThreshold && !this._currentJob) {
      const job = this._jobQueue.claimDigJob(this.id);
      if (job) {
        this._currentJob = job;
        this._pathToTile(job.x, job.y);
        return;
      }
    }

    // No work — wander
    this.state = CREATURE_STATES.IDLE;
  }

  /** @private */
  _enterFlee() {
    if (this.state === CREATURE_STATES.FLEEING) return;
    this.state = CREATURE_STATES.FLEEING;
    // Release any job
    if (this._currentJob) {
      this._jobQueue.releaseJob(this.id);
      this._currentJob = null;
    }
    // Path toward center of map (dungeon heart area)
    const cx = Math.floor(this._world.width / 2);
    const cy = Math.floor(this._world.height / 2);
    this._pathToTile(cx, cy);
  }

  /** @private */
  _updateFlee(dt) {
    if (this.health >= IMP_STATS.fleeHealthThreshold) {
      this.state = CREATURE_STATES.IDLE;
      this._path = null;
      return;
    }
    this._followPath(dt);
  }

  /** @private — Enter EATING state. In Phase 2, eats "in place" (Hatchery rooms come in Phase 3). */
  _enterEat() {
    if (this.state === CREATURE_STATES.EATING) return;
    // Release any current job
    if (this._currentJob) {
      this._jobQueue.releaseJob(this.id);
      this._currentJob = null;
    }
    this.state = CREATURE_STATES.EATING;
    this._eatTimer = 0;
    this._path = null;
  }

  /** @private */
  _updateEat(dt) {
    this._eatTimer += dt;
    // Restore hunger over 3 seconds
    this.hunger = Math.min(IMP_STATS.maxHunger, this.hunger + dt * 20);
    if (this.hunger >= IMP_STATS.maxHunger * 0.8 || this._eatTimer > 3) {
      this.state = CREATURE_STATES.IDLE;
    }
  }

  /** @private — Enter SLEEPING state. In Phase 2, sleeps "in place" (Lair rooms come in Phase 3). */
  _enterSleep() {
    if (this.state === CREATURE_STATES.SLEEPING) return;
    // Release any current job
    if (this._currentJob) {
      this._jobQueue.releaseJob(this.id);
      this._currentJob = null;
    }
    this.state = CREATURE_STATES.SLEEPING;
    this._sleepTimer = 0;
    this._path = null;
  }

  /** @private */
  _updateSleep(dt) {
    this._sleepTimer += dt;
    // Restore energy over 4 seconds
    this.energy = Math.min(IMP_STATS.maxEnergy, this.energy + dt * 15);
    if (this.energy >= IMP_STATS.maxEnergy * 0.8 || this._sleepTimer > 4) {
      this.state = CREATURE_STATES.IDLE;
    }
  }

  /** @private */
  _updateMove(dt) {
    if (!this._path || this._pathIndex >= this._path.length) {
      // Arrived at destination
      if (this._currentJob) {
        // Check if adjacent to dig target
        const { tx, ty } = this.getTile(TILE_SIZE);
        const job = this._currentJob;
        const dist = Math.abs(tx - job.x) + Math.abs(ty - job.y);
        if (dist <= 1) {
          this.state = CREATURE_STATES.DIGGING;
          this._digProgress = 0;
          return;
        }
        // Try to pathfind closer
        this._pathToAdjacentWalkable(job.x, job.y);
        if (!this._path) {
          // Can't reach — release job
          this._jobQueue.releaseJob(this.id);
          this._currentJob = null;
          this.state = CREATURE_STATES.IDLE;
        }
      } else {
        this.state = CREATURE_STATES.IDLE;
      }
      return;
    }
    this._followPath(dt);
  }

  /** @private */
  _updateDig(dt) {
    if (!this._currentJob) {
      this.state = CREATURE_STATES.IDLE;
      return;
    }
    this._digProgress += dt;
    if (this._digProgress >= IMP_STATS.digTime) {
      // Complete dig
      const { x, y } = this._currentJob;
      const tileType = this._world.getTile(x, y);

      // Convert tile to unclaimed floor
      this._world.setTile(x, y, TILE_TYPES.UNCLAIMED_FLOOR);

      // Claim adjacent floor tiles
      this._claimAdjacentFloor(x, y);

      // Emit events
      this._eventBus.publish(EVENTS.TILE_DUG, { x, y, tileType });
      Pathfinder.clearCache();

      // Complete job
      this._jobQueue.completeDigJob(x, y);
      this._currentJob = null;
      this._digProgress = 0;
      this.state = CREATURE_STATES.IDLE;
    }
  }

  /** @private */
  _updateIdle(dt) {
    this._idleTimer += dt;
    if (this._idleTimer > 2) {
      this._idleTimer = 0;
      // Random wander on claimed floor
      this._wanderRandomly();
    }
    if (this._wanderTarget) {
      this._followPath(dt);
      if (!this._path || this._pathIndex >= this._path.length) {
        this._wanderTarget = null;
      }
    }
  }

  /** @private */
  _wanderRandomly() {
    const { tx, ty } = this.getTile(TILE_SIZE);
    const range = 3;
    for (let attempt = 0; attempt < 5; attempt++) {
      const nx = tx + Math.floor(Math.random() * range * 2) - range;
      const ny = ty + Math.floor(Math.random() * range * 2) - range;
      if (this._world.isWalkable(nx, ny)) {
        this._pathToTile(nx, ny);
        this._wanderTarget = { x: nx, y: ny };
        return;
      }
    }
  }

  /** @private */
  _pathToTile(tx, ty) {
    const { tx: sx, ty: sy } = this.getTile(TILE_SIZE);
    const path = Pathfinder.findPath(this._world, sx, sy, tx, ty);
    if (path && path.length > 0) {
      this._path = path;
      this._pathIndex = 0;
      if (this.state === CREATURE_STATES.IDLE) {
        this.state = CREATURE_STATES.MOVING;
      }
    } else {
      this._path = null;
    }
  }

  /**
   * Pathfind to a walkable tile adjacent to (tx, ty).
   * @private
   */
  _pathToAdjacentWalkable(tx, ty) {
    const { tx: sx, ty: sy } = this.getTile(TILE_SIZE);
    const dirs = [[0, -1], [0, 1], [-1, 0], [1, 0]];
    for (const [dx, dy] of dirs) {
      const nx = tx + dx;
      const ny = ty + dy;
      if (this._world.isWalkable(nx, ny)) {
        const path = Pathfinder.findPath(this._world, sx, sy, nx, ny);
        if (path) {
          this._path = path;
          this._pathIndex = 0;
          this.state = CREATURE_STATES.MOVING;
          return;
        }
      }
    }
    this._path = null;
  }

  /** @private */
  _followPath(dt) {
    if (!this._path || this._pathIndex >= this._path.length) return;

    const target = this._path[this._pathIndex];
    // Target is center of tile
    const targetX = target.x * TILE_SIZE + TILE_SIZE / 2;
    const targetY = target.y * TILE_SIZE + TILE_SIZE / 2;

    const dx = targetX - this.x;
    const dy = targetY - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < 2) {
      this.x = targetX;
      this.y = targetY;
      this._pathIndex++;
      return;
    }

    const speed = IMP_STATS.speed * dt;
    const move = Math.min(speed, dist);
    this.x += (dx / dist) * move;
    this.y += (dy / dist) * move;
    this._facingRight = dx > 0;
  }

  /**
   * Claim adjacent unclaimed floor tiles.
   * @private
   */
  _claimAdjacentFloor(cx, cy) {
    const dirs = [[0, -1], [0, 1], [-1, 0], [1, 0]];
    for (const [dx, dy] of dirs) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (this._world.getTile(nx, ny) === TILE_TYPES.UNCLAIMED_FLOOR) {
        this._world.setTile(nx, ny, TILE_TYPES.CLAIMED_FLOOR);
      }
    }
    // Also claim the newly dug tile
    this._world.setTile(cx, cy, TILE_TYPES.CLAIMED_FLOOR);
  }

  /** @returns {number} Dig progress 0-1. */
  get digProgressRatio() {
    if (this.state !== CREATURE_STATES.DIGGING) return 0;
    return Math.min(1, this._digProgress / IMP_STATS.digTime);
  }

  /** @returns {boolean} */
  get facingRight() { return this._facingRight; }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/entities/Imp.test.js`
Expected: All 12 tests PASS.

- [ ] **Step 5: Run all tests**

Run: `npx vitest run`
Expected: All tests pass (previous 41 + new ones).

- [ ] **Step 6: Commit**

```bash
git add src/entities/Imp.js tests/entities/Imp.test.js
git commit -m "feat: implement Imp worker AI with pathfinding and dig/flee states"
```

---

### Task 7: ParticleSystem

**Files:**
- Replace: `src/rendering/ParticleSystem.js`

- [ ] **Step 1: Implement ParticleSystem**

```js
import { ObjectPool } from '../core/ObjectPool.js';
import { PARTICLE_POOL_SIZE } from '../constants.js';

/**
 * Pooled particle system for visual effects.
 * Uses ObjectPool for zero-allocation particle spawning.
 * Effects: gold bursts, debris on dig, sparks.
 */
export class ParticleSystem {
  /**
   * @param {CanvasRenderingContext2D} ctx
   * @param {import('./Camera.js').Camera} camera
   */
  constructor(ctx, camera) {
    this._ctx = ctx;
    this._camera = camera;
    this._pool = new ObjectPool(
      () => ({
        x: 0, y: 0, vx: 0, vy: 0,
        life: 0, maxLife: 0,
        size: 2, color: '#fff',
        gravity: 0,
      }),
      PARTICLE_POOL_SIZE,
      (p) => {
        p.x = 0; p.y = 0; p.vx = 0; p.vy = 0;
        p.life = 0; p.maxLife = 0;
        p.size = 2; p.color = '#fff';
        p.gravity = 0;
      }
    );
  }

  /**
   * Spawn a burst of particles at a world position.
   * @param {number} x - World X.
   * @param {number} y - World Y.
   * @param {string} color - CSS color.
   * @param {number} count - Number of particles.
   * @param {Object} [opts] - Optional overrides.
   */
  burst(x, y, color, count, opts = {}) {
    const speed = opts.speed || 80;
    const life = opts.life || 0.6;
    const size = opts.size || 2;
    const gravity = opts.gravity || 120;

    for (let i = 0; i < count; i++) {
      const p = this._pool.acquire();
      if (!p) break;
      const angle = Math.random() * Math.PI * 2;
      const mag = Math.random() * speed;
      p.x = x;
      p.y = y;
      p.vx = Math.cos(angle) * mag;
      p.vy = Math.sin(angle) * mag;
      p.life = life + Math.random() * 0.3;
      p.maxLife = p.life;
      p.size = size + Math.random() * size;
      p.color = color;
      p.gravity = gravity;
    }
  }

  /**
   * Update all active particles.
   * @param {number} dt
   */
  update(dt) {
    this._pool.forEach(p => {
      p.life -= dt;
      if (p.life <= 0) {
        this._pool.release(p);
        return;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += p.gravity * dt;
    });
  }

  /**
   * Render all active particles.
   */
  render() {
    const ctx = this._ctx;
    this._pool.forEach(p => {
      const [sx, sy] = this._camera.worldToScreen(p.x, p.y);
      const alpha = Math.max(0, p.life / p.maxLife);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      const sz = p.size * this._camera.zoom;
      ctx.fillRect(sx - sz / 2, sy - sz / 2, sz, sz);
    });
    ctx.globalAlpha = 1;
  }
}
```

- [ ] **Step 2: Run all tests to verify nothing broke**

Run: `npx vitest run`

- [ ] **Step 3: Commit**

```bash
git add src/rendering/ParticleSystem.js
git commit -m "feat: implement ParticleSystem with ObjectPool for zero-alloc effects"
```

---

### Task 8: EntityRenderer

**Files:**
- Replace: `src/rendering/EntityRenderer.js`

- [ ] **Step 1: Implement EntityRenderer**

```js
import { ENTITY_TYPES, CREATURE_STATES, TILE_SIZE } from '../constants.js';

/**
 * Draws all entities procedurally on the canvas.
 * Reads entity state — never mutates it.
 * Supports interpolation between update ticks for smooth visuals.
 */
export class EntityRenderer {
  /**
   * @param {CanvasRenderingContext2D} ctx
   * @param {import('../entities/EntityManager.js').EntityManager} entityManager
   * @param {import('./Camera.js').Camera} camera
   */
  constructor(ctx, entityManager, camera) {
    this._ctx = ctx;
    this._entityManager = entityManager;
    this._camera = camera;
    this._animTime = 0;
  }

  /**
   * Render all entities with interpolation.
   * @param {number} alpha - Interpolation factor 0-1.
   */
  render(alpha) {
    this._animTime += 0.016; // Approximate frame time for animation
    const ctx = this._ctx;

    for (const entity of this._entityManager.getAll()) {
      // Interpolate position
      const x = entity.prevX + (entity.x - entity.prevX) * alpha;
      const y = entity.prevY + (entity.y - entity.prevY) * alpha;

      const [sx, sy] = this._camera.worldToScreen(x, y);
      const zoom = this._camera.zoom;

      switch (entity.type) {
        case ENTITY_TYPES.IMP:
          this._drawImp(ctx, sx, sy, zoom, entity);
          break;
        // Phase 4+ will add TROLL, DARK_MISTRESS, KNIGHT, etc.
      }
    }
  }

  /**
   * Draw imp: small hunched figure with walk bob and direction awareness.
   * @private
   */
  _drawImp(ctx, sx, sy, zoom, imp) {
    const size = TILE_SIZE * zoom * 0.6;
    const halfSize = size / 2;
    const bobY = imp.state === CREATURE_STATES.MOVING
      ? Math.sin(this._animTime * 10) * 2 * zoom
      : 0;

    ctx.save();
    ctx.translate(sx, sy + bobY);

    // Flip if facing left
    if (!imp.facingRight) {
      ctx.scale(-1, 1);
    }

    // Body (hunched oval)
    ctx.fillStyle = '#c08040';
    ctx.beginPath();
    ctx.ellipse(0, -halfSize * 0.3, halfSize * 0.5, halfSize * 0.7, 0, 0, Math.PI * 2);
    ctx.fill();

    // Head
    ctx.fillStyle = '#d09050';
    ctx.beginPath();
    ctx.arc(halfSize * 0.1, -halfSize * 0.9, halfSize * 0.3, 0, Math.PI * 2);
    ctx.fill();

    // Eyes (tiny white dots)
    ctx.fillStyle = '#fff';
    ctx.fillRect(halfSize * 0.15, -halfSize * 1.0, 2 * zoom, 2 * zoom);

    // Arms (lines)
    ctx.strokeStyle = '#a06830';
    ctx.lineWidth = 1.5 * zoom;
    ctx.beginPath();
    ctx.moveTo(-halfSize * 0.3, -halfSize * 0.3);
    ctx.lineTo(-halfSize * 0.6, halfSize * 0.1);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(halfSize * 0.3, -halfSize * 0.3);
    ctx.lineTo(halfSize * 0.6, halfSize * 0.1);
    ctx.stroke();

    // Dig progress indicator (3-stage crack above imp)
    if (imp.state === CREATURE_STATES.DIGGING) {
      const progress = imp.digProgressRatio;
      ctx.fillStyle = '#ff0';
      const barW = size * 0.8;
      ctx.fillRect(-barW / 2, -halfSize * 1.5, barW * progress, 3 * zoom);
      ctx.strokeStyle = '#880';
      ctx.lineWidth = 0.5;
      ctx.strokeRect(-barW / 2, -halfSize * 1.5, barW, 3 * zoom);
    }

    // State indicator (small colored dot)
    if (imp.state === CREATURE_STATES.FLEEING) {
      ctx.fillStyle = '#f00';
      ctx.beginPath();
      ctx.arc(0, -halfSize * 1.3, 2 * zoom, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }
}
```

- [ ] **Step 2: Run all tests to verify nothing broke**

Run: `npx vitest run`

- [ ] **Step 3: Commit**

```bash
git add src/rendering/EntityRenderer.js
git commit -m "feat: implement EntityRenderer with procedural Imp sprite"
```

---

### Task 9: Wire Up main.js for Phase 2

**Files:**
- Modify: `src/main.js`

- [ ] **Step 1: Update main.js to integrate Phase 2 systems**

Replace the entire contents of `src/main.js` with:

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
import { Imp } from './entities/Imp.js';
import { COLORS, EVENTS, TILE_SIZE, TILE_TYPES } from './constants.js';

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

// Phase 2 systems
const entityManager = new EntityManager();
const entityRenderer = new EntityRenderer(ctx, entityManager, camera);
const particleSystem = new ParticleSystem(ctx, camera);
const jobQueue = new JobQueue(eventBus);

// Spawn initial imp at dungeon heart
const heartX = Math.floor(world.width / 2) * TILE_SIZE + TILE_SIZE / 2;
const heartY = Math.floor(world.height / 2) * TILE_SIZE + TILE_SIZE / 2;
const startImp = new Imp(heartX, heartY, world, eventBus, jobQueue);
entityManager.add(startImp);

// ── Event wiring ─────────────────────────────────────
// Handle minimap clicks
eventBus.subscribe(EVENTS.INPUT_CLICK, (e) => {
  if (minimap.handleClick(e.screenX, e.screenY)) return;

  // Click on diggable tile = queue dig job
  const { tileX, tileY } = e;
  if (world.isDiggable(tileX, tileY)) {
    // Check if adjacent to any walkable tile
    const neighbors = world.getNeighbors(tileX, tileY);
    const hasWalkableNeighbor = neighbors.some(n => world.isWalkable(n.x, n.y));
    if (hasWalkableNeighbor) {
      jobQueue.addDigJob(tileX, tileY);
      Pathfinder.clearCache();
    }
  }
});

// Particle effects on dig complete
eventBus.subscribe(EVENTS.TILE_DUG, (e) => {
  const wx = e.x * TILE_SIZE + TILE_SIZE / 2;
  const wy = e.y * TILE_SIZE + TILE_SIZE / 2;
  if (e.tileType === TILE_TYPES.GOLD_VEIN) {
    particleSystem.burst(wx, wy, '#f0c040', 15, { speed: 100, life: 0.8, size: 3 });
  } else {
    particleSystem.burst(wx, wy, '#8a7050', 8, { speed: 60, life: 0.5, size: 2 });
  }
});

window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// ── Game loop ────────────────────────────────────────
function update(dt) {
  inputManager.update(dt);
  entityManager.update(dt);
  particleSystem.update(dt);
}

function render(alpha) {
  const w = window.innerWidth;
  const h = window.innerHeight;
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = COLORS.BG;
  ctx.fillRect(0, 0, w, h);

  tileRenderer.render(alpha);
  entityRenderer.render(alpha);
  particleSystem.render();
  minimap.render();

  // Draw dig queue highlights
  for (const job of jobQueue.getAllDigJobs()) {
    const [sx, sy] = camera.worldToScreen(job.x * TILE_SIZE, job.y * TILE_SIZE);
    const size = TILE_SIZE * camera.zoom;
    ctx.fillStyle = job.assignedTo ? 'rgba(255, 200, 0, 0.2)' : 'rgba(255, 255, 0, 0.3)';
    ctx.fillRect(sx, sy, size, size);
  }

  fpsEl.textContent = `FPS: ${gameLoop.fps}`;
}

const gameLoop = new GameLoop(update, render);
gameLoop.start();
```

- [ ] **Step 2: Verify in browser**

Run `npm run dev` and open http://localhost:5173.
Expected:
- Map visible with all tile types
- One imp visible at dungeon heart (small brown figure)
- Clicking a diggable tile adjacent to floor shows yellow highlight
- Imp walks to queued tile and digs (progress bar visible)
- After digging, tile converts to floor + particle burst
- Gold vein digging produces gold particle burst
- Imp wanders when idle
- FPS stays at ~60
- No console errors

- [ ] **Step 3: Commit**

```bash
git add src/main.js
git commit -m "feat: wire up Phase 2 — entities, imp AI, dig jobs, particles"
```

---

### Task 10: Phase 2 Verification

- [ ] **Step 1: Run all tests**

Run: `npm test`
Expected: All tests pass (41 Phase 0-1 + new Phase 2 tests).

- [ ] **Step 2: Visual verification in browser**

Checklist:
- [ ] A* finds shortest path on open floor
- [ ] A* returns null when no path exists
- [ ] A* does not cut corners diagonally
- [ ] Imp transitions through states correctly (state shown in debug)
- [ ] Imp never gets permanently stuck
- [ ] Multiple imps claim different jobs (test by spawning more via console)
- [ ] Digging animation shows progress bar
- [ ] Gold vein digs produce gold particle burst
- [ ] Dirt digs produce debris particles
- [ ] ParticlePool: particles recycle (no infinite growth)

- [ ] **Step 3: Final commit if needed**

Only if verification revealed fixes.
