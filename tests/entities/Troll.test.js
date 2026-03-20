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
    troll.hunger = 25;
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
    troll.energy = 15;
    troll.hunger = 100;
    troll.update(0.016);
    expect(troll.state).toBe(CREATURE_STATES.MOVING);
  });

  it('approaches enemy when detected', () => {
    const cx = Math.floor(world.width / 2);
    const cy = Math.floor(world.height / 2);
    const troll = new Troll(cx * TILE_SIZE + 16, cy * TILE_SIZE + 16, world, eventBus, entityManager, roomManager);
    entityManager.add(troll);
    const enemy = new Entity('knight', (cx + 5) * TILE_SIZE + 16, cy * TILE_SIZE + 16);
    enemy.team = 'enemy';
    enemy.health = 100;
    enemy.maxHealth = 100;
    entityManager.add(enemy);
    troll.update(0.016);
    expect([CREATURE_STATES.MOVING, CREATURE_STATES.ATTACKING]).toContain(troll.state);
  });
});
