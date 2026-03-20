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
    for (let i = 0; i < Math.ceil(WAVE.REPATH_INTERVAL_SEC / 0.016); i++) {
      knight.update(0.016);
    }
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
