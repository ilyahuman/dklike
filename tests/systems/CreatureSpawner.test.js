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
    const tiles = [];
    for (let i = 0; i < 6; i++) tiles.push({ x: cx + i - 3, y: cy + 5 });
    roomManager.placeRoom(ROOM_TYPES.HATCHERY, tiles);
    spawner.update(1.0);
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
