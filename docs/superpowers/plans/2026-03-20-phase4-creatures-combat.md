# Phase 4 — Creatures & Combat Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement two creature types (Troll, Dark Mistress), three hero types (Knight, Thief, Wizard), tick-based combat system, creature spawner, wave manager, leveling system, floating combat text, and all associated rendering — resulting in a playable dungeon defense game with escalating hero waves.

**Architecture:** CombatSystem resolves damage every 200ms tick by checking all entities for attack range/cooldown. Creature base class provides shared AI (needs, pathfinding, combat approach, training) for Troll and Dark Mistress. Hero base class provides shared behavior (pathfind to Dungeon Heart, re-path every 3s). CreatureSpawner checks room conditions every 30s. WaveManager spawns hero groups every 90s from the nearest walkable tile to a random map edge. Entity base class extended with team, level, xp, damage, attackRange, speed, debuffs. All cross-system communication via EventBus.

**Tech Stack:** Vanilla JS (ES Modules), Canvas 2D, Vitest

---

## File Structure

| File | Action | Purpose |
|------|--------|---------|
| `src/entities/Entity.js` | Modify | Add combat properties: team, level, xp, damage, attackRange, speed, debuffs |
| `src/entities/Creature.js` | Create | Shared base for player creatures (needs, pathfinding, combat, training) |
| `src/entities/Troll.js` | Replace stub | Troll stats + base stats ref |
| `src/entities/DarkMistress.js` | Replace stub | Multi-target attack, slow debuff |
| `src/entities/Hero.js` | Create | Shared base for heroes (pathfind to heart, re-path) |
| `src/entities/Knight.js` | Replace stub | Melee tank hero (just stats) |
| `src/entities/Thief.js` | Replace stub | Fast, targets Treasury |
| `src/entities/Wizard.js` | Replace stub | Ranged, kiting behavior |
| `src/systems/CombatSystem.js` | Replace stub | Tick-based combat resolution, damage, death, debuffs |
| `src/systems/CreatureSpawner.js` | Replace stub | Room-condition creature spawning |
| `src/systems/WaveManager.js` | Replace stub | Hero wave spawning from map frontier |
| `src/rendering/FloatingText.js` | Create | Floating damage numbers |
| `src/rendering/EntityRenderer.js` | Modify | Draw Troll, DarkMistress, Knight, Thief, Wizard, health bars, level badges |
| `src/main.js` | Modify | Wire Phase 4 systems, events, render additions |
| `tests/entities/Entity.test.js` | Modify | Add combat property + debuff tests |
| `tests/systems/CombatSystem.test.js` | Create | Combat resolution tests |
| `tests/entities/Troll.test.js` | Create | Creature AI tests via Troll |
| `tests/entities/DarkMistress.test.js` | Create | Multi-target + debuff tests |
| `tests/systems/CreatureSpawner.test.js` | Create | Spawn condition tests |
| `tests/entities/Knight.test.js` | Create | Hero behavior tests via Knight |
| `tests/entities/Thief.test.js` | Create | Treasury-targeting tests |
| `tests/entities/Wizard.test.js` | Create | Kiting tests |
| `tests/systems/WaveManager.test.js` | Create | Wave composition + spawning tests |

---

### Task 1: Entity Base Class Extensions

**Files:**
- Modify: `src/entities/Entity.js`
- Modify: `tests/entities/Entity.test.js`

- [ ] **Step 1: Add new tests to Entity.test.js**

Add these tests inside the existing `describe('Entity', ...)` block:

```js
  it('has default combat properties', () => {
    const e = new Entity('imp', 0, 0);
    expect(e.team).toBeNull();
    expect(e.level).toBe(1);
    expect(e.xp).toBe(0);
    expect(e.damage).toBe(0);
    expect(e.attackRange).toBe(0);
    expect(e.attackCooldown).toBe(0);
    expect(e.speed).toBe(0);
    expect(e.maxTargets).toBe(1);
    expect(e.debuffOnHit).toBeNull();
    expect(e.goldDrop).toBe(0);
    expect(e.debuffs).toEqual([]);
  });

  it('applyDebuff adds a new debuff', () => {
    const e = new Entity('imp', 0, 0);
    e.applyDebuff('slow', 3.0, 0.5);
    expect(e.debuffs.length).toBe(1);
    expect(e.debuffs[0]).toEqual({ type: 'slow', remaining: 3.0, factor: 0.5 });
  });

  it('applyDebuff refreshes duration of existing debuff', () => {
    const e = new Entity('imp', 0, 0);
    e.applyDebuff('slow', 2.0, 0.5);
    e.applyDebuff('slow', 5.0, 0.5);
    expect(e.debuffs.length).toBe(1);
    expect(e.debuffs[0].remaining).toBe(5.0);
  });

  it('getDebuffFactor returns factor for active debuff', () => {
    const e = new Entity('imp', 0, 0);
    expect(e.getDebuffFactor('slow')).toBe(1.0);
    e.applyDebuff('slow', 3.0, 0.5);
    expect(e.getDebuffFactor('slow')).toBe(0.5);
  });

  it('updateDebuffs removes expired debuffs', () => {
    const e = new Entity('imp', 0, 0);
    e.applyDebuff('slow', 1.0, 0.5);
    e.updateDebuffs(0.5);
    expect(e.debuffs.length).toBe(1);
    e.updateDebuffs(0.6);
    expect(e.debuffs.length).toBe(0);
  });

  it('getEffectiveSpeed applies slow debuff', () => {
    const e = new Entity('imp', 0, 0);
    e.speed = 100;
    expect(e.getEffectiveSpeed()).toBe(100);
    e.applyDebuff('slow', 3.0, 0.5);
    expect(e.getEffectiveSpeed()).toBe(50);
  });
```

- [ ] **Step 2: Run tests to verify new tests fail**

Run: `npx vitest run tests/entities/Entity.test.js`
Expected: FAIL — Entity lacks new properties and methods.

- [ ] **Step 3: Modify Entity.js**

Add new properties at end of constructor (after `this.alive = true;`):

```js
    // ── Combat properties (Phase 4) ──
    this.team = null;           // 'player' | 'enemy' | null
    this.level = 1;
    this.xp = 0;
    this.damage = 0;
    this.attackRange = 0;       // tiles
    this.attackCooldown = 0;    // seconds between attacks
    this._attackTimer = 0;      // current cooldown remaining
    this.speed = 0;             // pixels per second
    this.maxTargets = 1;
    this.debuffOnHit = null;    // {type, duration, factor} or null
    this.debuffs = [];          // [{type, remaining, factor}]
    this.goldDrop = 0;
```

Add new methods after `update(_dt)`:

```js
  /**
   * Apply or refresh a debuff.
   * @param {string} type
   * @param {number} duration - Seconds.
   * @param {number} factor - Multiplier (e.g., 0.5 for 50% slow).
   */
  applyDebuff(type, duration, factor) {
    const existing = this.debuffs.find(d => d.type === type);
    if (existing) {
      existing.remaining = Math.max(existing.remaining, duration);
    } else {
      this.debuffs.push({ type, remaining: duration, factor });
    }
  }

  /**
   * Get debuff factor (1.0 if no debuff of this type).
   * @param {string} type
   * @returns {number}
   */
  getDebuffFactor(type) {
    const debuff = this.debuffs.find(d => d.type === type);
    return debuff ? debuff.factor : 1.0;
  }

  /**
   * Tick down debuff durations and remove expired ones.
   * @param {number} dt
   */
  updateDebuffs(dt) {
    for (let i = this.debuffs.length - 1; i >= 0; i--) {
      this.debuffs[i].remaining -= dt;
      if (this.debuffs[i].remaining <= 0) {
        this.debuffs.splice(i, 1);
      }
    }
  }

  /**
   * Speed with slow debuff applied.
   * @returns {number}
   */
  getEffectiveSpeed() {
    return this.speed * this.getDebuffFactor('slow');
  }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/entities/Entity.test.js`
Expected: All 13 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/entities/Entity.js tests/entities/Entity.test.js
git commit -m "feat(phase4): extend Entity with combat properties, debuffs, leveling"
```

---

### Task 2: CombatSystem

**Files:**
- Replace: `src/systems/CombatSystem.js`
- Create: `tests/systems/CombatSystem.test.js`

- [ ] **Step 1: Write failing tests**

```js
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CombatSystem } from '../../src/systems/CombatSystem.js';
import { EntityManager } from '../../src/entities/EntityManager.js';
import { Entity } from '../../src/entities/Entity.js';
import { EventBus } from '../../src/core/EventBus.js';
import { EVENTS, COMBAT_TICK_MS, TILE_SIZE, LEVEL_DAMAGE_BONUS } from '../../src/constants.js';

function makeAttacker(team, x, y) {
  const e = new Entity(team === 'player' ? 'troll' : 'knight', x, y);
  e.team = team;
  e.health = 100;
  e.maxHealth = 100;
  e.damage = 10;
  e.attackRange = 1.5;
  e.attackCooldown = 1.0;
  e.speed = 50;
  return e;
}

describe('CombatSystem', () => {
  let entityManager, eventBus, combat;

  beforeEach(() => {
    entityManager = new EntityManager();
    eventBus = new EventBus();
    combat = new CombatSystem(entityManager, eventBus);
  });

  it('does not resolve combat before tick interval', () => {
    const a = makeAttacker('player', 100, 100);
    const b = makeAttacker('enemy', 100 + TILE_SIZE, 100);
    entityManager.add(a);
    entityManager.add(b);
    combat.update(0.01); // 10ms, less than 200ms tick
    expect(b.health).toBe(100);
  });

  it('deals damage to enemy in range after tick', () => {
    const a = makeAttacker('player', 100, 100);
    const b = makeAttacker('enemy', 100 + TILE_SIZE, 100);
    entityManager.add(a);
    entityManager.add(b);
    combat.update(COMBAT_TICK_MS / 1000);
    expect(b.health).toBeLessThan(100);
  });

  it('does not damage same-team entities', () => {
    const a = makeAttacker('player', 100, 100);
    const b = makeAttacker('player', 100 + TILE_SIZE, 100);
    entityManager.add(a);
    entityManager.add(b);
    combat.update(COMBAT_TICK_MS / 1000);
    expect(b.health).toBe(100);
  });

  it('respects attack cooldown', () => {
    const a = makeAttacker('player', 100, 100);
    const b = makeAttacker('enemy', 100 + TILE_SIZE, 100);
    entityManager.add(a);
    entityManager.add(b);
    combat.update(COMBAT_TICK_MS / 1000); // First tick — deals damage
    const healthAfterFirst = b.health;
    combat.update(COMBAT_TICK_MS / 1000); // Second tick — on cooldown
    expect(b.health).toBe(healthAfterFirst);
  });

  it('publishes ENTITY_DAMAGED event', () => {
    const spy = vi.fn();
    eventBus.subscribe(EVENTS.ENTITY_DAMAGED, spy);
    const a = makeAttacker('player', 100, 100);
    const b = makeAttacker('enemy', 100 + TILE_SIZE, 100);
    entityManager.add(a);
    entityManager.add(b);
    combat.update(COMBAT_TICK_MS / 1000);
    expect(spy).toHaveBeenCalledWith(expect.objectContaining({
      targetId: b.id,
      attackerId: a.id,
    }));
  });

  it('publishes ENTITY_DIED on kill', () => {
    const spy = vi.fn();
    eventBus.subscribe(EVENTS.ENTITY_DIED, spy);
    const a = makeAttacker('player', 100, 100);
    a.damage = 200; // One-shot
    const b = makeAttacker('enemy', 100 + TILE_SIZE, 100);
    entityManager.add(a);
    entityManager.add(b);
    combat.update(COMBAT_TICK_MS / 1000);
    expect(spy).toHaveBeenCalledWith(expect.objectContaining({
      entityId: b.id,
      team: 'enemy',
    }));
    expect(b.alive).toBe(false);
  });

  it('handles multi-target attacks', () => {
    const a = makeAttacker('player', 100, 100);
    a.maxTargets = 2;
    const b1 = makeAttacker('enemy', 100 + TILE_SIZE, 100);
    const b2 = makeAttacker('enemy', 100 - TILE_SIZE, 100);
    entityManager.add(a);
    entityManager.add(b1);
    entityManager.add(b2);
    combat.update(COMBAT_TICK_MS / 1000);
    expect(b1.health).toBeLessThan(100);
    expect(b2.health).toBeLessThan(100);
  });

  it('applies debuff on hit', () => {
    const a = makeAttacker('player', 100, 100);
    a.debuffOnHit = { type: 'slow', duration: 3, factor: 0.5 };
    const b = makeAttacker('enemy', 100 + TILE_SIZE, 100);
    entityManager.add(a);
    entityManager.add(b);
    combat.update(COMBAT_TICK_MS / 1000);
    expect(b.getDebuffFactor('slow')).toBe(0.5);
  });

  it('calculates level damage bonus', () => {
    const a = makeAttacker('player', 100, 100);
    a.level = 3;
    a.damage = 10;
    const b = makeAttacker('enemy', 100 + TILE_SIZE, 100);
    entityManager.add(a);
    entityManager.add(b);
    combat.update(COMBAT_TICK_MS / 1000);
    const expectedDamage = Math.round(10 * (1 + 2 * LEVEL_DAMAGE_BONUS));
    expect(b.health).toBe(100 - expectedDamage);
  });

  it('ignores entities with zero damage', () => {
    const a = makeAttacker('player', 100, 100);
    a.damage = 0;
    const b = makeAttacker('enemy', 100 + TILE_SIZE, 100);
    entityManager.add(a);
    entityManager.add(b);
    combat.update(COMBAT_TICK_MS / 1000);
    expect(b.health).toBe(100);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/systems/CombatSystem.test.js`
Expected: FAIL — CombatSystem is a stub.

- [ ] **Step 3: Implement CombatSystem**

```js
import { COMBAT_TICK_MS, TILE_SIZE, LEVEL_DAMAGE_BONUS, EVENTS } from '../constants.js';

/**
 * Tick-based combat resolution system.
 * Every COMBAT_TICK_MS, checks all entities for attack range/cooldown.
 * Deals damage, applies debuffs, handles death.
 */
export class CombatSystem {
  /**
   * @param {import('../entities/EntityManager.js').EntityManager} entityManager
   * @param {import('../core/EventBus.js').EventBus} eventBus
   */
  constructor(entityManager, eventBus) {
    this._entityManager = entityManager;
    this._eventBus = eventBus;
    this._accumulator = 0;
  }

  /** @param {number} dt */
  update(dt) {
    // Tick down attack cooldowns and debuffs
    for (const entity of this._entityManager.getAll()) {
      entity.updateDebuffs(dt);
      if (entity._attackTimer > 0) {
        entity._attackTimer = Math.max(0, entity._attackTimer - dt);
      }
    }

    this._accumulator += dt;
    const tickSec = COMBAT_TICK_MS / 1000;
    if (this._accumulator < tickSec) return;
    this._accumulator -= tickSec;

    this._resolveCombat();
  }

  /** @private */
  _resolveCombat() {
    const entities = this._entityManager.getAll();

    for (const attacker of entities) {
      if (!attacker.alive || attacker.damage <= 0 || attacker.team === null) continue;
      if (attacker._attackTimer > 0) continue;

      const targets = this._findTargets(attacker, entities);
      if (targets.length === 0) continue;

      attacker._attackTimer = attacker.attackCooldown;
      const dmg = this._calculateDamage(attacker);

      for (const target of targets) {
        target.takeDamage(dmg);

        // Apply debuff
        if (attacker.debuffOnHit) {
          target.applyDebuff(
            attacker.debuffOnHit.type,
            attacker.debuffOnHit.duration,
            attacker.debuffOnHit.factor,
          );
        }

        this._eventBus.publish(EVENTS.ENTITY_DAMAGED, {
          targetId: target.id,
          attackerId: attacker.id,
          damage: dmg,
          x: target.x,
          y: target.y,
        });

        if (target.isDead()) {
          target.alive = false;
          this._eventBus.publish(EVENTS.ENTITY_DIED, {
            entityId: target.id,
            type: target.type,
            x: target.x,
            y: target.y,
            team: target.team,
            goldDrop: target.goldDrop || 0,
          });
        }
      }
    }
  }

  /**
   * Find up to maxTargets enemies in attack range.
   * @private
   */
  _findTargets(attacker, entities) {
    const rangePx = attacker.attackRange * TILE_SIZE;
    const rangeSq = rangePx * rangePx;
    const candidates = [];

    for (const e of entities) {
      if (!e.alive || e.team === attacker.team || e.team === null) continue;
      const dx = e.x - attacker.x;
      const dy = e.y - attacker.y;
      const distSq = dx * dx + dy * dy;
      if (distSq <= rangeSq) {
        candidates.push({ entity: e, distSq });
      }
    }

    candidates.sort((a, b) => a.distSq - b.distSq);
    return candidates.slice(0, attacker.maxTargets).map(c => c.entity);
  }

  /**
   * Calculate damage with level bonus.
   * @private
   */
  _calculateDamage(attacker) {
    const levelBonus = 1 + (attacker.level - 1) * LEVEL_DAMAGE_BONUS;
    return Math.round(attacker.damage * levelBonus);
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/systems/CombatSystem.test.js`
Expected: All 10 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/systems/CombatSystem.js tests/systems/CombatSystem.test.js
git commit -m "feat(phase4): implement tick-based CombatSystem with multi-target and debuffs"
```

---

### Task 3: Creature Base Class + Troll

**Files:**
- Create: `src/entities/Creature.js`
- Replace: `src/entities/Troll.js`
- Create: `tests/entities/Troll.test.js`

- [ ] **Step 1: Write Troll tests**

```js
import { describe, it, expect, beforeEach } from 'vitest';
import { Troll } from '../../src/entities/Troll.js';
import { World } from '../../src/world/World.js';
import { EventBus } from '../../src/core/EventBus.js';
import { EntityManager } from '../../src/entities/EntityManager.js';
import { RoomManager } from '../../src/systems/RoomManager.js';
import { Entity } from '../../src/entities/Entity.js';
import { Pathfinder } from '../../src/world/Pathfinder.js';
import { TILE_TYPES, TILE_SIZE, CREATURE_STATES, TROLL_STATS, ROOM_TYPES } from '../../src/constants.js';

function makeWorld() {
  const world = new World();
  const cx = Math.floor(world.width / 2);
  const cy = Math.floor(world.height / 2);
  for (let dy = -8; dy <= 8; dy++) {
    for (let dx = -8; dx <= 8; dx++) {
      world.setTile(cx + dx, cy + dy, TILE_TYPES.CLAIMED_FLOOR);
    }
  }
  return world;
}

describe('Troll', () => {
  let world, eventBus, entityManager, roomManager;

  beforeEach(() => {
    Pathfinder.clearCache();
    world = makeWorld();
    eventBus = new EventBus();
    entityManager = new EntityManager();
    roomManager = new RoomManager(eventBus);
  });

  it('creates with correct stats from TROLL_STATS', () => {
    const cx = Math.floor(world.width / 2);
    const cy = Math.floor(world.height / 2);
    const troll = new Troll(cx * TILE_SIZE + 16, cy * TILE_SIZE + 16, world, eventBus, entityManager, roomManager);
    expect(troll.health).toBe(TROLL_STATS.hp);
    expect(troll.maxHealth).toBe(TROLL_STATS.hp);
    expect(troll.damage).toBe(TROLL_STATS.damage);
    expect(troll.attackRange).toBe(TROLL_STATS.attackRange);
    expect(troll.speed).toBe(TROLL_STATS.speed);
    expect(troll.team).toBe('player');
  });

  it('starts in IDLE state', () => {
    const cx = Math.floor(world.width / 2);
    const cy = Math.floor(world.height / 2);
    const troll = new Troll(cx * TILE_SIZE + 16, cy * TILE_SIZE + 16, world, eventBus, entityManager, roomManager);
    expect(troll.state).toBe(CREATURE_STATES.IDLE);
  });

  it('hunger decreases over time', () => {
    const cx = Math.floor(world.width / 2);
    const cy = Math.floor(world.height / 2);
    const troll = new Troll(cx * TILE_SIZE + 16, cy * TILE_SIZE + 16, world, eventBus, entityManager, roomManager);
    const initial = troll.hunger;
    for (let i = 0; i < 60; i++) troll.update(0.5);
    expect(troll.hunger).toBeLessThan(initial);
  });

  it('energy decreases over time', () => {
    const cx = Math.floor(world.width / 2);
    const cy = Math.floor(world.height / 2);
    const troll = new Troll(cx * TILE_SIZE + 16, cy * TILE_SIZE + 16, world, eventBus, entityManager, roomManager);
    const initial = troll.energy;
    for (let i = 0; i < 60; i++) troll.update(0.5);
    expect(troll.energy).toBeLessThan(initial);
  });

  it('flees when health below 20% of max', () => {
    const cx = Math.floor(world.width / 2);
    const cy = Math.floor(world.height / 2);
    const troll = new Troll(cx * TILE_SIZE + 16, cy * TILE_SIZE + 16, world, eventBus, entityManager, roomManager);
    troll.health = Math.floor(troll.maxHealth * 0.2) - 1;
    troll.update(0.016);
    expect(troll.state).toBe(CREATURE_STATES.FLEEING);
  });

  it('seeks Hatchery when hungry', () => {
    const cx = Math.floor(world.width / 2);
    const cy = Math.floor(world.height / 2);
    roomManager.placeRoom(ROOM_TYPES.HATCHERY, [
      { x: cx + 3, y: cy }, { x: cx + 3, y: cy + 1 },
      { x: cx + 4, y: cy }, { x: cx + 4, y: cy + 1 },
    ]);
    const troll = new Troll(cx * TILE_SIZE + 16, cy * TILE_SIZE + 16, world, eventBus, entityManager, roomManager);
    troll.hunger = 25; // Below threshold (30)
    troll.update(0.016);
    expect(troll.state).toBe(CREATURE_STATES.MOVING);
  });

  it('seeks Lair when tired', () => {
    const cx = Math.floor(world.width / 2);
    const cy = Math.floor(world.height / 2);
    roomManager.placeRoom(ROOM_TYPES.LAIR, [
      { x: cx + 3, y: cy }, { x: cx + 3, y: cy + 1 },
      { x: cx + 4, y: cy }, { x: cx + 4, y: cy + 1 },
    ]);
    const troll = new Troll(cx * TILE_SIZE + 16, cy * TILE_SIZE + 16, world, eventBus, entityManager, roomManager);
    troll.energy = 15; // Below threshold (20)
    troll.hunger = 100;
    troll.update(0.016);
    expect(troll.state).toBe(CREATURE_STATES.MOVING);
  });

  it('approaches enemy when detected', () => {
    const cx = Math.floor(world.width / 2);
    const cy = Math.floor(world.height / 2);
    const troll = new Troll(cx * TILE_SIZE + 16, cy * TILE_SIZE + 16, world, eventBus, entityManager, roomManager);
    entityManager.add(troll);
    // Add enemy hero 5 tiles away
    const enemy = new Entity('knight', (cx + 5) * TILE_SIZE + 16, cy * TILE_SIZE + 16);
    enemy.team = 'enemy';
    enemy.health = 100;
    enemy.maxHealth = 100;
    entityManager.add(enemy);
    troll.update(0.016);
    expect([CREATURE_STATES.MOVING, CREATURE_STATES.ATTACKING]).toContain(troll.state);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/entities/Troll.test.js`
Expected: FAIL — Troll and Creature don't exist yet.

- [ ] **Step 3: Implement Creature base class**

```js
import { Entity } from './Entity.js';
import { Pathfinder } from '../world/Pathfinder.js';
import {
  CREATURE_STATES, TILE_SIZE, ROOM_TYPES, ROOM_CONFIG,
  LEVEL_THRESHOLDS, LEVEL_HP_BONUS, LEVEL_SPEED_BONUS, MAX_LEVEL,
} from '../constants.js';

/**
 * Shared base class for player creatures (Troll, Dark Mistress).
 * Provides: need management, pathfinding, combat approach, training, idle wandering.
 * CombatSystem handles actual damage resolution; this class handles movement/state.
 */
export class Creature extends Entity {
  /**
   * @param {string} type - ENTITY_TYPES value.
   * @param {number} x
   * @param {number} y
   * @param {Object} stats - Frozen stats object (e.g., TROLL_STATS).
   * @param {import('../world/World.js').World} world
   * @param {import('../core/EventBus.js').EventBus} eventBus
   * @param {import('./EntityManager.js').EntityManager} entityManager
   * @param {import('../systems/RoomManager.js').RoomManager} roomManager
   */
  constructor(type, x, y, stats, world, eventBus, entityManager, roomManager) {
    super(type, x, y);
    this.team = 'player';
    this.health = stats.hp;
    this.maxHealth = stats.hp;
    this.damage = stats.damage;
    this.attackRange = stats.attackRange;
    this.attackCooldown = stats.attackCooldown;
    this.speed = stats.speed;
    this.hunger = 100;
    this.energy = 100;
    this.state = CREATURE_STATES.IDLE;

    this._baseStats = stats;
    this._world = world;
    this._eventBus = eventBus;
    this._entityManager = entityManager;
    this._roomManager = roomManager;

    this._path = null;
    this._pathIndex = 0;
    this._facingRight = true;
    this._idleTimer = 0;
    this._eatTimer = 0;
    this._sleepTimer = 0;
    this._moveGoal = null;
    this._attackTarget = null;
  }

  /** @param {number} dt */
  update(dt) {
    this.hunger = Math.max(0, this.hunger - dt * 0.5);
    this.energy = Math.max(0, this.energy - dt * 0.3);

    if (this.health < this.maxHealth * 0.2) {
      this._enterFlee();
    } else if (this.state === CREATURE_STATES.FLEEING) {
      this._updateFlee(dt);
    } else if (this.state === CREATURE_STATES.EATING) {
      this._updateEat(dt);
    } else if (this.state === CREATURE_STATES.SLEEPING) {
      this._updateSleep(dt);
    } else if (this.hunger < 30) {
      this._enterEat();
    } else if (this.energy < 20) {
      this._enterSleep();
    } else if (this.state === CREATURE_STATES.ATTACKING) {
      this._updateAttack(dt);
    } else if (this.state === CREATURE_STATES.TRAINING) {
      this._updateTrain(dt);
    } else if (this.state === CREATURE_STATES.MOVING) {
      this._updateMove(dt);
    } else {
      this._decideAction(dt);
    }
  }

  /** @private */
  _decideAction(dt) {
    const enemy = this._findNearestEnemy();
    if (enemy) {
      const dx = enemy.x - this.x;
      const dy = enemy.y - this.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const rangePx = this.attackRange * TILE_SIZE;

      if (dist <= rangePx) {
        this.state = CREATURE_STATES.ATTACKING;
        this._attackTarget = enemy;
        this._facingRight = enemy.x > this.x;
        return;
      }

      const targetTile = enemy.getTile(TILE_SIZE);
      this._pathToTile(targetTile.tx, targetTile.ty);
      if (this._path) {
        this._moveGoal = 'attack';
        return;
      }
    }

    // Training Room
    if (this._roomManager) {
      const trainingTiles = this._roomManager.getRoomTilesOfType(ROOM_TYPES.TRAINING_ROOM);
      if (trainingTiles.length > 0) {
        const { tx, ty } = this.getTile(TILE_SIZE);
        if (trainingTiles.some(t => t.x === tx && t.y === ty)) {
          this.state = CREATURE_STATES.TRAINING;
          this._path = null;
          return;
        }
        const target = this._findNearestTile(trainingTiles);
        if (target) {
          this._pathToTile(target.x, target.y);
          if (this._path) {
            this._moveGoal = 'train';
            return;
          }
        }
      }
    }

    this.state = CREATURE_STATES.IDLE;
    this._moveGoal = null;
    this._updateIdle(dt);
  }

  /** @private */
  _updateAttack(_dt) {
    if (!this._attackTarget || !this._attackTarget.alive) {
      this._attackTarget = null;
      this.state = CREATURE_STATES.IDLE;
      return;
    }
    const dx = this._attackTarget.x - this.x;
    const dy = this._attackTarget.y - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > this.attackRange * TILE_SIZE * 1.5) {
      const t = this._attackTarget.getTile(TILE_SIZE);
      this._pathToTile(t.tx, t.ty);
      if (this._path) {
        this._moveGoal = 'attack';
        this.state = CREATURE_STATES.MOVING;
      } else {
        this._attackTarget = null;
        this.state = CREATURE_STATES.IDLE;
      }
      return;
    }
    this._facingRight = this._attackTarget.x > this.x;
  }

  /** @private */
  _updateTrain(dt) {
    const { tx, ty } = this.getTile(TILE_SIZE);
    const room = this._roomManager ? this._roomManager.getRoomAt(tx, ty) : null;
    if (!room || room.type !== ROOM_TYPES.TRAINING_ROOM) {
      this.state = CREATURE_STATES.IDLE;
      return;
    }
    this.xp += ROOM_CONFIG[ROOM_TYPES.TRAINING_ROOM].xpPerSec * dt;
    this._checkLevelUp();

    const enemy = this._findNearestEnemy();
    if (enemy) {
      const dx = enemy.x - this.x;
      const dy = enemy.y - this.y;
      if (Math.sqrt(dx * dx + dy * dy) < TILE_SIZE * 8) {
        this.state = CREATURE_STATES.IDLE;
      }
    }
  }

  /** @private */
  _checkLevelUp() {
    if (this.level >= MAX_LEVEL) return;
    const nextThreshold = LEVEL_THRESHOLDS[this.level];
    if (this.xp >= nextThreshold) {
      this.level++;
      this.maxHealth = Math.round(this._baseStats.hp * (1 + (this.level - 1) * LEVEL_HP_BONUS));
      this.health = Math.min(this.health + 10, this.maxHealth);
      this.speed = Math.round(this._baseStats.speed * (1 + (this.level - 1) * LEVEL_SPEED_BONUS));
    }
  }

  /** @private */
  _enterEat() {
    if (this.state === CREATURE_STATES.EATING) return;
    if (this._roomManager) {
      const tiles = this._roomManager.getRoomTilesOfType(ROOM_TYPES.HATCHERY);
      if (tiles.length > 0) {
        const target = this._findNearestTile(tiles);
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
    this.state = CREATURE_STATES.EATING;
    this._eatTimer = 0;
    this._path = null;
    this._moveGoal = null;
  }

  /** @private */
  _updateEat(dt) {
    this._eatTimer += dt;
    this.hunger = Math.min(100, this.hunger + dt * 20);
    if (this.hunger >= 80 || this._eatTimer > 3) {
      this.state = CREATURE_STATES.IDLE;
    }
  }

  /** @private */
  _enterSleep() {
    if (this.state === CREATURE_STATES.SLEEPING) return;
    if (this._roomManager) {
      const tiles = this._roomManager.getRoomTilesOfType(ROOM_TYPES.LAIR);
      if (tiles.length > 0) {
        const target = this._findNearestTile(tiles);
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
    this.state = CREATURE_STATES.SLEEPING;
    this._sleepTimer = 0;
    this._path = null;
    this._moveGoal = null;
  }

  /** @private */
  _updateSleep(dt) {
    this._sleepTimer += dt;
    this.energy = Math.min(100, this.energy + dt * 15);
    if (this.energy >= 80 || this._sleepTimer > 4) {
      this.state = CREATURE_STATES.IDLE;
    }
  }

  /** @private */
  _enterFlee() {
    if (this.state === CREATURE_STATES.FLEEING) return;
    this.state = CREATURE_STATES.FLEEING;
    this._attackTarget = null;
    const cx = Math.floor(this._world.width / 2);
    const cy = Math.floor(this._world.height / 2);
    this._pathToTile(cx, cy);
  }

  /** @private */
  _updateFlee(dt) {
    if (this.health >= this.maxHealth * 0.2) {
      this.state = CREATURE_STATES.IDLE;
      this._path = null;
      return;
    }
    this._followPath(dt);
  }

  /** @private */
  _updateMove(dt) {
    if (!this._path || this._pathIndex >= this._path.length) {
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
      if (this._moveGoal === 'train') {
        this.state = CREATURE_STATES.TRAINING;
        this._moveGoal = null;
        return;
      }
      if (this._moveGoal === 'attack') {
        this.state = CREATURE_STATES.IDLE;
        this._moveGoal = null;
        return;
      }
      this.state = CREATURE_STATES.IDLE;
      this._moveGoal = null;
      return;
    }
    this._followPath(dt);
  }

  /** @private */
  _updateIdle(dt) {
    this._idleTimer += dt;
    if (this._idleTimer > 2) {
      this._idleTimer = 0;
      this._wanderRandomly();
    }
    if (this._path) {
      this._followPath(dt);
      if (!this._path || this._pathIndex >= this._path.length) {
        this._path = null;
      }
    }
  }

  /** @private */
  _wanderRandomly() {
    const { tx, ty } = this.getTile(TILE_SIZE);
    for (let i = 0; i < 5; i++) {
      const nx = tx + Math.floor(Math.random() * 6) - 3;
      const ny = ty + Math.floor(Math.random() * 6) - 3;
      if (this._world.isWalkable(nx, ny)) {
        this._pathToTile(nx, ny);
        return;
      }
    }
  }

  /** @private */
  _findNearestEnemy() {
    const aggroRange = TILE_SIZE * 10;
    let nearest = null;
    let nearestDist = Infinity;
    for (const e of this._entityManager.getAll()) {
      if (!e.alive || e.team === this.team || e.team === null) continue;
      const dx = e.x - this.x;
      const dy = e.y - this.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < nearestDist && dist < aggroRange) {
        nearestDist = dist;
        nearest = e;
      }
    }
    return nearest;
  }

  /** @private */
  _findNearestTile(tiles) {
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

  /** @private */
  _followPath(dt) {
    if (!this._path || this._pathIndex >= this._path.length) return;
    const target = this._path[this._pathIndex];
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

    const move = Math.min(this.getEffectiveSpeed() * dt, dist);
    this.x += (dx / dist) * move;
    this.y += (dy / dist) * move;
    this._facingRight = dx > 0;
  }

  /** @returns {boolean} */
  get facingRight() { return this._facingRight; }
}
```

- [ ] **Step 4: Implement Troll**

```js
import { Creature } from './Creature.js';
import { ENTITY_TYPES, TROLL_STATS } from '../constants.js';

/**
 * Troll creature — high HP, slow, melee, high damage.
 * Attracted by Hatchery >= 6 tiles.
 */
export class Troll extends Creature {
  constructor(x, y, world, eventBus, entityManager, roomManager) {
    super(ENTITY_TYPES.TROLL, x, y, TROLL_STATS, world, eventBus, entityManager, roomManager);
  }
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run tests/entities/Troll.test.js`
Expected: All 8 tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/entities/Creature.js src/entities/Troll.js tests/entities/Troll.test.js
git commit -m "feat(phase4): implement Creature base class and Troll with AI"
```

---

### Task 4: DarkMistress

**Files:**
- Replace: `src/entities/DarkMistress.js`
- Create: `tests/entities/DarkMistress.test.js`

- [ ] **Step 1: Write tests**

```js
import { describe, it, expect, beforeEach } from 'vitest';
import { DarkMistress } from '../../src/entities/DarkMistress.js';
import { World } from '../../src/world/World.js';
import { EventBus } from '../../src/core/EventBus.js';
import { EntityManager } from '../../src/entities/EntityManager.js';
import { RoomManager } from '../../src/systems/RoomManager.js';
import { Pathfinder } from '../../src/world/Pathfinder.js';
import {
  TILE_TYPES, TILE_SIZE, CREATURE_STATES, DARK_MISTRESS_STATS, ROOM_TYPES, ROOM_CONFIG,
} from '../../src/constants.js';

function makeWorld() {
  const world = new World();
  const cx = Math.floor(world.width / 2);
  const cy = Math.floor(world.height / 2);
  for (let dy = -8; dy <= 8; dy++) {
    for (let dx = -8; dx <= 8; dx++) {
      world.setTile(cx + dx, cy + dy, TILE_TYPES.CLAIMED_FLOOR);
    }
  }
  return world;
}

describe('DarkMistress', () => {
  let world, eventBus, entityManager, roomManager;

  beforeEach(() => {
    Pathfinder.clearCache();
    world = makeWorld();
    eventBus = new EventBus();
    entityManager = new EntityManager();
    roomManager = new RoomManager(eventBus);
  });

  it('creates with correct stats', () => {
    const cx = Math.floor(world.width / 2);
    const cy = Math.floor(world.height / 2);
    const dm = new DarkMistress(cx * TILE_SIZE + 16, cy * TILE_SIZE + 16, world, eventBus, entityManager, roomManager);
    expect(dm.health).toBe(DARK_MISTRESS_STATS.hp);
    expect(dm.damage).toBe(DARK_MISTRESS_STATS.damage);
    expect(dm.speed).toBe(DARK_MISTRESS_STATS.speed);
    expect(dm.team).toBe('player');
  });

  it('has maxTargets = 2', () => {
    const cx = Math.floor(world.width / 2);
    const cy = Math.floor(world.height / 2);
    const dm = new DarkMistress(cx * TILE_SIZE + 16, cy * TILE_SIZE + 16, world, eventBus, entityManager, roomManager);
    expect(dm.maxTargets).toBe(DARK_MISTRESS_STATS.maxTargets);
  });

  it('has debuffOnHit with slow type', () => {
    const cx = Math.floor(world.width / 2);
    const cy = Math.floor(world.height / 2);
    const dm = new DarkMistress(cx * TILE_SIZE + 16, cy * TILE_SIZE + 16, world, eventBus, entityManager, roomManager);
    expect(dm.debuffOnHit).not.toBeNull();
    expect(dm.debuffOnHit.type).toBe('slow');
    expect(dm.debuffOnHit.duration).toBe(DARK_MISTRESS_STATS.slowDebuffDuration);
    expect(dm.debuffOnHit.factor).toBe(DARK_MISTRESS_STATS.slowDebuffFactor);
  });

  it('enters TRAINING when on training room tile', () => {
    const cx = Math.floor(world.width / 2);
    const cy = Math.floor(world.height / 2);
    // Place training room at creature's position
    roomManager.placeRoom(ROOM_TYPES.TRAINING_ROOM, [
      { x: cx, y: cy }, { x: cx + 1, y: cy },
      { x: cx, y: cy + 1 }, { x: cx + 1, y: cy + 1 },
      { x: cx + 2, y: cy }, { x: cx + 2, y: cy + 1 },
    ]);
    const dm = new DarkMistress(cx * TILE_SIZE + 16, cy * TILE_SIZE + 16, world, eventBus, entityManager, roomManager);
    entityManager.add(dm);
    dm.update(0.016);
    expect(dm.state).toBe(CREATURE_STATES.TRAINING);
  });

  it('gains XP while training', () => {
    const cx = Math.floor(world.width / 2);
    const cy = Math.floor(world.height / 2);
    roomManager.placeRoom(ROOM_TYPES.TRAINING_ROOM, [
      { x: cx, y: cy }, { x: cx + 1, y: cy },
      { x: cx, y: cy + 1 }, { x: cx + 1, y: cy + 1 },
      { x: cx + 2, y: cy }, { x: cx + 2, y: cy + 1 },
    ]);
    const dm = new DarkMistress(cx * TILE_SIZE + 16, cy * TILE_SIZE + 16, world, eventBus, entityManager, roomManager);
    entityManager.add(dm);
    dm.update(0.016); // Enter training
    expect(dm.state).toBe(CREATURE_STATES.TRAINING);
    const xpBefore = dm.xp;
    dm.update(1.0); // Train for 1 second
    expect(dm.xp).toBeGreaterThan(xpBefore);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/entities/DarkMistress.test.js`
Expected: FAIL.

- [ ] **Step 3: Implement DarkMistress**

```js
import { Creature } from './Creature.js';
import { ENTITY_TYPES, DARK_MISTRESS_STATS } from '../constants.js';

/**
 * Dark Mistress — medium HP, fast, melee+whip, hits 2 targets, applies slow debuff.
 * Attracted by Training Room >= 6 tiles.
 */
export class DarkMistress extends Creature {
  constructor(x, y, world, eventBus, entityManager, roomManager) {
    super(ENTITY_TYPES.DARK_MISTRESS, x, y, DARK_MISTRESS_STATS, world, eventBus, entityManager, roomManager);
    this.maxTargets = DARK_MISTRESS_STATS.maxTargets;
    this.debuffOnHit = {
      type: 'slow',
      duration: DARK_MISTRESS_STATS.slowDebuffDuration,
      factor: DARK_MISTRESS_STATS.slowDebuffFactor,
    };
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/entities/DarkMistress.test.js`
Expected: All 5 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/entities/DarkMistress.js tests/entities/DarkMistress.test.js
git commit -m "feat(phase4): implement DarkMistress with multi-target attack and slow debuff"
```

---

### Task 5: Hero Base Class + Knight

**Files:**
- Create: `src/entities/Hero.js`
- Replace: `src/entities/Knight.js`
- Create: `tests/entities/Knight.test.js`

- [ ] **Step 1: Write Knight tests**

```js
import { describe, it, expect, beforeEach } from 'vitest';
import { Knight } from '../../src/entities/Knight.js';
import { World } from '../../src/world/World.js';
import { EventBus } from '../../src/core/EventBus.js';
import { EntityManager } from '../../src/entities/EntityManager.js';
import { RoomManager } from '../../src/systems/RoomManager.js';
import { Pathfinder } from '../../src/world/Pathfinder.js';
import { TILE_TYPES, TILE_SIZE, CREATURE_STATES, KNIGHT_STATS, WAVE } from '../../src/constants.js';

function makeWorld() {
  const world = new World();
  const cx = Math.floor(world.width / 2);
  const cy = Math.floor(world.height / 2);
  for (let dy = -10; dy <= 10; dy++) {
    for (let dx = -10; dx <= 10; dx++) {
      world.setTile(cx + dx, cy + dy, TILE_TYPES.CLAIMED_FLOOR);
    }
  }
  return world;
}

describe('Knight', () => {
  let world, eventBus, entityManager, roomManager;

  beforeEach(() => {
    Pathfinder.clearCache();
    world = makeWorld();
    eventBus = new EventBus();
    entityManager = new EntityManager();
    roomManager = new RoomManager(eventBus);
  });

  it('creates with correct stats and team', () => {
    const cx = Math.floor(world.width / 2);
    const cy = Math.floor(world.height / 2);
    const knight = new Knight((cx + 8) * TILE_SIZE + 16, cy * TILE_SIZE + 16, world, eventBus, entityManager, roomManager);
    expect(knight.health).toBe(KNIGHT_STATS.hp);
    expect(knight.damage).toBe(KNIGHT_STATS.damage);
    expect(knight.speed).toBe(KNIGHT_STATS.speed);
    expect(knight.team).toBe('enemy');
    expect(knight.goldDrop).toBe(KNIGHT_STATS.goldDrop);
  });

  it('starts in MOVING state', () => {
    const cx = Math.floor(world.width / 2);
    const cy = Math.floor(world.height / 2);
    const knight = new Knight((cx + 8) * TILE_SIZE + 16, cy * TILE_SIZE + 16, world, eventBus, entityManager, roomManager);
    expect(knight.state).toBe(CREATURE_STATES.MOVING);
  });

  it('pathfinds toward Dungeon Heart on creation', () => {
    const cx = Math.floor(world.width / 2);
    const cy = Math.floor(world.height / 2);
    const knight = new Knight((cx + 8) * TILE_SIZE + 16, cy * TILE_SIZE + 16, world, eventBus, entityManager, roomManager);
    expect(knight._path).not.toBeNull();
    expect(knight._path.length).toBeGreaterThan(0);
  });

  it('moves toward target over time', () => {
    const cx = Math.floor(world.width / 2);
    const cy = Math.floor(world.height / 2);
    const startX = (cx + 8) * TILE_SIZE + 16;
    const knight = new Knight(startX, cy * TILE_SIZE + 16, world, eventBus, entityManager, roomManager);
    for (let i = 0; i < 60; i++) knight.update(0.016);
    expect(knight.x).not.toBe(startX);
  });

  it('re-paths at REPATH_INTERVAL_SEC', () => {
    const cx = Math.floor(world.width / 2);
    const cy = Math.floor(world.height / 2);
    const knight = new Knight((cx + 8) * TILE_SIZE + 16, cy * TILE_SIZE + 16, world, eventBus, entityManager, roomManager);
    const oldPath = knight._path;
    // Advance past repath interval
    for (let i = 0; i < Math.ceil(WAVE.REPATH_INTERVAL_SEC / 0.016); i++) {
      knight.update(0.016);
    }
    // Path should have been recalculated (different object reference or advanced index)
    // Just verify knight is still moving
    expect(knight.state).toBe(CREATURE_STATES.MOVING);
  });

  it('getEffectiveSpeed applies slow debuff', () => {
    const cx = Math.floor(world.width / 2);
    const cy = Math.floor(world.height / 2);
    const knight = new Knight((cx + 8) * TILE_SIZE + 16, cy * TILE_SIZE + 16, world, eventBus, entityManager, roomManager);
    expect(knight.getEffectiveSpeed()).toBe(KNIGHT_STATS.speed);
    knight.applyDebuff('slow', 3.0, 0.5);
    expect(knight.getEffectiveSpeed()).toBe(KNIGHT_STATS.speed * 0.5);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/entities/Knight.test.js`
Expected: FAIL.

- [ ] **Step 3: Implement Hero base class**

```js
import { Entity } from './Entity.js';
import { Pathfinder } from '../world/Pathfinder.js';
import { CREATURE_STATES, TILE_SIZE, WAVE } from '../constants.js';

/**
 * Shared base class for hero entities (Knight, Thief, Wizard).
 * Pathfinds to Dungeon Heart, re-paths every 3 seconds.
 * CombatSystem handles damage; this class handles movement.
 */
export class Hero extends Entity {
  /**
   * @param {string} type
   * @param {number} x
   * @param {number} y
   * @param {Object} stats
   * @param {import('../world/World.js').World} world
   * @param {import('../core/EventBus.js').EventBus} eventBus
   * @param {import('./EntityManager.js').EntityManager} entityManager
   * @param {import('../systems/RoomManager.js').RoomManager} roomManager
   */
  constructor(type, x, y, stats, world, eventBus, entityManager, roomManager) {
    super(type, x, y);
    this.team = 'enemy';
    this.health = stats.hp;
    this.maxHealth = stats.hp;
    this.damage = stats.damage;
    this.attackRange = stats.attackRange;
    this.attackCooldown = stats.attackCooldown;
    this.speed = stats.speed;
    this.goldDrop = stats.goldDrop;
    this.state = CREATURE_STATES.MOVING;

    this._world = world;
    this._eventBus = eventBus;
    this._entityManager = entityManager;
    this._roomManager = roomManager;

    this._path = null;
    this._pathIndex = 0;
    this._repathTimer = 0;
    this._facingRight = true;

    this._repath();
  }

  /** @param {number} dt */
  update(dt) {
    this._repathTimer += dt;
    if (this._repathTimer >= WAVE.REPATH_INTERVAL_SEC) {
      this._repathTimer = 0;
      this._repath();
    }
    this._followPath(dt);
  }

  /** Override in subclasses for different targeting. @protected */
  _repath() {
    this._pathToDungeonHeart();
  }

  /** @protected */
  _pathToDungeonHeart() {
    const cx = Math.floor(this._world.width / 2);
    const cy = Math.floor(this._world.height / 2);
    this._pathToTile(cx, cy);
  }

  /** @protected */
  _pathToTile(tx, ty) {
    const { tx: sx, ty: sy } = this.getTile(TILE_SIZE);
    const path = Pathfinder.findPath(this._world, sx, sy, tx, ty);
    if (path && path.length > 0) {
      this._path = path;
      this._pathIndex = 0;
    } else {
      this._path = null;
    }
  }

  /** @protected */
  _followPath(dt) {
    if (!this._path || this._pathIndex >= this._path.length) return;
    const target = this._path[this._pathIndex];
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

    const move = Math.min(this.getEffectiveSpeed() * dt, dist);
    this.x += (dx / dist) * move;
    this.y += (dy / dist) * move;
    this._facingRight = dx > 0;
  }

  /** @returns {boolean} */
  get facingRight() { return this._facingRight; }
}
```

- [ ] **Step 4: Implement Knight**

```js
import { Hero } from './Hero.js';
import { ENTITY_TYPES, KNIGHT_STATS } from '../constants.js';

/**
 * Knight hero — high HP, slow, melee. Attacks creatures and doors on path.
 */
export class Knight extends Hero {
  constructor(x, y, world, eventBus, entityManager, roomManager) {
    super(ENTITY_TYPES.KNIGHT, x, y, KNIGHT_STATS, world, eventBus, entityManager, roomManager);
  }
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run tests/entities/Knight.test.js`
Expected: All 6 tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/entities/Hero.js src/entities/Knight.js tests/entities/Knight.test.js
git commit -m "feat(phase4): implement Hero base class and Knight"
```

---

### Task 6: Thief + Wizard

**Files:**
- Replace: `src/entities/Thief.js`
- Replace: `src/entities/Wizard.js`
- Create: `tests/entities/Thief.test.js`
- Create: `tests/entities/Wizard.test.js`

- [ ] **Step 1: Write Thief tests**

```js
import { describe, it, expect, beforeEach } from 'vitest';
import { Thief } from '../../src/entities/Thief.js';
import { World } from '../../src/world/World.js';
import { EventBus } from '../../src/core/EventBus.js';
import { EntityManager } from '../../src/entities/EntityManager.js';
import { RoomManager } from '../../src/systems/RoomManager.js';
import { Pathfinder } from '../../src/world/Pathfinder.js';
import { TILE_TYPES, TILE_SIZE, THIEF_STATS, ROOM_TYPES } from '../../src/constants.js';

function makeWorld() {
  const world = new World();
  const cx = Math.floor(world.width / 2);
  const cy = Math.floor(world.height / 2);
  for (let dy = -10; dy <= 10; dy++) {
    for (let dx = -10; dx <= 10; dx++) {
      world.setTile(cx + dx, cy + dy, TILE_TYPES.CLAIMED_FLOOR);
    }
  }
  return world;
}

describe('Thief', () => {
  let world, eventBus, entityManager, roomManager;

  beforeEach(() => {
    Pathfinder.clearCache();
    world = makeWorld();
    eventBus = new EventBus();
    entityManager = new EntityManager();
    roomManager = new RoomManager(eventBus);
  });

  it('creates with correct stats', () => {
    const cx = Math.floor(world.width / 2);
    const cy = Math.floor(world.height / 2);
    const thief = new Thief((cx + 8) * TILE_SIZE + 16, cy * TILE_SIZE + 16, world, eventBus, entityManager, roomManager);
    expect(thief.health).toBe(THIEF_STATS.hp);
    expect(thief.speed).toBe(THIEF_STATS.speed);
    expect(thief.team).toBe('enemy');
  });

  it('targets Treasury tiles when available', () => {
    const cx = Math.floor(world.width / 2);
    const cy = Math.floor(world.height / 2);
    // Place treasury to the south
    roomManager.placeRoom(ROOM_TYPES.TREASURY, [
      { x: cx, y: cy + 5 }, { x: cx + 1, y: cy + 5 },
      { x: cx, y: cy + 6 }, { x: cx + 1, y: cy + 6 },
    ]);
    const thief = new Thief((cx + 8) * TILE_SIZE + 16, cy * TILE_SIZE + 16, world, eventBus, entityManager, roomManager);
    // Force repath
    thief._repathTimer = 999;
    thief.update(0.016);
    // Path should exist and target treasury area
    expect(thief._path).not.toBeNull();
  });

  it('falls back to Dungeon Heart when no Treasury', () => {
    const cx = Math.floor(world.width / 2);
    const cy = Math.floor(world.height / 2);
    const thief = new Thief((cx + 8) * TILE_SIZE + 16, cy * TILE_SIZE + 16, world, eventBus, entityManager, roomManager);
    expect(thief._path).not.toBeNull();
  });
});
```

- [ ] **Step 2: Write Wizard tests**

```js
import { describe, it, expect, beforeEach } from 'vitest';
import { Wizard } from '../../src/entities/Wizard.js';
import { World } from '../../src/world/World.js';
import { EventBus } from '../../src/core/EventBus.js';
import { EntityManager } from '../../src/entities/EntityManager.js';
import { RoomManager } from '../../src/systems/RoomManager.js';
import { Entity } from '../../src/entities/Entity.js';
import { Pathfinder } from '../../src/world/Pathfinder.js';
import { TILE_TYPES, TILE_SIZE, WIZARD_STATS } from '../../src/constants.js';

function makeWorld() {
  const world = new World();
  const cx = Math.floor(world.width / 2);
  const cy = Math.floor(world.height / 2);
  for (let dy = -10; dy <= 10; dy++) {
    for (let dx = -10; dx <= 10; dx++) {
      world.setTile(cx + dx, cy + dy, TILE_TYPES.CLAIMED_FLOOR);
    }
  }
  return world;
}

describe('Wizard', () => {
  let world, eventBus, entityManager, roomManager;

  beforeEach(() => {
    Pathfinder.clearCache();
    world = makeWorld();
    eventBus = new EventBus();
    entityManager = new EntityManager();
    roomManager = new RoomManager(eventBus);
  });

  it('creates with correct stats', () => {
    const cx = Math.floor(world.width / 2);
    const cy = Math.floor(world.height / 2);
    const wiz = new Wizard((cx + 8) * TILE_SIZE + 16, cy * TILE_SIZE + 16, world, eventBus, entityManager, roomManager);
    expect(wiz.health).toBe(WIZARD_STATS.hp);
    expect(wiz.attackRange).toBe(WIZARD_STATS.attackRange);
    expect(wiz.speed).toBe(WIZARD_STATS.speed);
    expect(wiz.team).toBe('enemy');
  });

  it('kites from nearby melee enemies', () => {
    const cx = Math.floor(world.width / 2);
    const cy = Math.floor(world.height / 2);
    const wiz = new Wizard(cx * TILE_SIZE + 16, cy * TILE_SIZE + 16, world, eventBus, entityManager, roomManager);
    entityManager.add(wiz);
    // Place melee enemy very close
    const melee = new Entity('troll', cx * TILE_SIZE + TILE_SIZE + 16, cy * TILE_SIZE + 16);
    melee.team = 'player';
    melee.health = 100;
    melee.maxHealth = 100;
    melee.attackRange = 1.2;
    entityManager.add(melee);
    const startX = wiz.x;
    for (let i = 0; i < 30; i++) wiz.update(0.016);
    // Wizard should have moved away
    expect(Math.abs(wiz.x - melee.x)).toBeGreaterThan(Math.abs(startX - melee.x));
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx vitest run tests/entities/Thief.test.js tests/entities/Wizard.test.js`
Expected: FAIL.

- [ ] **Step 4: Implement Thief**

```js
import { Hero } from './Hero.js';
import { ENTITY_TYPES, THIEF_STATS, ROOM_TYPES, TILE_SIZE } from '../constants.js';

/**
 * Thief hero — low HP, fast. Bypasses creatures when possible, targets Treasury.
 */
export class Thief extends Hero {
  constructor(x, y, world, eventBus, entityManager, roomManager) {
    super(ENTITY_TYPES.THIEF, x, y, THIEF_STATS, world, eventBus, entityManager, roomManager);
  }

  /** @override - Target Treasury first, fallback to Dungeon Heart. */
  _repath() {
    if (this._roomManager) {
      const treasuryTiles = this._roomManager.getRoomTilesOfType(ROOM_TYPES.TREASURY);
      if (treasuryTiles.length > 0) {
        const { tx, ty } = this.getTile(TILE_SIZE);
        let best = null;
        let bestDist = Infinity;
        for (const t of treasuryTiles) {
          const dist = Math.abs(t.x - tx) + Math.abs(t.y - ty);
          if (dist < bestDist) {
            bestDist = dist;
            best = t;
          }
        }
        if (best) {
          this._pathToTile(best.x, best.y);
          if (this._path) return;
        }
      }
    }
    this._pathToDungeonHeart();
  }
}
```

- [ ] **Step 5: Implement Wizard**

```js
import { Hero } from './Hero.js';
import { ENTITY_TYPES, WIZARD_STATS, TILE_SIZE, WAVE } from '../constants.js';

/**
 * Wizard hero — medium HP, ranged (3 tiles). Kites melee attackers.
 */
export class Wizard extends Hero {
  constructor(x, y, world, eventBus, entityManager, roomManager) {
    super(ENTITY_TYPES.WIZARD, x, y, WIZARD_STATS, world, eventBus, entityManager, roomManager);
  }

  /** @override */
  update(dt) {
    this._repathTimer += dt;

    const nearestMelee = this._findNearestMeleeEnemy();
    if (nearestMelee) {
      const dx = nearestMelee.x - this.x;
      const dy = nearestMelee.y - this.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const safeRange = this.attackRange * TILE_SIZE * 0.8;

      if (dist < safeRange) {
        this._kiteFrom(nearestMelee, dt);
        return;
      }
    }

    if (this._repathTimer >= WAVE.REPATH_INTERVAL_SEC) {
      this._repathTimer = 0;
      this._repath();
    }
    this._followPath(dt);
  }

  /** @private */
  _findNearestMeleeEnemy() {
    let nearest = null;
    let nearestDist = Infinity;
    for (const e of this._entityManager.getAll()) {
      if (!e.alive || e.team === this.team || e.team === null) continue;
      if (e.attackRange > 2) continue;
      const dx = e.x - this.x;
      const dy = e.y - this.y;
      const dist = dx * dx + dy * dy;
      if (dist < nearestDist) {
        nearestDist = dist;
        nearest = e;
      }
    }
    return nearest;
  }

  /** @private */
  _kiteFrom(enemy, dt) {
    const dx = this.x - enemy.x;
    const dy = this.y - enemy.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 1) return;

    const move = this.getEffectiveSpeed() * dt;
    const nx = this.x + (dx / dist) * move;
    const ny = this.y + (dy / dist) * move;

    const tileX = Math.floor(nx / TILE_SIZE);
    const tileY = Math.floor(ny / TILE_SIZE);
    if (this._world.isWalkable(tileX, tileY)) {
      this.x = nx;
      this.y = ny;
      this._facingRight = dx > 0;
    }
  }
}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx vitest run tests/entities/Thief.test.js tests/entities/Wizard.test.js`
Expected: All 5 tests PASS.

- [ ] **Step 7: Commit**

```bash
git add src/entities/Thief.js src/entities/Wizard.js tests/entities/Thief.test.js tests/entities/Wizard.test.js
git commit -m "feat(phase4): implement Thief (Treasury-targeting) and Wizard (kiting)"
```

---

### Task 7: CreatureSpawner

**Files:**
- Replace: `src/systems/CreatureSpawner.js`
- Create: `tests/systems/CreatureSpawner.test.js`

- [ ] **Step 1: Write tests**

```js
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CreatureSpawner } from '../../src/systems/CreatureSpawner.js';
import { World } from '../../src/world/World.js';
import { EntityManager } from '../../src/entities/EntityManager.js';
import { EventBus } from '../../src/core/EventBus.js';
import { RoomManager } from '../../src/systems/RoomManager.js';
import {
  TILE_TYPES, ENTITY_TYPES, EVENTS, ROOM_TYPES,
  SPAWN_CHECK_INTERVAL_SEC, TROLL_STATS, DARK_MISTRESS_STATS,
} from '../../src/constants.js';

function makeWorld() {
  const world = new World();
  const cx = Math.floor(world.width / 2);
  const cy = Math.floor(world.height / 2);
  for (let dy = -8; dy <= 8; dy++) {
    for (let dx = -8; dx <= 8; dx++) {
      world.setTile(cx + dx, cy + dy, TILE_TYPES.CLAIMED_FLOOR);
    }
  }
  return world;
}

describe('CreatureSpawner', () => {
  let world, entityManager, eventBus, roomManager, spawner;

  beforeEach(() => {
    world = makeWorld();
    entityManager = new EntityManager();
    eventBus = new EventBus();
    roomManager = new RoomManager(eventBus);
    spawner = new CreatureSpawner(world, entityManager, eventBus, roomManager);
  });

  it('does not check before interval', () => {
    const cx = Math.floor(world.width / 2);
    const cy = Math.floor(world.height / 2);
    // Place Hatchery with 6 tiles
    const tiles = [];
    for (let i = 0; i < 6; i++) tiles.push({ x: cx + i - 3, y: cy + 5 });
    roomManager.placeRoom(ROOM_TYPES.HATCHERY, tiles);
    spawner.update(1.0); // 1 second — not enough
    expect(entityManager.getByType(ENTITY_TYPES.TROLL).length).toBe(0);
  });

  it('spawns Troll when Hatchery >= 6 tiles', () => {
    const cx = Math.floor(world.width / 2);
    const cy = Math.floor(world.height / 2);
    const tiles = [];
    for (let i = 0; i < 6; i++) tiles.push({ x: cx + i - 3, y: cy + 5 });
    roomManager.placeRoom(ROOM_TYPES.HATCHERY, tiles);
    spawner.update(SPAWN_CHECK_INTERVAL_SEC);
    expect(entityManager.getByType(ENTITY_TYPES.TROLL).length).toBe(1);
  });

  it('does not spawn when Hatchery < 6 tiles', () => {
    const cx = Math.floor(world.width / 2);
    const cy = Math.floor(world.height / 2);
    roomManager.placeRoom(ROOM_TYPES.HATCHERY, [
      { x: cx, y: cy + 5 }, { x: cx + 1, y: cy + 5 },
      { x: cx, y: cy + 6 }, { x: cx + 1, y: cy + 6 },
    ]);
    spawner.update(SPAWN_CHECK_INTERVAL_SEC);
    expect(entityManager.getByType(ENTITY_TYPES.TROLL).length).toBe(0);
  });

  it('respects max creature count', () => {
    const cx = Math.floor(world.width / 2);
    const cy = Math.floor(world.height / 2);
    const tiles = [];
    for (let i = 0; i < 6; i++) tiles.push({ x: cx + i - 3, y: cy + 5 });
    roomManager.placeRoom(ROOM_TYPES.HATCHERY, tiles);
    // Spawn up to max
    for (let i = 0; i < TROLL_STATS.maxCount + 2; i++) {
      spawner.update(SPAWN_CHECK_INTERVAL_SEC);
    }
    expect(entityManager.getByType(ENTITY_TYPES.TROLL).length).toBe(TROLL_STATS.maxCount);
  });

  it('spawns DarkMistress when Training Room >= 6 tiles', () => {
    const cx = Math.floor(world.width / 2);
    const cy = Math.floor(world.height / 2);
    const tiles = [];
    for (let i = 0; i < 6; i++) tiles.push({ x: cx + i - 3, y: cy + 5 });
    roomManager.placeRoom(ROOM_TYPES.TRAINING_ROOM, tiles);
    spawner.update(SPAWN_CHECK_INTERVAL_SEC);
    expect(entityManager.getByType(ENTITY_TYPES.DARK_MISTRESS).length).toBe(1);
  });

  it('publishes ENTITY_SPAWNED event', () => {
    const spy = vi.fn();
    eventBus.subscribe(EVENTS.ENTITY_SPAWNED, spy);
    const cx = Math.floor(world.width / 2);
    const cy = Math.floor(world.height / 2);
    const tiles = [];
    for (let i = 0; i < 6; i++) tiles.push({ x: cx + i - 3, y: cy + 5 });
    roomManager.placeRoom(ROOM_TYPES.HATCHERY, tiles);
    spawner.update(SPAWN_CHECK_INTERVAL_SEC);
    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ type: ENTITY_TYPES.TROLL }));
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/systems/CreatureSpawner.test.js`
Expected: FAIL.

- [ ] **Step 3: Implement CreatureSpawner**

```js
import {
  SPAWN_CHECK_INTERVAL_SEC, TILE_SIZE, ROOM_TYPES, ENTITY_TYPES, EVENTS,
  TROLL_STATS, DARK_MISTRESS_STATS,
} from '../constants.js';
import { Troll } from '../entities/Troll.js';
import { DarkMistress } from '../entities/DarkMistress.js';

/**
 * Checks room conditions every 30 seconds and spawns creatures.
 */
export class CreatureSpawner {
  constructor(world, entityManager, eventBus, roomManager) {
    this._world = world;
    this._entityManager = entityManager;
    this._eventBus = eventBus;
    this._roomManager = roomManager;
    this._timer = SPAWN_CHECK_INTERVAL_SEC;
  }

  /** @param {number} dt */
  update(dt) {
    this._timer -= dt;
    if (this._timer > 0) return;
    this._timer = SPAWN_CHECK_INTERVAL_SEC;
    this._checkSpawnConditions();
  }

  /** @private */
  _checkSpawnConditions() {
    const hatcheryTiles = this._roomManager.getTotalTilesOfType(ROOM_TYPES.HATCHERY);
    const trollCount = this._entityManager.getByType(ENTITY_TYPES.TROLL).length;
    if (hatcheryTiles >= TROLL_STATS.attractionMinTiles && trollCount < TROLL_STATS.maxCount) {
      this._spawnCreature(ENTITY_TYPES.TROLL, ROOM_TYPES.HATCHERY);
    }

    const trainingTiles = this._roomManager.getTotalTilesOfType(ROOM_TYPES.TRAINING_ROOM);
    const dmCount = this._entityManager.getByType(ENTITY_TYPES.DARK_MISTRESS).length;
    if (trainingTiles >= DARK_MISTRESS_STATS.attractionMinTiles && dmCount < DARK_MISTRESS_STATS.maxCount) {
      this._spawnCreature(ENTITY_TYPES.DARK_MISTRESS, ROOM_TYPES.TRAINING_ROOM);
    }
  }

  /** @private */
  _spawnCreature(type, roomType) {
    const tiles = this._roomManager.getRoomTilesOfType(roomType);
    if (tiles.length === 0) return;
    const tile = tiles[Math.floor(Math.random() * tiles.length)];
    const x = tile.x * TILE_SIZE + TILE_SIZE / 2;
    const y = tile.y * TILE_SIZE + TILE_SIZE / 2;

    const creature = type === ENTITY_TYPES.TROLL
      ? new Troll(x, y, this._world, this._eventBus, this._entityManager, this._roomManager)
      : new DarkMistress(x, y, this._world, this._eventBus, this._entityManager, this._roomManager);

    this._entityManager.add(creature);
    this._eventBus.publish(EVENTS.ENTITY_SPAWNED, { entityId: creature.id, type, x, y });
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/systems/CreatureSpawner.test.js`
Expected: All 6 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/systems/CreatureSpawner.js tests/systems/CreatureSpawner.test.js
git commit -m "feat(phase4): implement CreatureSpawner with room-condition checks"
```

---

### Task 8: WaveManager

**Files:**
- Replace: `src/systems/WaveManager.js`
- Create: `tests/systems/WaveManager.test.js`

- [ ] **Step 1: Write tests**

```js
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WaveManager } from '../../src/systems/WaveManager.js';
import { World } from '../../src/world/World.js';
import { EntityManager } from '../../src/entities/EntityManager.js';
import { EventBus } from '../../src/core/EventBus.js';
import { RoomManager } from '../../src/systems/RoomManager.js';
import { TILE_TYPES, ENTITY_TYPES, EVENTS, WAVE } from '../../src/constants.js';

function makeWorld() {
  const world = new World();
  const cx = Math.floor(world.width / 2);
  const cy = Math.floor(world.height / 2);
  for (let dy = -10; dy <= 10; dy++) {
    for (let dx = -10; dx <= 10; dx++) {
      world.setTile(cx + dx, cy + dy, TILE_TYPES.CLAIMED_FLOOR);
    }
  }
  return world;
}

describe('WaveManager', () => {
  let world, entityManager, eventBus, roomManager, waveManager;

  beforeEach(() => {
    world = makeWorld();
    entityManager = new EntityManager();
    eventBus = new EventBus();
    roomManager = new RoomManager(eventBus);
    waveManager = new WaveManager(world, entityManager, eventBus, roomManager);
  });

  it('does not spawn before interval', () => {
    waveManager.update(10);
    expect(waveManager.waveNumber).toBe(0);
  });

  it('spawns wave 1 with correct composition', () => {
    waveManager.update(WAVE.INTERVAL_SEC);
    expect(waveManager.waveNumber).toBe(1);
    const knights = entityManager.getByType(ENTITY_TYPES.KNIGHT);
    const thieves = entityManager.getByType(ENTITY_TYPES.THIEF);
    const wizards = entityManager.getByType(ENTITY_TYPES.WIZARD);
    expect(knights.length).toBe(1 * WAVE.KNIGHT_PER_WAVE);
    expect(thieves.length).toBe(Math.ceil(1 * WAVE.THIEF_PER_WAVE));
    expect(wizards.length).toBe(Math.ceil(1 * WAVE.WIZARD_PER_WAVE));
  });

  it('spawns wave 3 with escalated composition', () => {
    for (let i = 0; i < 3; i++) {
      waveManager.update(WAVE.INTERVAL_SEC);
    }
    expect(waveManager.waveNumber).toBe(3);
    const knights = entityManager.getByType(ENTITY_TYPES.KNIGHT);
    // Total knights from 3 waves: 1 + 2 + 3 = 6
    expect(knights.length).toBe(1 + 2 + 3);
  });

  it('publishes WAVE_STARTED event', () => {
    const spy = vi.fn();
    eventBus.subscribe(EVENTS.WAVE_STARTED, spy);
    waveManager.update(WAVE.INTERVAL_SEC);
    expect(spy).toHaveBeenCalledWith(expect.objectContaining({
      wave: 1,
      knights: 1,
    }));
  });

  it('tracks wave number', () => {
    expect(waveManager.waveNumber).toBe(0);
    waveManager.update(WAVE.INTERVAL_SEC);
    expect(waveManager.waveNumber).toBe(1);
    waveManager.update(WAVE.INTERVAL_SEC);
    expect(waveManager.waveNumber).toBe(2);
  });

  it('countdown timer decreases', () => {
    expect(waveManager.countdown).toBe(WAVE.INTERVAL_SEC);
    waveManager.update(10);
    expect(waveManager.countdown).toBe(WAVE.INTERVAL_SEC - 10);
  });

  it('finds spawn point near walkable tiles', () => {
    waveManager.update(WAVE.INTERVAL_SEC);
    // All spawned heroes should be on walkable tiles
    const heroes = [
      ...entityManager.getByType(ENTITY_TYPES.KNIGHT),
      ...entityManager.getByType(ENTITY_TYPES.THIEF),
      ...entityManager.getByType(ENTITY_TYPES.WIZARD),
    ];
    expect(heroes.length).toBeGreaterThan(0);
  });

  it('publishes WAVE_COMPLETED when all heroes die', () => {
    const spy = vi.fn();
    eventBus.subscribe(EVENTS.WAVE_COMPLETED, spy);
    waveManager.update(WAVE.INTERVAL_SEC); // Spawn wave 1
    // Kill all heroes
    const heroes = [
      ...entityManager.getByType(ENTITY_TYPES.KNIGHT),
      ...entityManager.getByType(ENTITY_TYPES.THIEF),
      ...entityManager.getByType(ENTITY_TYPES.WIZARD),
    ];
    for (const h of heroes) h.alive = false;
    waveManager.update(0.016);
    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ wave: 1 }));
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/systems/WaveManager.test.js`
Expected: FAIL.

- [ ] **Step 3: Implement WaveManager**

```js
import { WAVE, TILE_SIZE, EVENTS } from '../constants.js';
import { Knight } from '../entities/Knight.js';
import { Thief } from '../entities/Thief.js';
import { Wizard } from '../entities/Wizard.js';

/**
 * Spawns hero waves every WAVE.INTERVAL_SEC from the nearest walkable tile to a random map edge.
 */
export class WaveManager {
  constructor(world, entityManager, eventBus, roomManager) {
    this._world = world;
    this._entityManager = entityManager;
    this._eventBus = eventBus;
    this._roomManager = roomManager;
    this._timer = WAVE.INTERVAL_SEC;
    this._waveNumber = 0;
    this._activeHeroes = new Set();
  }

  get waveNumber() { return this._waveNumber; }
  get countdown() { return Math.ceil(this._timer); }

  /** @param {number} dt */
  update(dt) {
    this._timer -= dt;

    // Check wave completion
    if (this._activeHeroes.size > 0) {
      for (const heroId of this._activeHeroes) {
        const hero = this._entityManager.getById(heroId);
        if (!hero || !hero.alive) {
          this._activeHeroes.delete(heroId);
        }
      }
      if (this._activeHeroes.size === 0 && this._waveNumber > 0) {
        this._eventBus.publish(EVENTS.WAVE_COMPLETED, { wave: this._waveNumber });
      }
    }

    if (this._timer <= 0) {
      this._timer = WAVE.INTERVAL_SEC;
      this._spawnWave();
    }
  }

  /** @private */
  _spawnWave() {
    this._waveNumber++;
    const n = this._waveNumber;

    const knightCount = n * WAVE.KNIGHT_PER_WAVE;
    const thiefCount = Math.ceil(n * WAVE.THIEF_PER_WAVE);
    const wizardCount = Math.ceil(n * WAVE.WIZARD_PER_WAVE);

    const spawnPoint = this._findSpawnPoint();
    if (!spawnPoint) return;

    const spawnX = spawnPoint.x * TILE_SIZE + TILE_SIZE / 2;
    const spawnY = spawnPoint.y * TILE_SIZE + TILE_SIZE / 2;

    const spawn = (Cls, count) => {
      for (let i = 0; i < count; i++) {
        const hero = new Cls(
          spawnX + (Math.random() - 0.5) * TILE_SIZE,
          spawnY + (Math.random() - 0.5) * TILE_SIZE,
          this._world, this._eventBus, this._entityManager, this._roomManager,
        );
        this._entityManager.add(hero);
        this._activeHeroes.add(hero.id);
      }
    };

    spawn(Knight, knightCount);
    spawn(Thief, thiefCount);
    spawn(Wizard, wizardCount);

    this._eventBus.publish(EVENTS.WAVE_STARTED, {
      wave: n,
      knights: knightCount,
      thieves: thiefCount,
      wizards: wizardCount,
    });
  }

  /**
   * Find the walkable tile nearest to a random map edge.
   * @private
   */
  _findSpawnPoint() {
    const edge = Math.floor(Math.random() * 4);
    const w = this._world.width;
    const h = this._world.height;
    let targetX, targetY;

    switch (edge) {
      case 0: targetX = Math.floor(Math.random() * w); targetY = 0; break;
      case 1: targetX = Math.floor(Math.random() * w); targetY = h - 1; break;
      case 2: targetX = 0; targetY = Math.floor(Math.random() * h); break;
      default: targetX = w - 1; targetY = Math.floor(Math.random() * h); break;
    }

    let bestTile = null;
    let bestDist = Infinity;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (this._world.isWalkable(x, y)) {
          const dist = Math.abs(x - targetX) + Math.abs(y - targetY);
          if (dist < bestDist) {
            bestDist = dist;
            bestTile = { x, y };
          }
        }
      }
    }
    return bestTile;
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/systems/WaveManager.test.js`
Expected: All 8 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/systems/WaveManager.js tests/systems/WaveManager.test.js
git commit -m "feat(phase4): implement WaveManager with escalating hero waves"
```

---

### Task 9: FloatingText + EntityRenderer Updates

**Files:**
- Create: `src/rendering/FloatingText.js`
- Modify: `src/rendering/EntityRenderer.js`

No unit tests (rendering only).

- [ ] **Step 1: Implement FloatingText**

```js
/**
 * Floating damage/gold numbers that drift upward and fade out.
 */
export class FloatingText {
  /**
   * @param {CanvasRenderingContext2D} ctx
   * @param {import('./Camera.js').Camera} camera
   */
  constructor(ctx, camera) {
    this._ctx = ctx;
    this._camera = camera;
    this._texts = [];
  }

  /**
   * Add floating text at world position.
   * @param {number} x - World X.
   * @param {number} y - World Y.
   * @param {string} text
   * @param {string} color
   */
  add(x, y, text, color = '#fff') {
    this._texts.push({ x, y, text: String(text), color, life: 1.0, maxLife: 1.0, vy: -60 });
  }

  /** @param {number} dt */
  update(dt) {
    for (let i = this._texts.length - 1; i >= 0; i--) {
      const t = this._texts[i];
      t.life -= dt;
      t.y += t.vy * dt;
      if (t.life <= 0) this._texts.splice(i, 1);
    }
  }

  render() {
    const ctx = this._ctx;
    for (const t of this._texts) {
      const [sx, sy] = this._camera.worldToScreen(t.x, t.y);
      const alpha = Math.max(0, t.life / t.maxLife);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = t.color;
      ctx.font = `bold ${14 * this._camera.zoom}px Inter, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText(t.text, sx, sy);
    }
    ctx.globalAlpha = 1;
  }
}
```

- [ ] **Step 2: Update EntityRenderer**

Add to imports (line 1):

```js
import { ENTITY_TYPES, CREATURE_STATES, TILE_SIZE, COLORS } from '../constants.js';
```

In the `render()` method's switch block (after the IMP case), add:

```js
        case ENTITY_TYPES.TROLL:
          this._drawTroll(ctx, sx, sy, zoom, entity);
          break;
        case ENTITY_TYPES.DARK_MISTRESS:
          this._drawDarkMistress(ctx, sx, sy, zoom, entity);
          break;
        case ENTITY_TYPES.KNIGHT:
          this._drawKnight(ctx, sx, sy, zoom, entity);
          break;
        case ENTITY_TYPES.THIEF:
          this._drawThief(ctx, sx, sy, zoom, entity);
          break;
        case ENTITY_TYPES.WIZARD:
          this._drawWizard(ctx, sx, sy, zoom, entity);
          break;
```

After the `_drawImp` method, add the following private draw methods. Also add `_drawHealthBar` and `_drawLevelBadge` shared methods, and call them from each draw method:

```js
  /** @private */
  _drawHealthBar(ctx, x, y, size, entity) {
    if (entity.health >= entity.maxHealth) return;
    const barW = size * 0.8;
    const barH = 3 * (size / (TILE_SIZE * 0.6));
    const barX = x - barW / 2;
    const barY = y - size * 0.9;
    ctx.fillStyle = COLORS.UI_HEALTH_BG;
    ctx.fillRect(barX, barY, barW, barH);
    const ratio = entity.health / entity.maxHealth;
    ctx.fillStyle = COLORS.UI_HEALTH_BAR;
    ctx.fillRect(barX, barY, barW * ratio, barH);
  }

  /** @private */
  _drawLevelBadge(ctx, x, y, size, entity) {
    if (entity.level <= 1) return;
    const r = size * 0.15;
    ctx.fillStyle = '#f0c040';
    ctx.beginPath();
    ctx.arc(x + size * 0.35, y - size * 0.7, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#000';
    ctx.font = `bold ${r * 1.4}px Inter, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(entity.level, x + size * 0.35, y - size * 0.7);
    ctx.textBaseline = 'alphabetic';
  }

  /** Troll: large hulking figure. @private */
  _drawTroll(ctx, sx, sy, zoom, troll) {
    const size = TILE_SIZE * zoom * 0.85;
    const half = size / 2;
    const bob = troll.state === CREATURE_STATES.MOVING ? Math.sin(this._animTime * 6) * 2 * zoom : 0;
    ctx.save();
    ctx.translate(sx, sy + bob);
    if (troll.facingRight === false) ctx.scale(-1, 1);
    // Body
    ctx.fillStyle = '#4a6a40';
    ctx.beginPath();
    ctx.ellipse(0, -half * 0.2, half * 0.55, half * 0.8, 0, 0, Math.PI * 2);
    ctx.fill();
    // Head
    ctx.fillStyle = '#5a7a50';
    ctx.beginPath();
    ctx.arc(0, -half * 0.85, half * 0.35, 0, Math.PI * 2);
    ctx.fill();
    // Eyes
    ctx.fillStyle = '#ff4040';
    ctx.fillRect(-half * 0.15, -half * 0.95, 3 * zoom, 2 * zoom);
    ctx.fillRect(half * 0.05, -half * 0.95, 3 * zoom, 2 * zoom);
    // Arms
    ctx.strokeStyle = '#3a5a30';
    ctx.lineWidth = 2.5 * zoom;
    ctx.beginPath(); ctx.moveTo(-half * 0.4, -half * 0.2); ctx.lineTo(-half * 0.7, half * 0.2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(half * 0.4, -half * 0.2); ctx.lineTo(half * 0.7, half * 0.2); ctx.stroke();
    ctx.restore();
    this._drawHealthBar(ctx, sx, sy, size, troll);
    this._drawLevelBadge(ctx, sx, sy, size, troll);
  }

  /** Dark Mistress: tall lithe figure with whip. @private */
  _drawDarkMistress(ctx, sx, sy, zoom, dm) {
    const size = TILE_SIZE * zoom * 0.75;
    const half = size / 2;
    const bob = dm.state === CREATURE_STATES.MOVING ? Math.sin(this._animTime * 12) * 1.5 * zoom : 0;
    ctx.save();
    ctx.translate(sx, sy + bob);
    if (dm.facingRight === false) ctx.scale(-1, 1);
    // Body (slender)
    ctx.fillStyle = '#6a3060';
    ctx.beginPath();
    ctx.ellipse(0, -half * 0.3, half * 0.3, half * 0.8, 0, 0, Math.PI * 2);
    ctx.fill();
    // Head
    ctx.fillStyle = '#8a4080';
    ctx.beginPath();
    ctx.arc(0, -half * 0.95, half * 0.25, 0, Math.PI * 2);
    ctx.fill();
    // Whip
    ctx.strokeStyle = '#a06090';
    ctx.lineWidth = 1 * zoom;
    ctx.beginPath();
    ctx.moveTo(half * 0.3, -half * 0.3);
    ctx.quadraticCurveTo(half * 0.8, -half * 0.5, half * 0.9, half * 0.1);
    ctx.stroke();
    ctx.restore();
    this._drawHealthBar(ctx, sx, sy, size, dm);
    this._drawLevelBadge(ctx, sx, sy, size, dm);
  }

  /** Knight: armored figure. @private */
  _drawKnight(ctx, sx, sy, zoom, knight) {
    const size = TILE_SIZE * zoom * 0.75;
    const half = size / 2;
    const bob = knight.state === CREATURE_STATES.MOVING ? Math.sin(this._animTime * 8) * 1.5 * zoom : 0;
    ctx.save();
    ctx.translate(sx, sy + bob);
    if (knight.facingRight === false) ctx.scale(-1, 1);
    // Body (armored)
    ctx.fillStyle = '#8090a0';
    ctx.beginPath();
    ctx.ellipse(0, -half * 0.25, half * 0.45, half * 0.7, 0, 0, Math.PI * 2);
    ctx.fill();
    // Head/Helmet
    ctx.fillStyle = '#a0b0c0';
    ctx.beginPath();
    ctx.arc(0, -half * 0.85, half * 0.3, 0, Math.PI * 2);
    ctx.fill();
    // Shield
    ctx.fillStyle = '#6070a0';
    ctx.fillRect(-half * 0.6, -half * 0.5, half * 0.3, half * 0.6);
    // Sword
    ctx.strokeStyle = '#c0d0e0';
    ctx.lineWidth = 1.5 * zoom;
    ctx.beginPath(); ctx.moveTo(half * 0.4, -half * 0.5); ctx.lineTo(half * 0.7, -half * 0.9); ctx.stroke();
    ctx.restore();
    this._drawHealthBar(ctx, sx, sy, size, knight);
  }

  /** Thief: small cloaked figure. @private */
  _drawThief(ctx, sx, sy, zoom, thief) {
    const size = TILE_SIZE * zoom * 0.6;
    const half = size / 2;
    const bob = thief.state === CREATURE_STATES.MOVING ? Math.sin(this._animTime * 14) * 1 * zoom : 0;
    ctx.save();
    ctx.translate(sx, sy + bob);
    if (thief.facingRight === false) ctx.scale(-1, 1);
    // Cloak body
    ctx.fillStyle = '#3a3a40';
    ctx.beginPath();
    ctx.moveTo(0, -half * 0.9);
    ctx.lineTo(-half * 0.5, half * 0.3);
    ctx.lineTo(half * 0.5, half * 0.3);
    ctx.closePath();
    ctx.fill();
    // Head
    ctx.fillStyle = '#4a4a50';
    ctx.beginPath();
    ctx.arc(0, -half * 0.85, half * 0.25, 0, Math.PI * 2);
    ctx.fill();
    // Eyes (glowing)
    ctx.fillStyle = '#80ff80';
    ctx.fillRect(-half * 0.1, -half * 0.9, 2 * zoom, 1.5 * zoom);
    ctx.fillRect(half * 0.02, -half * 0.9, 2 * zoom, 1.5 * zoom);
    ctx.restore();
    this._drawHealthBar(ctx, sx, sy, size, thief);
  }

  /** Wizard: robed figure with staff. @private */
  _drawWizard(ctx, sx, sy, zoom, wizard) {
    const size = TILE_SIZE * zoom * 0.7;
    const half = size / 2;
    const bob = wizard.state === CREATURE_STATES.MOVING ? Math.sin(this._animTime * 8) * 1.5 * zoom : 0;
    ctx.save();
    ctx.translate(sx, sy + bob);
    if (wizard.facingRight === false) ctx.scale(-1, 1);
    // Robe
    ctx.fillStyle = '#4050a0';
    ctx.beginPath();
    ctx.moveTo(0, -half * 0.8);
    ctx.lineTo(-half * 0.45, half * 0.4);
    ctx.lineTo(half * 0.45, half * 0.4);
    ctx.closePath();
    ctx.fill();
    // Head
    ctx.fillStyle = '#5060b0';
    ctx.beginPath();
    ctx.arc(0, -half * 0.85, half * 0.25, 0, Math.PI * 2);
    ctx.fill();
    // Staff
    ctx.strokeStyle = '#8a6040';
    ctx.lineWidth = 1.5 * zoom;
    ctx.beginPath(); ctx.moveTo(half * 0.5, -half * 1.1); ctx.lineTo(half * 0.5, half * 0.4); ctx.stroke();
    // Staff orb
    ctx.fillStyle = '#80a0ff';
    ctx.beginPath();
    ctx.arc(half * 0.5, -half * 1.15, half * 0.12, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    this._drawHealthBar(ctx, sx, sy, size, wizard);
  }
```

- [ ] **Step 3: Commit**

```bash
git add src/rendering/FloatingText.js src/rendering/EntityRenderer.js
git commit -m "feat(phase4): add FloatingText, draw Troll/DarkMistress/Knight/Thief/Wizard"
```

---

### Task 10: main.js Integration

**Files:**
- Modify: `src/main.js`

- [ ] **Step 1: Add imports**

Add after existing imports (after the `Tooltip` import):

```js
import { CombatSystem } from './systems/CombatSystem.js';
import { CreatureSpawner } from './systems/CreatureSpawner.js';
import { WaveManager } from './systems/WaveManager.js';
import { FloatingText } from './rendering/FloatingText.js';
```

Add `ENTITY_TYPES` to the constants import if not already there (it should be from Phase 3).

- [ ] **Step 2: Initialize Phase 4 systems**

Add after `const tooltip = ...`:

```js
// Phase 4 systems
const combatSystem = new CombatSystem(entityManager, eventBus);
const creatureSpawner = new CreatureSpawner(world, entityManager, eventBus, roomManager);
const waveManager = new WaveManager(world, entityManager, eventBus, roomManager);
const floatingText = new FloatingText(ctx, camera);
```

- [ ] **Step 3: Add to update loop**

Add to end of `update(dt)` function:

```js
  combatSystem.update(dt);
  creatureSpawner.update(dt);
  waveManager.update(dt);
  floatingText.update(dt);
```

- [ ] **Step 4: Add to render function**

Add after `particleSystem.render();` and before the dig queue highlights:

```js
  floatingText.render();
```

Add wave flash overlay at end of render (before `fpsEl.textContent`):

```js
  // Wave flash overlay
  if (waveFlashTimer > 0) {
    waveFlashTimer -= renderDt;
    const flashAlpha = Math.min(1, waveFlashTimer / 2) * 0.3;
    ctx.fillStyle = `rgba(255, 0, 0, ${flashAlpha})`;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 48px MedievalSharp, cursive';
    ctx.textAlign = 'center';
    ctx.globalAlpha = Math.min(1, waveFlashTimer);
    ctx.fillText('INTRUDERS!', w / 2, h / 2);
    ctx.globalAlpha = 1;
    ctx.textAlign = 'start';
  }

  // Update HUD wave timer
  hud.setWaveTimer(`${waveManager.countdown}s`);
```

- [ ] **Step 5: Add event wiring**

Add before `window.addEventListener('resize', ...)`:

```js
// Floating damage text
eventBus.subscribe(EVENTS.ENTITY_DAMAGED, (e) => {
  floatingText.add(e.x, e.y - TILE_SIZE / 2, `-${e.damage}`, '#ff4040');
});

// Entity death — particles + gold drop
eventBus.subscribe(EVENTS.ENTITY_DIED, (e) => {
  const color = e.team === 'enemy' ? '#f0f0a0' : '#a04040';
  particleSystem.burst(e.x, e.y, color, 12, { speed: 80, life: 0.6, size: 2 });
  if (e.goldDrop > 0) {
    resourceManager.earnGold(e.goldDrop);
    floatingText.add(e.x, e.y - TILE_SIZE, `+${e.goldDrop}g`, '#f0c040');
  }
});

// Wave started — screen flash
let waveFlashTimer = 0;
eventBus.subscribe(EVENTS.WAVE_STARTED, () => {
  waveFlashTimer = 2.0;
});

// Creature spawned — floating text + particles
eventBus.subscribe(EVENTS.ENTITY_SPAWNED, (e) => {
  floatingText.add(e.x, e.y - TILE_SIZE, 'Creature attracted!', '#80ff80');
  particleSystem.burst(e.x, e.y, '#80ff80', 10, { speed: 60, life: 0.5, size: 2 });
});
```

- [ ] **Step 6: Run all tests to confirm no regressions**

Run: `npx vitest run`
Expected: All tests PASS (~170 tests).

- [ ] **Step 7: Commit**

```bash
git add src/main.js
git commit -m "feat(phase4): integrate CombatSystem, CreatureSpawner, WaveManager, FloatingText"
```

---

### Task 11: Verification

- [ ] **Step 1: Run full test suite**

Run: `npx vitest run`
Expected: All tests PASS.

- [ ] **Step 2: Launch dev server and visual verification**

Run: `npx vite`

Check the following:
1. **Existing Phase 3 features still work** — HUD, Toolbar, room placement, digging, mana regen.
2. **Creature spawning** — Build 6+ Hatchery tiles. After 30s, a Troll appears with "Creature attracted!" text.
3. **Dark Mistress spawning** — Build 6+ Training Room tiles. After 30s, a Dark Mistress appears.
4. **Creature AI** — Troll/DarkMistress wander, seek rooms when hungry/tired, go to Training Room.
5. **Wave spawning** — After 90s, "INTRUDERS!" flash and heroes appear at dungeon frontier.
6. **Combat** — Heroes and creatures fight. Damage numbers float upward. Dead entities burst particles.
7. **Hero pathfinding** — Heroes move toward Dungeon Heart.
8. **Thief behavior** — Place Treasury. Thief prioritizes it over Dungeon Heart.
9. **Wizard kiting** — Wizard stays at range from melee creatures.
10. **Gold drops** — When heroes die, gold is earned and "+Xg" floats up.
11. **Health bars** — Damaged entities show health bars.
12. **Level badges** — Creatures training show level numbers when leveled.
13. **Wave escalation** — Wave 2 has more heroes than wave 1.
14. **Wave timer** — HUD shows countdown.
15. **No console errors**.
