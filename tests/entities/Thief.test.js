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
    roomManager.placeRoom(ROOM_TYPES.TREASURY, [
      { x: cx, y: cy + 5 }, { x: cx + 1, y: cy + 5 },
      { x: cx, y: cy + 6 }, { x: cx + 1, y: cy + 6 },
    ]);
    const thief = new Thief((cx + 8) * TILE_SIZE + 16, cy * TILE_SIZE + 16, world, eventBus, entityManager, roomManager);
    thief._repathTimer = 999;
    thief.update(0.016);
    expect(thief._path).not.toBeNull();
  });

  it('falls back to Dungeon Heart when no Treasury', () => {
    const cx = Math.floor(world.width / 2);
    const cy = Math.floor(world.height / 2);
    const thief = new Thief((cx + 8) * TILE_SIZE + 16, cy * TILE_SIZE + 16, world, eventBus, entityManager, roomManager);
    expect(thief._path).not.toBeNull();
  });
});
