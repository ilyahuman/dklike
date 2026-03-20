# Phase 5 — Spells & Doors Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement three spells (Create Imp, Lightning Strike, Possess Creature) and a Door entity to complete Phase 5 of the DKLike game.

**Architecture:** SpellSystem manages spell selection, mana validation, and effect execution via EventBus. Door extends Entity with HP, team-aware passage, and corridor validation. Possess mode temporarily overrides InputManager/Camera to give direct creature control. All constants already exist in `src/constants.js`.

**Tech Stack:** Vanilla JavaScript (ES Modules), Canvas 2D, Vitest for testing.

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `src/systems/SpellSystem.js` | Replace stub | Spell selection, mana cost validation, effect execution for all 3 spells |
| `src/entities/Door.js` | Replace stub | Door entity: HP, team-aware walkability, corridor validation |
| `src/rendering/EntityRenderer.js` | Modify | Add `_drawDoor()` method, add DOOR case to render switch |
| `src/ui/Toolbar.js` | Modify | Enable spell/door buttons (remove disabled class), wire click handlers |
| `src/input/InputManager.js` | Modify | Add `isKeyDown(code)` public method for possess mode input |
| `src/rendering/Camera.js` | Modify | Add `lockTo(entity)` and `unlock()` for possess mode camera tracking |
| `src/main.js` | Modify | Integrate SpellSystem, Door placement, possess mode event wiring, spell VFX |
| `src/ui/HUD.js` | Modify | Add possess overlay ("POSSESSING [TYPE]" with red vignette) |
| `tests/systems/SpellSystem.test.js` | Create | Unit tests for SpellSystem |
| `tests/entities/Door.test.js` | Create | Unit tests for Door entity |

---

### Task 1: SpellSystem — Core Structure & Create Imp

**Files:**
- Replace: `src/systems/SpellSystem.js`
- Test: `tests/systems/SpellSystem.test.js`

- [ ] **Step 1: Write failing tests for SpellSystem core + Create Imp**

```js
// tests/systems/SpellSystem.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SpellSystem } from '../../src/systems/SpellSystem.js';
import { SPELL_TYPES, SPELL_CONFIG, EVENTS, ENTITY_TYPES, TILE_SIZE } from '../../src/constants.js';

function makeEventBus() {
  const subs = {};
  return {
    publish: vi.fn((event, data) => {
      (subs[event] || []).forEach(fn => fn(data));
    }),
    subscribe: vi.fn((event, fn) => {
      if (!subs[event]) subs[event] = [];
      subs[event].push(fn);
    }),
  };
}

function makeResourceManager(gold = 1000, mana = 500) {
  return {
    gold, mana,
    spendMana: vi.fn(function(amount) {
      if (this.mana < amount) return false;
      this.mana -= amount;
      return true;
    }),
    spendGold: vi.fn(function(amount) {
      if (this.gold < amount) return false;
      this.gold -= amount;
      return true;
    }),
  };
}

function makeEntityManager() {
  const entities = new Map();
  return {
    add: vi.fn(e => entities.set(e.id, e)),
    getAll: () => Array.from(entities.values()),
    getById: id => entities.get(id),
    getEntitiesInRadius: vi.fn(() => []),
    getByType: vi.fn(type => Array.from(entities.values()).filter(e => e.type === type)),
  };
}

function makeWorld() {
  return {
    width: 80, height: 60,
    getTile: vi.fn(() => 'claimed_floor'),
    isWalkable: vi.fn(() => true),
    getNeighbors: vi.fn(() => []),
  };
}

function makeRoomManager() {
  return {
    getRoomTilesOfType: vi.fn(() => [{ x: 40, y: 30 }]),
    getRoomAt: vi.fn(() => ({ type: 'dungeon_heart' })),
    isRoomTile: vi.fn(() => false),
  };
}

describe('SpellSystem', () => {
  let spellSystem, eventBus, resourceManager, entityManager, world, roomManager;

  beforeEach(() => {
    eventBus = makeEventBus();
    resourceManager = makeResourceManager();
    entityManager = makeEntityManager();
    world = makeWorld();
    roomManager = makeRoomManager();
    spellSystem = new SpellSystem(world, entityManager, eventBus, resourceManager, roomManager);
  });

  describe('selectSpell / getActiveSpell', () => {
    it('should set and return the active spell', () => {
      spellSystem.selectSpell(SPELL_TYPES.CREATE_IMP);
      expect(spellSystem.getActiveSpell()).toBe(SPELL_TYPES.CREATE_IMP);
    });

    it('should clear active spell with null', () => {
      spellSystem.selectSpell(SPELL_TYPES.CREATE_IMP);
      spellSystem.selectSpell(null);
      expect(spellSystem.getActiveSpell()).toBeNull();
    });
  });

  describe('Create Imp', () => {
    it('should spawn an imp at dungeon heart when mana sufficient', () => {
      const result = spellSystem.castCreateImp();
      expect(result).toBe(true);
      expect(resourceManager.spendMana).toHaveBeenCalledWith(SPELL_CONFIG[SPELL_TYPES.CREATE_IMP].manaCost);
      expect(entityManager.add).toHaveBeenCalled();
      const addedEntity = entityManager.add.mock.calls[0][0];
      expect(addedEntity.type).toBe(ENTITY_TYPES.IMP);
    });

    it('should fail when mana is insufficient', () => {
      resourceManager.mana = 0;
      const result = spellSystem.castCreateImp();
      expect(result).toBe(false);
      expect(entityManager.add).not.toHaveBeenCalled();
    });

    it('should publish SPELL_CAST event on success', () => {
      spellSystem.castCreateImp();
      expect(eventBus.publish).toHaveBeenCalledWith(EVENTS.SPELL_CAST, expect.objectContaining({
        spell: SPELL_TYPES.CREATE_IMP,
      }));
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/systems/SpellSystem.test.js`
Expected: FAIL — SpellSystem is a stub

- [ ] **Step 3: Implement SpellSystem core + Create Imp**

```js
// src/systems/SpellSystem.js
import { Imp } from '../entities/Imp.js';
import { Pathfinder } from '../world/Pathfinder.js';
import {
  SPELL_TYPES, SPELL_CONFIG, EVENTS, TILE_SIZE, ROOM_TYPES, ENTITY_TYPES,
} from '../constants.js';

/**
 * Manages spell selection, mana validation, and effect execution.
 * Communicates via EventBus — never directly mutates other systems.
 */
export class SpellSystem {
  constructor(world, entityManager, eventBus, resourceManager, roomManager, jobQueue = null) {
    this._world = world;
    this._entityManager = entityManager;
    this._eventBus = eventBus;
    this._resourceManager = resourceManager;
    this._roomManager = roomManager;
    this._jobQueue = jobQueue;
    this._activeSpell = null;
    this._castAnimTimer = 0;
    this._castAnimPosition = null;

    // Possess state
    this._possessedEntityId = null;
    this._prePossessCamera = null;
  }

  /** @returns {string|null} Active spell type or null. */
  getActiveSpell() { return this._activeSpell; }

  /** @param {string|null} spellType */
  selectSpell(spellType) { this._activeSpell = spellType; }

  /** @returns {boolean} Whether currently possessing a creature. */
  get isPossessing() { return this._possessedEntityId !== null; }

  /** @returns {number|null} ID of possessed entity. */
  get possessedEntityId() { return this._possessedEntityId; }

  /**
   * Cast Create Imp spell.
   * @returns {boolean} Success.
   */
  castCreateImp() {
    const config = SPELL_CONFIG[SPELL_TYPES.CREATE_IMP];
    if (!this._resourceManager.spendMana(config.manaCost)) return false;

    // Find Dungeon Heart center
    const heartTiles = this._roomManager.getRoomTilesOfType(ROOM_TYPES.DUNGEON_HEART);
    if (heartTiles.length === 0) return false;

    // Average position of heart tiles for center
    let cx = 0, cy = 0;
    for (const t of heartTiles) { cx += t.x; cy += t.y; }
    cx = Math.floor(cx / heartTiles.length);
    cy = Math.floor(cy / heartTiles.length);

    const px = cx * TILE_SIZE + TILE_SIZE / 2;
    const py = cy * TILE_SIZE + TILE_SIZE / 2;

    const imp = new Imp(px, py, this._world, this._eventBus, this._jobQueue, this._roomManager);
    this._entityManager.add(imp);

    // Cast animation
    this._castAnimTimer = config.castTime;
    this._castAnimPosition = { x: px, y: py };

    this._eventBus.publish(EVENTS.SPELL_CAST, {
      spell: SPELL_TYPES.CREATE_IMP, x: px, y: py,
    });
    this._eventBus.publish(EVENTS.ENTITY_SPAWNED, {
      type: ENTITY_TYPES.IMP, x: px, y: py,
    });

    return true;
  }

  /**
   * Cast Lightning Strike at world position.
   * @param {number} worldX
   * @param {number} worldY
   * @returns {boolean} Success.
   */
  castLightningStrike(worldX, worldY) {
    const config = SPELL_CONFIG[SPELL_TYPES.LIGHTNING_STRIKE];

    // Check if targeting own creature
    const tileX = Math.floor(worldX / TILE_SIZE);
    const tileY = Math.floor(worldY / TILE_SIZE);
    const radiusPx = config.aoeRadius * TILE_SIZE / 2;
    const entitiesInArea = this._entityManager.getEntitiesInRadius(worldX, worldY, radiusPx);
    const onlyFriendlies = entitiesInArea.length > 0 && entitiesInArea.every(e => e.team === 'player');
    if (onlyFriendlies) return false;

    if (!this._resourceManager.spendMana(config.manaCost)) return false;

    // AoE damage: hit everything in 3x3 tile area centered on target
    const halfAoe = Math.floor(config.aoeRadius / 2);
    for (let dy = -halfAoe; dy <= halfAoe; dy++) {
      for (let dx = -halfAoe; dx <= halfAoe; dx++) {
        const checkX = (tileX + dx) * TILE_SIZE + TILE_SIZE / 2;
        const checkY = (tileY + dy) * TILE_SIZE + TILE_SIZE / 2;
        const nearby = this._entityManager.getEntitiesInRadius(checkX, checkY, TILE_SIZE / 2);
        for (const entity of nearby) {
          if (entity.team === 'player') continue; // Don't damage own creatures
          entity.takeDamage(config.damage);
          this._eventBus.publish(EVENTS.ENTITY_DAMAGED, {
            targetId: entity.id, damage: config.damage, x: entity.x, y: entity.y,
          });
          if (entity.isDead()) {
            entity.alive = false;
            this._eventBus.publish(EVENTS.ENTITY_DIED, {
              entityId: entity.id, type: entity.type, x: entity.x, y: entity.y,
              team: entity.team, goldDrop: entity.goldDrop || 0,
            });
          }
        }
      }
    }

    this._eventBus.publish(EVENTS.SPELL_CAST, {
      spell: SPELL_TYPES.LIGHTNING_STRIKE, x: worldX, y: worldY,
    });

    return true;
  }

  /**
   * Possess a player creature.
   * @param {number} entityId
   * @returns {boolean} Success.
   */
  castPossess(entityId) {
    if (this._possessedEntityId !== null) return false;
    const config = SPELL_CONFIG[SPELL_TYPES.POSSESS_CREATURE];
    const entity = this._entityManager.getById(entityId);
    if (!entity || entity.team !== 'player') return false;
    if (!this._resourceManager.spendMana(config.manaCost)) return false;

    this._possessedEntityId = entityId;
    entity._aiSuspended = true;

    this._eventBus.publish(EVENTS.SPELL_CAST, { spell: SPELL_TYPES.POSSESS_CREATURE, entityId });
    this._eventBus.publish(EVENTS.POSSESS_START, { entityId, entityType: entity.type });
    return true;
  }

  /**
   * End possession.
   * @param {string} [reason='manual'] - 'manual' (ESC) or 'death' (creature died).
   */
  unpossess(reason = 'manual') {
    if (this._possessedEntityId === null) return;
    const entity = this._entityManager.getById(this._possessedEntityId);
    if (entity) entity._aiSuspended = false;
    const id = this._possessedEntityId;
    this._possessedEntityId = null;
    this._eventBus.publish(EVENTS.POSSESS_END, { entityId: id, reason });
  }

  /**
   * Move possessed creature in a direction.
   * @param {number} dx -1/0/1
   * @param {number} dy -1/0/1
   * @param {number} dt seconds
   */
  movePossessed(dx, dy, dt) {
    if (!this._possessedEntityId) return;
    const entity = this._entityManager.getById(this._possessedEntityId);
    if (!entity || !entity.alive) {
      this.unpossess();
      return;
    }
    const speed = entity.getEffectiveSpeed() * dt;
    const newX = entity.x + dx * speed;
    const newY = entity.y + dy * speed;
    const tileX = Math.floor(newX / TILE_SIZE);
    const tileY = Math.floor(newY / TILE_SIZE);
    if (this._world.isWalkable(tileX, tileY)) {
      entity.x = newX;
      entity.y = newY;
      if (dx !== 0) entity._facingRight = dx > 0;
    }
  }

  /**
   * Attack nearest enemy from possessed creature.
   */
  possessedAttack() {
    if (!this._possessedEntityId) return;
    const entity = this._entityManager.getById(this._possessedEntityId);
    if (!entity || !entity.alive) return;
    if (entity._attackTimer > 0) return;

    const rangePx = entity.attackRange * TILE_SIZE;
    let nearest = null;
    let nearestDist = Infinity;
    for (const e of this._entityManager.getAll()) {
      if (!e.alive || e.team === entity.team || e.team === null) continue;
      const dx = e.x - entity.x;
      const dy = e.y - entity.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < nearestDist && dist <= rangePx) {
        nearestDist = dist;
        nearest = e;
      }
    }

    if (!nearest) return;
    entity._attackTimer = entity.attackCooldown;
    const dmg = entity.damage;
    nearest.takeDamage(dmg);
    this._eventBus.publish(EVENTS.ENTITY_DAMAGED, {
      targetId: nearest.id, attackerId: entity.id, damage: dmg, x: nearest.x, y: nearest.y,
    });
    if (nearest.isDead()) {
      nearest.alive = false;
      this._eventBus.publish(EVENTS.ENTITY_DIED, {
        entityId: nearest.id, type: nearest.type, x: nearest.x, y: nearest.y,
        team: nearest.team, goldDrop: nearest.goldDrop || 0,
      });
    }
  }

  /**
   * Update spell system each tick.
   * @param {number} dt
   */
  update(dt) {
    // Cast animation timer
    if (this._castAnimTimer > 0) {
      this._castAnimTimer = Math.max(0, this._castAnimTimer - dt);
      if (this._castAnimTimer <= 0) {
        this._castAnimPosition = null;
      }
    }

    // Check if possessed creature died
    if (this._possessedEntityId !== null) {
      const entity = this._entityManager.getById(this._possessedEntityId);
      if (!entity || !entity.alive) {
        this.unpossess('death');
      }
    }
  }

  /** @returns {{timer: number, position: {x,y}|null}} Cast animation state. */
  getCastAnimState() {
    return { timer: this._castAnimTimer, position: this._castAnimPosition };
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/systems/SpellSystem.test.js`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add src/systems/SpellSystem.js tests/systems/SpellSystem.test.js
git commit -m "feat(phase5): implement SpellSystem core + Create Imp spell"
```

---

### Task 2: SpellSystem — Lightning Strike

**Files:**
- Modify: `src/systems/SpellSystem.js` (already implemented above, tests validate)
- Modify: `tests/systems/SpellSystem.test.js`

- [ ] **Step 1: Add Lightning Strike tests**

Add to `tests/systems/SpellSystem.test.js`:

```js
describe('Lightning Strike', () => {
  it('should deal AoE damage to enemies in radius', () => {
    const enemy = {
      id: 99, type: 'knight', team: 'enemy', alive: true,
      x: 40 * TILE_SIZE + 16, y: 30 * TILE_SIZE + 16,
      health: 150, maxHealth: 150,
      takeDamage: vi.fn(function(d) { this.health -= d; }),
      isDead: vi.fn(function() { return this.health <= 0; }),
      goldDrop: 50,
    };
    entityManager.getEntitiesInRadius = vi.fn(() => [enemy]);
    const result = spellSystem.castLightningStrike(40 * TILE_SIZE + 16, 30 * TILE_SIZE + 16);
    expect(result).toBe(true);
    expect(enemy.takeDamage).toHaveBeenCalledWith(SPELL_CONFIG[SPELL_TYPES.LIGHTNING_STRIKE].damage);
  });

  it('should not cast when only friendly targets in area', () => {
    const friendly = { id: 10, team: 'player', alive: true, x: 100, y: 100 };
    entityManager.getEntitiesInRadius = vi.fn(() => [friendly]);
    const result = spellSystem.castLightningStrike(100, 100);
    expect(result).toBe(false);
  });

  it('should fail when mana is insufficient', () => {
    resourceManager.mana = 0;
    entityManager.getEntitiesInRadius = vi.fn(() => []);
    const result = spellSystem.castLightningStrike(100, 100);
    expect(result).toBe(false);
  });

  it('should publish SPELL_CAST event on success', () => {
    entityManager.getEntitiesInRadius = vi.fn(() => []);
    spellSystem.castLightningStrike(100, 100);
    expect(eventBus.publish).toHaveBeenCalledWith(EVENTS.SPELL_CAST, expect.objectContaining({
      spell: SPELL_TYPES.LIGHTNING_STRIKE,
    }));
  });

  it('should kill entities reduced to 0 HP', () => {
    const enemy = {
      id: 99, type: 'knight', team: 'enemy', alive: true,
      x: 40 * TILE_SIZE + 16, y: 30 * TILE_SIZE + 16,
      health: 50, maxHealth: 150,
      takeDamage: vi.fn(function(d) { this.health -= d; }),
      isDead: vi.fn(function() { return this.health <= 0; }),
      goldDrop: 50,
    };
    entityManager.getEntitiesInRadius = vi.fn(() => [enemy]);
    spellSystem.castLightningStrike(40 * TILE_SIZE + 16, 30 * TILE_SIZE + 16);
    expect(enemy.alive).toBe(false);
    expect(eventBus.publish).toHaveBeenCalledWith(EVENTS.ENTITY_DIED, expect.objectContaining({
      entityId: 99,
    }));
  });
});
```

- [ ] **Step 2: Run tests to verify they pass**

Run: `npx vitest run tests/systems/SpellSystem.test.js`
Expected: PASS (10 tests)

- [ ] **Step 3: Commit**

```bash
git add tests/systems/SpellSystem.test.js
git commit -m "test(phase5): add Lightning Strike tests"
```

---

### Task 3: SpellSystem — Possess Creature

**Files:**
- Modify: `src/systems/SpellSystem.js` (already implemented above)
- Modify: `src/entities/Creature.js` (add `_aiSuspended` guard)
- Modify: `tests/systems/SpellSystem.test.js`

- [ ] **Step 1: Add Possess tests**

Add to `tests/systems/SpellSystem.test.js`:

```js
describe('Possess Creature', () => {
  let creature;

  beforeEach(() => {
    creature = {
      id: 50, type: 'troll', team: 'player', alive: true,
      x: 100, y: 100, _aiSuspended: false,
      _facingRight: true, _attackTimer: 0,
      attackRange: 1.2, attackCooldown: 1.0, damage: 15,
      getEffectiveSpeed: () => 40,
    };
    entityManager.add(creature);
  });

  it('should possess a player creature and spend mana', () => {
    const result = spellSystem.castPossess(50);
    expect(result).toBe(true);
    expect(spellSystem.isPossessing).toBe(true);
    expect(spellSystem.possessedEntityId).toBe(50);
    expect(creature._aiSuspended).toBe(true);
  });

  it('should not possess enemy entities', () => {
    creature.team = 'enemy';
    const result = spellSystem.castPossess(50);
    expect(result).toBe(false);
  });

  it('should fail when mana insufficient', () => {
    resourceManager.mana = 0;
    const result = spellSystem.castPossess(50);
    expect(result).toBe(false);
  });

  it('should unpossess and restore AI', () => {
    spellSystem.castPossess(50);
    spellSystem.unpossess();
    expect(spellSystem.isPossessing).toBe(false);
    expect(creature._aiSuspended).toBe(false);
  });

  it('should publish POSSESS_START with entityType and POSSESS_END events', () => {
    spellSystem.castPossess(50);
    expect(eventBus.publish).toHaveBeenCalledWith(EVENTS.POSSESS_START, { entityId: 50, entityType: 'troll' });
    spellSystem.unpossess();
    expect(eventBus.publish).toHaveBeenCalledWith(EVENTS.POSSESS_END, { entityId: 50, reason: 'manual' });
  });

  it('should auto-unpossess with reason=death if creature dies during update', () => {
    spellSystem.castPossess(50);
    creature.alive = false;
    spellSystem.update(0.1);
    expect(spellSystem.isPossessing).toBe(false);
    expect(eventBus.publish).toHaveBeenCalledWith(EVENTS.POSSESS_END, { entityId: 50, reason: 'death' });
  });
});

describe('movePossessed', () => {
  let creature;

  beforeEach(() => {
    creature = {
      id: 50, type: 'troll', team: 'player', alive: true,
      x: 40 * TILE_SIZE + 16, y: 30 * TILE_SIZE + 16,
      _aiSuspended: false, _facingRight: true, _attackTimer: 0,
      attackRange: 1.2, attackCooldown: 1.0, damage: 15,
      getEffectiveSpeed: () => 80,
    };
    entityManager.add(creature);
    spellSystem.castPossess(50);
  });

  it('should move possessed creature when tile is walkable', () => {
    world.isWalkable = vi.fn(() => true);
    const prevX = creature.x;
    spellSystem.movePossessed(1, 0, 0.1);
    expect(creature.x).toBeGreaterThan(prevX);
  });

  it('should not move when target tile is not walkable', () => {
    world.isWalkable = vi.fn(() => false);
    const prevX = creature.x;
    spellSystem.movePossessed(1, 0, 0.1);
    expect(creature.x).toBe(prevX);
  });
});

describe('possessedAttack', () => {
  let creature, enemy;

  beforeEach(() => {
    creature = {
      id: 50, type: 'troll', team: 'player', alive: true,
      x: 100, y: 100, _aiSuspended: false, _facingRight: true,
      _attackTimer: 0, attackRange: 1.2, attackCooldown: 1.0, damage: 15,
      getEffectiveSpeed: () => 40,
    };
    enemy = {
      id: 60, type: 'knight', team: 'enemy', alive: true,
      x: 130, y: 100, health: 150, maxHealth: 150, goldDrop: 50,
      takeDamage: vi.fn(function(d) { this.health -= d; }),
      isDead: vi.fn(function() { return this.health <= 0; }),
    };
    entityManager.add(creature);
    entityManager.add(enemy);
    spellSystem.castPossess(50);
  });

  it('should attack nearest enemy in range', () => {
    spellSystem.possessedAttack();
    expect(enemy.takeDamage).toHaveBeenCalledWith(15);
    expect(creature._attackTimer).toBe(1.0);
  });

  it('should not attack when on cooldown', () => {
    creature._attackTimer = 0.5;
    spellSystem.possessedAttack();
    expect(enemy.takeDamage).not.toHaveBeenCalled();
  });

  it('should not attack when no enemies in range', () => {
    enemy.x = 10000; // Far away
    spellSystem.possessedAttack();
    expect(enemy.takeDamage).not.toHaveBeenCalled();
  });

  it('should kill enemy when HP reaches 0', () => {
    enemy.health = 10;
    spellSystem.possessedAttack();
    expect(enemy.alive).toBe(false);
    expect(eventBus.publish).toHaveBeenCalledWith(EVENTS.ENTITY_DIED, expect.objectContaining({
      entityId: 60,
    }));
  });
});
```

- [ ] **Step 2: Modify Creature.js to respect `_aiSuspended`**

In `src/entities/Creature.js`, add at the top of `update(dt)`:

```js
update(dt) {
  if (this._aiSuspended) return;
  // ... rest of existing code
```

- [ ] **Step 3: Run tests to verify they pass**

Run: `npx vitest run tests/systems/SpellSystem.test.js`
Expected: PASS (18 tests)

- [ ] **Step 4: Commit**

```bash
git add src/systems/SpellSystem.js src/entities/Creature.js tests/systems/SpellSystem.test.js
git commit -m "feat(phase5): add Possess Creature spell + _aiSuspended guard"
```

---

### Task 4: Door Entity

**Files:**
- Replace: `src/entities/Door.js`
- Test: `tests/entities/Door.test.js`

- [ ] **Step 1: Write failing Door tests**

```js
// tests/entities/Door.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Door } from '../../src/entities/Door.js';
import { ENTITY_TYPES, DOOR_HP, DOOR_COST, TILE_SIZE, TILE_TYPES } from '../../src/constants.js';

function makeWorld() {
  const tiles = {};
  return {
    width: 80, height: 60,
    getTile: vi.fn((x, y) => tiles[`${x},${y}`] || TILE_TYPES.ROCK),
    setTile: vi.fn(),
    isWalkable: vi.fn((x, y) => {
      const t = tiles[`${x},${y}`];
      return t === TILE_TYPES.CLAIMED_FLOOR || t === TILE_TYPES.UNCLAIMED_FLOOR;
    }),
    getNeighbors: vi.fn((x, y) => {
      const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];
      return dirs.map(([dx, dy]) => ({
        x: x + dx, y: y + dy,
        type: tiles[`${x + dx},${y + dy}`] || TILE_TYPES.ROCK,
      }));
    }),
    _tiles: tiles,
  };
}

describe('Door', () => {
  it('should have correct type and HP', () => {
    const door = new Door(5, 5);
    expect(door.type).toBe(ENTITY_TYPES.DOOR);
    expect(door.health).toBe(DOOR_HP);
    expect(door.maxHealth).toBe(DOOR_HP);
    expect(door.team).toBe('player');
  });

  it('should have world position centered on tile', () => {
    const door = new Door(5, 5);
    expect(door.x).toBe(5 * TILE_SIZE + TILE_SIZE / 2);
    expect(door.y).toBe(5 * TILE_SIZE + TILE_SIZE / 2);
  });

  it('should store tile coordinates', () => {
    const door = new Door(10, 15);
    expect(door.tileX).toBe(10);
    expect(door.tileY).toBe(15);
  });

  it('should take damage and die', () => {
    const door = new Door(5, 5);
    door.takeDamage(100);
    expect(door.health).toBe(DOOR_HP - 100);
    expect(door.isDead()).toBe(false);
    door.takeDamage(DOOR_HP);
    expect(door.isDead()).toBe(true);
  });

  describe('isValidDoorPlacement', () => {
    it('should return true for horizontal corridor (walkable left+right, wall above+below)', () => {
      const world = makeWorld();
      world._tiles['4,5'] = TILE_TYPES.CLAIMED_FLOOR;
      world._tiles['6,5'] = TILE_TYPES.CLAIMED_FLOOR;
      world._tiles['5,5'] = TILE_TYPES.CLAIMED_FLOOR;
      // 5,4 and 5,6 are ROCK (default)
      expect(Door.isValidDoorPlacement(world, 5, 5)).toBe(true);
    });

    it('should return true for vertical corridor (walkable above+below, wall left+right)', () => {
      const world = makeWorld();
      world._tiles['5,4'] = TILE_TYPES.CLAIMED_FLOOR;
      world._tiles['5,6'] = TILE_TYPES.CLAIMED_FLOOR;
      world._tiles['5,5'] = TILE_TYPES.CLAIMED_FLOOR;
      // 4,5 and 6,5 are ROCK (default)
      expect(Door.isValidDoorPlacement(world, 5, 5)).toBe(true);
    });

    it('should return false for open area (3+ walkable neighbors)', () => {
      const world = makeWorld();
      world._tiles['4,5'] = TILE_TYPES.CLAIMED_FLOOR;
      world._tiles['6,5'] = TILE_TYPES.CLAIMED_FLOOR;
      world._tiles['5,4'] = TILE_TYPES.CLAIMED_FLOOR;
      world._tiles['5,5'] = TILE_TYPES.CLAIMED_FLOOR;
      expect(Door.isValidDoorPlacement(world, 5, 5)).toBe(false);
    });

    it('should return false for dead end (only 1 walkable neighbor)', () => {
      const world = makeWorld();
      world._tiles['4,5'] = TILE_TYPES.CLAIMED_FLOOR;
      world._tiles['5,5'] = TILE_TYPES.CLAIMED_FLOOR;
      expect(Door.isValidDoorPlacement(world, 5, 5)).toBe(false);
    });

    it('should require opposing walkable neighbors (not adjacent corners)', () => {
      const world = makeWorld();
      // Two walkable neighbors but not opposing (left + up instead of left + right)
      world._tiles['4,5'] = TILE_TYPES.CLAIMED_FLOOR;
      world._tiles['5,4'] = TILE_TYPES.CLAIMED_FLOOR;
      world._tiles['5,5'] = TILE_TYPES.CLAIMED_FLOOR;
      expect(Door.isValidDoorPlacement(world, 5, 5)).toBe(false);
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/entities/Door.test.js`
Expected: FAIL — Door is a stub

- [ ] **Step 3: Implement Door entity**

```js
// src/entities/Door.js
import { Entity } from './Entity.js';
import { ENTITY_TYPES, DOOR_HP, TILE_SIZE } from '../constants.js';

/**
 * Door entity placed on corridor tiles.
 * Heroes must attack through; player creatures pass freely.
 * HP-based — destroyed when HP reaches 0.
 */
export class Door extends Entity {
  /**
   * @param {number} tileX - Tile X coordinate.
   * @param {number} tileY - Tile Y coordinate.
   * @param {import('../entities/EntityManager.js').EntityManager} [entityManager=null]
   */
  constructor(tileX, tileY, entityManager = null) {
    const px = tileX * TILE_SIZE + TILE_SIZE / 2;
    const py = tileY * TILE_SIZE + TILE_SIZE / 2;
    super(ENTITY_TYPES.DOOR, px, py);
    this.team = 'player';
    this.health = DOOR_HP;
    this.maxHealth = DOOR_HP;
    this.tileX = tileX;
    this.tileY = tileY;
    this._entityManager = entityManager;
    /** @type {boolean} Visual state: true when friendly creature is nearby. */
    this._isOpen = false;
  }

  /**
   * Validate that a tile is a valid corridor for door placement.
   * Must have exactly 2 opposing walkable neighbors (horizontal or vertical corridor).
   * @param {import('../world/World.js').World} world
   * @param {number} tx
   * @param {number} ty
   * @returns {boolean}
   */
  static isValidDoorPlacement(world, tx, ty) {
    if (!world.isWalkable(tx, ty)) return false;

    const left = world.isWalkable(tx - 1, ty);
    const right = world.isWalkable(tx + 1, ty);
    const up = world.isWalkable(tx, ty - 1);
    const down = world.isWalkable(tx, ty + 1);

    const horizontal = left && right && !up && !down;
    const vertical = up && down && !left && !right;

    return horizontal || vertical;
  }

  update(_dt) {
    // Check if a friendly creature is within 1.5 tiles to animate open/close
    if (this._entityManager) {
      const nearby = this._entityManager.getEntitiesInRadius(this.x, this.y, TILE_SIZE * 1.5);
      this._isOpen = nearby.some(e => e.team === 'player' && e.type !== ENTITY_TYPES.DOOR && e.alive);
    }
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/entities/Door.test.js`
Expected: PASS (8 tests)

- [ ] **Step 5: Commit**

```bash
git add src/entities/Door.js tests/entities/Door.test.js
git commit -m "feat(phase5): implement Door entity with corridor validation"
```

---

### Task 5: Camera Lock for Possess Mode

**Files:**
- Modify: `src/rendering/Camera.js`
- Modify: `tests/rendering/Camera.test.js`

- [ ] **Step 1: Add Camera lock tests**

Add to `tests/rendering/Camera.test.js`:

```js
describe('Camera lock/unlock', () => {
  it('lockTo should save position and center on entity', () => {
    const cam = new Camera(800, 600);
    const entity = { x: 200, y: 300 };
    cam.lockTo(entity);
    expect(cam.isLocked).toBe(true);
    expect(cam.x).toBe(200);
    expect(cam.y).toBe(300);
  });

  it('updateLock should track entity position', () => {
    const cam = new Camera(800, 600);
    const entity = { x: 200, y: 300 };
    cam.lockTo(entity);
    entity.x = 500;
    entity.y = 400;
    cam.updateLock();
    expect(cam.x).toBe(500);
    expect(cam.y).toBe(400);
  });

  it('unlock should restore saved position', () => {
    const cam = new Camera(800, 600);
    const prevX = cam.x;
    const prevY = cam.y;
    cam.lockTo({ x: 200, y: 300 });
    cam.unlock();
    expect(cam.isLocked).toBe(false);
    expect(cam.x).toBe(prevX);
    expect(cam.y).toBe(prevY);
  });
});
```

- [ ] **Step 2: Implement Camera lock/unlock**

Add to `src/rendering/Camera.js`:

```js
// Add to Camera class:

/** @type {boolean} */
get isLocked() { return this._lockedEntity !== null; }

/**
 * Lock camera to an entity. Saves current position for restore.
 * @param {{x: number, y: number}} entity
 */
lockTo(entity) {
  if (!this._lockedEntity) {
    this._savedX = this.x;
    this._savedY = this.y;
  }
  this._lockedEntity = entity;
  this.x = entity.x;
  this.y = entity.y;
}

/** Update position to track locked entity. */
updateLock() {
  if (this._lockedEntity) {
    this.x = this._lockedEntity.x;
    this.y = this._lockedEntity.y;
  }
}

/** Unlock camera and restore saved position. */
unlock() {
  if (this._lockedEntity) {
    this.x = this._savedX;
    this.y = this._savedY;
    this._lockedEntity = null;
  }
}
```

Add to constructor:
```js
this._lockedEntity = null;
this._savedX = 0;
this._savedY = 0;
```

- [ ] **Step 3: Run tests to verify they pass**

Run: `npx vitest run tests/rendering/Camera.test.js`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/rendering/Camera.js tests/rendering/Camera.test.js
git commit -m "feat(phase5): add Camera lockTo/unlock for possess mode"
```

---

### Task 6: Enable Toolbar Buttons for Spells & Door

**Files:**
- Modify: `src/ui/Toolbar.js`

- [ ] **Step 1: Move spell/door tools from `disabledTools` to `tools` array**

In `src/ui/Toolbar.js`, replace the two arrays:

```js
const tools = [
  { id: 'dig', label: 'Dig', hotkey: '1' },
  { id: `room:${ROOM_TYPES.LAIR}`, label: 'Lair', hotkey: '2', cost: `${ROOM_CONFIG[ROOM_TYPES.LAIR].goldPerTile}g` },
  { id: `room:${ROOM_TYPES.HATCHERY}`, label: 'Hatchery', hotkey: '3', cost: `${ROOM_CONFIG[ROOM_TYPES.HATCHERY].goldPerTile}g` },
  { id: `room:${ROOM_TYPES.TREASURY}`, label: 'Treasury', hotkey: '4', cost: `${ROOM_CONFIG[ROOM_TYPES.TREASURY].goldPerTile}g` },
  { id: `room:${ROOM_TYPES.TRAINING_ROOM}`, label: 'Training', hotkey: '5', cost: `${ROOM_CONFIG[ROOM_TYPES.TRAINING_ROOM].goldPerTile}g` },
];

const div = document.createElement('div');
div.className = 'toolbar-divider';

const spellDoorTools = [
  { id: 'spell:create_imp', label: 'Imp', hotkey: '6', cost: '200m' },
  { id: 'spell:lightning', label: 'Lightning', hotkey: '7', cost: '150m' },
  { id: 'spell:possess', label: 'Possess', hotkey: '8', cost: '100m' },
  { id: 'door', label: 'Door', hotkey: '9', cost: '100g' },
];
```

Change the build loop so `spellDoorTools` use `this._createButton(t, false)` instead of `true`.

Also remove the `disabled` check in `_bindKeys`:

```js
// In _bindKeys, change the guard:
if (tool) {
  this._selectTool(tool);
}
```

- [ ] **Step 2: Run full test suite to ensure no regressions**

Run: `npx vitest run`
Expected: All tests pass

- [ ] **Step 3: Commit**

```bash
git add src/ui/Toolbar.js
git commit -m "feat(phase5): enable spell and door toolbar buttons"
```

---

### Task 7: HUD Possess Overlay

**Files:**
- Modify: `src/ui/HUD.js`

- [ ] **Step 1: Add possess overlay to HUD**

Add to `_build()` in HUD.js, after the hud-bar creation:

```js
// Possess overlay
this._possessOverlay = document.createElement('div');
this._possessOverlay.id = 'possess-overlay';
this._possessOverlay.style.cssText = `
  position: fixed; top: 0; left: 0; width: 100%; height: 100%;
  pointer-events: none; display: none; z-index: 150;
`;
this._possessOverlay.innerHTML = `
  <div style="position:absolute;top:0;left:0;width:100%;height:100%;
    box-shadow:inset 0 0 100px rgba(200,0,0,0.4);pointer-events:none;"></div>
  <div id="possess-label" style="position:absolute;top:60px;left:50%;transform:translateX(-50%);
    font-family:'MedievalSharp',cursive;font-size:20px;color:#ff6060;
    text-shadow:0 0 10px rgba(200,0,0,0.8);pointer-events:none;">
    POSSESSING
  </div>
  <div style="position:absolute;bottom:80px;left:50%;transform:translateX(-50%);
    font-family:'Inter',sans-serif;font-size:12px;color:#c08080;pointer-events:none;">
    WASD: Move | Click: Attack | ESC: Release
  </div>
`;
container.appendChild(this._possessOverlay);
this._possessLabel = this._possessOverlay.querySelector('#possess-label');
```

Add to `_subscribe()`:

```js
this._eventBus.subscribe(EVENTS.POSSESS_START, (data) => {
  this._possessOverlay.style.display = 'block';
  const name = (data.entityType || 'creature').replace(/_/g, ' ').toUpperCase();
  this._possessLabel.textContent = `POSSESSING ${name}`;
});

this._eventBus.subscribe(EVENTS.POSSESS_END, () => {
  this._possessOverlay.style.display = 'none';
});
```

- [ ] **Step 2: Run full test suite**

Run: `npx vitest run`
Expected: All tests pass

- [ ] **Step 3: Commit**

```bash
git add src/ui/HUD.js
git commit -m "feat(phase5): add possess mode HUD overlay with red vignette"
```

---

### Task 8: Door Rendering in EntityRenderer

**Files:**
- Modify: `src/rendering/EntityRenderer.js`

- [ ] **Step 1: Add Door case to render switch and `_drawDoor` method**

In `render()` method, add case after WIZARD:

```js
case ENTITY_TYPES.DOOR:
  this._drawDoor(ctx, sx, sy, zoom, entity);
  break;
```

Add `_drawDoor` method:

```js
/** @private Door: wooden door with planks, animates open for nearby friendlies */
_drawDoor(ctx, sx, sy, zoom, entity) {
  const size = TILE_SIZE * zoom;
  const halfSize = size / 2;
  const isOpen = entity._isOpen || false;

  ctx.save();
  ctx.translate(sx, sy);

  // Door frame (dark stone)
  ctx.fillStyle = '#4a4040';
  ctx.fillRect(-halfSize * 0.9, -halfSize * 0.9, size * 0.9, size * 0.9);

  if (isOpen) {
    // Open door: thin sliver on side
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = '#6a4a2a';
    ctx.fillRect(-halfSize * 0.8, -halfSize * 0.8, size * 0.15, size * 0.8);
    ctx.globalAlpha = 1;
  } else {
    // Closed door: full planks
    ctx.fillStyle = '#6a4a2a';
    ctx.fillRect(-halfSize * 0.7, -halfSize * 0.8, size * 0.7, size * 0.8);

    // Horizontal bands (iron)
    ctx.fillStyle = '#555';
    const bandH = 2 * zoom;
    ctx.fillRect(-halfSize * 0.7, -halfSize * 0.5, size * 0.7, bandH);
    ctx.fillRect(-halfSize * 0.7, -halfSize * 0.1, size * 0.7, bandH);
    ctx.fillRect(-halfSize * 0.7, halfSize * 0.3, size * 0.7, bandH);

    // Handle
    ctx.fillStyle = '#888';
    ctx.beginPath();
    ctx.arc(halfSize * 0.2, 0, 2 * zoom, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();

  // Health bar when damaged
  if (entity.health < entity.maxHealth) {
    this._drawHealthBar(ctx, sx, sy, size * 0.8, entity);
  }
}
```

- [ ] **Step 2: Run full test suite**

Run: `npx vitest run`
Expected: All tests pass

- [ ] **Step 3: Commit**

```bash
git add src/rendering/EntityRenderer.js
git commit -m "feat(phase5): add Door sprite to EntityRenderer"
```

---

### Task 9: Hero Door Interaction (CombatSystem + Hero)

**Files:**
- Modify: `src/systems/CombatSystem.js`
- Modify: `src/entities/Hero.js`

Heroes must stop at doors and attack them. The CombatSystem already handles damage between opposing teams, and Door has team='player', so heroes (team='enemy') will naturally target doors via the existing `_findTargets` logic. However, we need heroes to stop movement when adjacent to a door.

- [ ] **Step 1: Modify Hero._followPath to check for doors**

In `src/entities/Hero.js`, add `_checkForDoor` method and modify `_followPath`:

```js
// Add to constructor:
this._attackingDoor = null;

// Add method:
_checkForDoor() {
  if (!this._entityManager) return null;
  for (const e of this._entityManager.getAll()) {
    if (e.type !== 'door' || !e.alive) continue;
    const dx = Math.abs(e.x - this.x);
    const dy = Math.abs(e.y - this.y);
    if (dx < TILE_SIZE * 1.2 && dy < TILE_SIZE * 1.2) {
      return e;
    }
  }
  return null;
}
```

In `update(dt)`, add door check before _followPath:

```js
update(dt) {
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
    return; // Stop moving, CombatSystem will handle damage
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

- [ ] **Step 2: Add door interaction constants — Hero attacks door at HERO_DOOR_DAMAGE_PER_SEC**

The CombatSystem already handles this since Door has `team='player'` and heroes have `team='enemy'`. The existing _findTargets includes doors. Hero's attackCooldown and damage will be used. No additional CombatSystem changes are needed — the existing code naturally handles hero-vs-door combat.

- [ ] **Step 3: Run full test suite**

Run: `npx vitest run`
Expected: All tests pass

- [ ] **Step 4: Commit**

```bash
git add src/entities/Hero.js
git commit -m "feat(phase5): heroes stop and attack doors blocking their path"
```

---

### Task 10: Creature Door Passthrough (Pathfinder)

**Files:**
- Modify: `src/world/Pathfinder.js` (or handle via World.isWalkable)

Player creatures must pass through doors freely. Since doors are placed on walkable tiles, the tile is already walkable. Creatures (team='player') already path through walkable tiles. The Door entity doesn't block tile walkability — it only acts as a combat target for heroes.

For heroes to be blocked by doors: we already handle this in Hero.update() (Task 9) where heroes check for nearby doors and stop to attack. The pathfinder itself doesn't need modification — the tile under a door remains walkable for pathfinding. Heroes are blocked at the behavior level, not the pathfinding level.

- [ ] **Step 1: Verify this works with a test**

Add to `tests/entities/Door.test.js`:

```js
describe('Door walkability', () => {
  it('door tile remains walkable (creatures path through)', () => {
    const world = makeWorld();
    world._tiles['5,5'] = TILE_TYPES.CLAIMED_FLOOR;
    const door = new Door(5, 5);
    // Tile under door is still walkable
    expect(world.isWalkable(5, 5)).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests**

Run: `npx vitest run tests/entities/Door.test.js`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add tests/entities/Door.test.js
git commit -m "test(phase5): verify door tiles remain walkable for creature pathfinding"
```

---

### Task 11: main.js Integration — SpellSystem, Door Placement, Possess Mode

**Files:**
- Modify: `src/main.js`

This is the largest integration task. Wire everything together:

- [ ] **Step 1: Add imports and instantiate SpellSystem**

Add import at top:
```js
import { SpellSystem } from './systems/SpellSystem.js';
import { Door } from './entities/Door.js';
```

After Phase 4 systems initialization, add:
```js
const spellSystem = new SpellSystem(world, entityManager, eventBus, resourceManager, roomManager, jobQueue);
```

- [ ] **Step 2: Wire spell/door click handling in INPUT_CLICK subscriber**

Modify the `EVENTS.INPUT_CLICK` handler to handle spell/door tools:

```js
// In the INPUT_CLICK handler, add before the dig mode section:
if (activeTool === 'spell:create_imp') {
  spellSystem.castCreateImp();
  return;
}

if (activeTool === 'spell:lightning') {
  if (spellSystem.isPossessing) return;
  spellSystem.castLightningStrike(e.worldX, e.worldY);
  return;
}

if (activeTool === 'spell:possess') {
  // Find player creature at click location
  const entities = entityManager.getEntitiesInRadius(e.worldX, e.worldY, TILE_SIZE / 2);
  const creature = entities.find(ent => ent.team === 'player' && ent.type !== ENTITY_TYPES.IMP && ent.type !== ENTITY_TYPES.DOOR);
  if (creature) {
    spellSystem.castPossess(creature.id);
    camera.lockTo(creature);
  }
  return;
}

if (activeTool === 'door') {
  if (Door.isValidDoorPlacement(world, e.tileX, e.tileY)) {
    // Check no existing door at this tile
    const existing = entityManager.getAll().find(ent =>
      ent.type === ENTITY_TYPES.DOOR && ent.tileX === e.tileX && ent.tileY === e.tileY
    );
    if (!existing && resourceManager.spendGold(DOOR_COST)) {
      const door = new Door(e.tileX, e.tileY, entityManager);
      entityManager.add(door);
      Pathfinder.clearCache();
    }
  }
  return;
}
```

- [ ] **Step 3: Add `isKeyDown(code)` public method to InputManager**

In `src/input/InputManager.js`, add:
```js
/** @param {string} code - Key code (e.g., 'KeyW'). */
isKeyDown(code) { return this._keysDown.has(code); }
```

- [ ] **Step 4: Wire possess mode input (WASD movement + click attack + ESC exit)**

Add possess mode handling to the key handler and click handler:

```js
// Modify EVENTS.INPUT_KEY_DOWN handler:
// At the start, add possess mode ESC check:
if (e.code === 'Escape' && spellSystem.isPossessing) {
  spellSystem.unpossess();
  camera.unlock();
  return; // Don't process other escape logic
}

// In EVENTS.INPUT_CLICK, at the very top:
if (spellSystem.isPossessing) {
  spellSystem.possessedAttack();
  return;
}
```

In the `update(dt)` function, add possess mode WASD handling and spellSystem update:

```js
function update(dt) {
  // Possess mode movement (uses public isKeyDown method)
  if (spellSystem.isPossessing) {
    let dx = 0, dy = 0;
    if (inputManager.isKeyDown('KeyW') || inputManager.isKeyDown('ArrowUp')) dy = -1;
    if (inputManager.isKeyDown('KeyS') || inputManager.isKeyDown('ArrowDown')) dy = 1;
    if (inputManager.isKeyDown('KeyA') || inputManager.isKeyDown('ArrowLeft')) dx = -1;
    if (inputManager.isKeyDown('KeyD') || inputManager.isKeyDown('ArrowRight')) dx = 1;
    if (dx !== 0 || dy !== 0) {
      spellSystem.movePossessed(dx, dy, dt);
    }
    // Don't process normal camera pan while possessing
  } else {
    inputManager.update(dt);
  }

  entityManager.update(dt);
  particleSystem.update(dt);
  resourceManager.update(dt);
  combatSystem.update(dt);
  creatureSpawner.update(dt);
  waveManager.update(dt);
  floatingText.update(dt);
  spellSystem.update(dt);
}
```

- [ ] **Step 5: Wire possess mode camera tracking in render**

In the `render(alpha)` function, add camera lock tracking:

```js
// At the start of render, before tileRenderer.render:
if (camera.isLocked) {
  camera.updateLock();
  camera.clampToWorld();
}
```

- [ ] **Step 6: Wire Lightning Strike visual effects + magic circle animation**

Add to event handlers in main.js:

```js
let screenShakeTimer = 0;
let screenShakeMagnitude = 0;
let lightningFlashTimer = 0;
let possessDeathFlashTimer = 0;

eventBus.subscribe(EVENTS.SPELL_CAST, (e) => {
  if (e.spell === SPELL_TYPES.LIGHTNING_STRIKE) {
    screenShakeTimer = SPELL_CONFIG[SPELL_TYPES.LIGHTNING_STRIKE].shakeDuration;
    screenShakeMagnitude = SPELL_CONFIG[SPELL_TYPES.LIGHTNING_STRIKE].shakeMagnitude;
    lightningFlashTimer = 0.1;
    particleSystem.burst(e.x, e.y, '#ffffff', 20, { speed: 120, life: 0.5, size: 3 });
    particleSystem.burst(e.x, e.y, '#ffff80', 15, { speed: 80, life: 0.4, size: 2 });
  }
  if (e.spell === SPELL_TYPES.CREATE_IMP) {
    particleSystem.burst(e.x, e.y, '#8060ff', 12, { speed: 40, life: 0.5, size: 3 });
  }
});

// Possess death: camera shake + red flash
eventBus.subscribe(EVENTS.POSSESS_END, (e) => {
  if (e.reason === 'death') {
    screenShakeTimer = 0.5;
    screenShakeMagnitude = 6;
    possessDeathFlashTimer = 0.5;
  }
  camera.unlock();
});

// Door debris on destruction
eventBus.subscribe(EVENTS.ENTITY_DIED, (e) => {
  if (e.type === ENTITY_TYPES.DOOR) {
    particleSystem.burst(e.x, e.y, '#6a4a2a', 15, { speed: 80, life: 0.6, size: 3 });
    particleSystem.burst(e.x, e.y, '#4a3a1a', 10, { speed: 60, life: 0.4, size: 2 });
  }
});
```

In render, add screen shake, lightning flash, possess death red flash, and magic circle:

```js
// Screen shake (apply before all rendering)
if (screenShakeTimer > 0) {
  screenShakeTimer -= renderDt;
  const shakeX = (Math.random() - 0.5) * screenShakeMagnitude * 2;
  const shakeY = (Math.random() - 0.5) * screenShakeMagnitude * 2;
  ctx.save();
  ctx.translate(shakeX, shakeY);
}

// ... existing render code ...

// Create Imp magic circle animation (drawn on canvas at cast position)
const castAnim = spellSystem.getCastAnimState();
if (castAnim.timer > 0 && castAnim.position) {
  const [cx, cy] = camera.worldToScreen(castAnim.position.x, castAnim.position.y);
  const radius = TILE_SIZE * camera.zoom * 1.5;
  const progress = 1 - (castAnim.timer / SPELL_CONFIG[SPELL_TYPES.CREATE_IMP].castTime);
  ctx.save();
  ctx.globalAlpha = 1 - progress;
  ctx.strokeStyle = '#8060ff';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, cy, radius * progress, 0, Math.PI * 2);
  ctx.stroke();
  // Inner rotating ring
  ctx.beginPath();
  ctx.arc(cx, cy, radius * 0.6 * progress, progress * Math.PI * 4, progress * Math.PI * 4 + Math.PI * 1.5);
  ctx.stroke();
  ctx.restore();
}

// Red cursor feedback for Lightning targeting friendlies
if (activeTool === 'spell:lightning' && hoverTileX >= 0 && hoverTileY >= 0) {
  const hoverWX = hoverTileX * TILE_SIZE + TILE_SIZE / 2;
  const hoverWY = hoverTileY * TILE_SIZE + TILE_SIZE / 2;
  const nearbyEnts = entityManager.getEntitiesInRadius(hoverWX, hoverWY, TILE_SIZE);
  const onlyFriendly = nearbyEnts.length > 0 && nearbyEnts.every(e => e.team === 'player');
  if (onlyFriendly) {
    const [hsx, hsy] = camera.worldToScreen(hoverTileX * TILE_SIZE, hoverTileY * TILE_SIZE);
    const sz = TILE_SIZE * camera.zoom;
    ctx.fillStyle = 'rgba(200, 40, 40, 0.3)';
    ctx.fillRect(hsx, hsy, sz, sz);
    ctx.strokeStyle = 'rgba(200, 40, 40, 0.6)';
    ctx.lineWidth = 2;
    // Draw X
    ctx.beginPath();
    ctx.moveTo(hsx + sz * 0.2, hsy + sz * 0.2);
    ctx.lineTo(hsx + sz * 0.8, hsy + sz * 0.8);
    ctx.moveTo(hsx + sz * 0.8, hsy + sz * 0.2);
    ctx.lineTo(hsx + sz * 0.2, hsy + sz * 0.8);
    ctx.stroke();
  }
}

// End screen shake
if (screenShakeTimer > 0 || screenShakeTimer + renderDt > 0) {
  ctx.restore();
}

// Lightning flash overlay (white)
if (lightningFlashTimer > 0) {
  lightningFlashTimer -= renderDt;
  ctx.fillStyle = `rgba(255, 255, 255, ${Math.min(1, lightningFlashTimer / 0.1) * 0.5})`;
  ctx.fillRect(0, 0, w, h);
}

// Possess death flash overlay (red)
if (possessDeathFlashTimer > 0) {
  possessDeathFlashTimer -= renderDt;
  ctx.fillStyle = `rgba(255, 0, 0, ${Math.min(1, possessDeathFlashTimer / 0.5) * 0.4})`;
  ctx.fillRect(0, 0, w, h);
}
```

- [ ] **Step 7: Add SPELL_TYPES and SPELL_CONFIG imports to main.js**

Add to the existing constants import:
```js
import {
  COLORS, EVENTS, TILE_SIZE, TILE_TYPES, ROOM_TYPES,
  ROOM_CONFIG, RESOURCES, ENTITY_TYPES,
  SPELL_TYPES, SPELL_CONFIG, DOOR_COST,
} from './constants.js';
```

- [ ] **Step 8: Run full test suite**

Run: `npx vitest run`
Expected: All 172+ tests pass (no regressions)

- [ ] **Step 9: Commit**

```bash
git add src/main.js src/input/InputManager.js
git commit -m "feat(phase5): integrate SpellSystem, Door placement, possess mode, and spell VFX into main.js"
```

---

### Task 12: Full Verification

- [ ] **Step 1: Run full test suite**

Run: `npx vitest run`
Expected: All tests pass (baseline 172 + new SpellSystem + Door tests)

- [ ] **Step 2: Verify dev server starts**

Run: `npx vite --open`
Expected: Game loads, toolbar shows enabled spell/door buttons

- [ ] **Step 3: Verify Phase 5 checklist items**

From the Master Build Plan, verify each item:
- [ ] Create Imp costs mana, spawns Imp, shows cast animation
- [ ] Lightning Strike AoE damages all entities in 3×3
- [ ] Lightning Strike cannot target own creatures
- [ ] Screen shake fires on Lightning Strike
- [ ] Possess mode: WASD moves creature, camera follows
- [ ] Possess mode: left-click attacks enemies
- [ ] ESC exits possession correctly
- [ ] Door placement only valid on corridor tiles
- [ ] Heroes stop at door and break it (check HP bar decrements)
- [ ] Own creatures pass door without stopping

- [ ] **Step 4: Commit verification notes**

```bash
git add -A
git commit -m "feat(phase5): Phase 5 — Spells & Doors complete"
```
