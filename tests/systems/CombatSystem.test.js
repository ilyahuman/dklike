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
    combat.update(0.01);
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
    combat.update(COMBAT_TICK_MS / 1000);
    const healthAfterFirst = b.health;
    combat.update(COMBAT_TICK_MS / 1000);
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
    a.damage = 200;
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
