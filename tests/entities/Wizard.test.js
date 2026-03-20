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
    const melee = new Entity('troll', cx * TILE_SIZE + TILE_SIZE + 16, cy * TILE_SIZE + 16);
    melee.team = 'player';
    melee.health = 100;
    melee.maxHealth = 100;
    melee.attackRange = 1.2;
    entityManager.add(melee);
    const startX = wiz.x;
    for (let i = 0; i < 30; i++) wiz.update(0.016);
    expect(Math.abs(wiz.x - melee.x)).toBeGreaterThan(Math.abs(startX - melee.x));
  });
});
