import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WaveManager } from '../../src/systems/WaveManager.js';
import { World } from '../../src/world/World.js';
import { EntityManager } from '../../src/entities/EntityManager.js';
import { EventBus } from '../../src/core/EventBus.js';
import { RoomManager } from '../../src/systems/RoomManager.js';
import { TILE_TYPES, ENTITY_TYPES, EVENTS, WAVE, TILE_SIZE } from '../../src/constants.js';

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
    const heroes = [
      ...entityManager.getByType(ENTITY_TYPES.KNIGHT),
      ...entityManager.getByType(ENTITY_TYPES.THIEF),
      ...entityManager.getByType(ENTITY_TYPES.WIZARD),
    ];
    expect(heroes.length).toBeGreaterThan(0);
  });

  it('spawns heroes at map edge tiles', () => {
    waveManager.update(WAVE.INTERVAL_SEC);
    const heroes = [
      ...entityManager.getByType(ENTITY_TYPES.KNIGHT),
      ...entityManager.getByType(ENTITY_TYPES.THIEF),
      ...entityManager.getByType(ENTITY_TYPES.WIZARD),
    ];
    expect(heroes.length).toBeGreaterThan(0);
    for (const hero of heroes) {
      const tx = Math.floor(hero.x / TILE_SIZE);
      const ty = Math.floor(hero.y / TILE_SIZE);
      const onEdge = tx <= 1 || ty <= 1 || tx >= world.width - 2 || ty >= world.height - 2;
      expect(onEdge).toBe(true);
    }
  });

  it('publishes WAVE_COMPLETED when all heroes die', () => {
    const spy = vi.fn();
    eventBus.subscribe(EVENTS.WAVE_COMPLETED, spy);
    waveManager.update(WAVE.INTERVAL_SEC);
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
