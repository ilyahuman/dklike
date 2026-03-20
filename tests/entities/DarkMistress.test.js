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
