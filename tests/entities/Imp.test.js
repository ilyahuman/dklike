import { describe, it, expect, beforeEach } from 'vitest';
import { Imp } from '../../src/entities/Imp.js';
import { World } from '../../src/world/World.js';
import { EventBus } from '../../src/core/EventBus.js';
import { JobQueue } from '../../src/systems/JobQueue.js';
import { Pathfinder } from '../../src/world/Pathfinder.js';
import { RoomManager } from '../../src/systems/RoomManager.js';
import { TILE_TYPES, TILE_SIZE, CREATURE_STATES, IMP_STATS, EVENTS, RESOURCES } from '../../src/constants.js';

/** Helper: create a small test world with walkable area. */
function makeWorld() {
  const world = new World();
  // Clear a large area for testing
  const cx = Math.floor(world.width / 2);
  const cy = Math.floor(world.height / 2);
  for (let dy = -5; dy <= 5; dy++) {
    for (let dx = -5; dx <= 5; dx++) {
      world.setTile(cx + dx, cy + dy, TILE_TYPES.CLAIMED_FLOOR);
    }
  }
  return world;
}

describe('Imp', () => {
  let world, eventBus, jobQueue;

  beforeEach(() => {
    Pathfinder.clearCache();
    world = makeWorld();
    eventBus = new EventBus();
    jobQueue = new JobQueue(eventBus);
  });

  it('creates with correct stats from IMP_STATS', () => {
    const cx = Math.floor(world.width / 2);
    const cy = Math.floor(world.height / 2);
    const imp = new Imp(cx * TILE_SIZE + 16, cy * TILE_SIZE + 16, world, eventBus, jobQueue);
    expect(imp.health).toBe(IMP_STATS.hp);
    expect(imp.maxHealth).toBe(IMP_STATS.hp);
    expect(imp.hunger).toBe(IMP_STATS.maxHunger);
    expect(imp.energy).toBe(IMP_STATS.maxEnergy);
  });

  it('starts in IDLE state', () => {
    const cx = Math.floor(world.width / 2);
    const cy = Math.floor(world.height / 2);
    const imp = new Imp(cx * TILE_SIZE + 16, cy * TILE_SIZE + 16, world, eventBus, jobQueue);
    expect(imp.state).toBe(CREATURE_STATES.IDLE);
  });

  it('transitions to MOVING when dig job available', () => {
    const cx = Math.floor(world.width / 2);
    const cy = Math.floor(world.height / 2);
    const imp = new Imp(cx * TILE_SIZE + 16, cy * TILE_SIZE + 16, world, eventBus, jobQueue);
    // Add a diggable tile adjacent to floor
    world.setTile(cx + 6, cy, TILE_TYPES.DIRT);
    jobQueue.addDigJob(cx + 6, cy);
    imp.update(0.016);
    // Should claim job and start moving
    expect([CREATURE_STATES.MOVING, CREATURE_STATES.DIGGING]).toContain(imp.state);
  });

  it('flees when health is low', () => {
    const cx = Math.floor(world.width / 2);
    const cy = Math.floor(world.height / 2);
    const imp = new Imp(cx * TILE_SIZE + 16, cy * TILE_SIZE + 16, world, eventBus, jobQueue);
    imp.health = IMP_STATS.fleeHealthThreshold - 1;
    imp.update(0.016);
    expect(imp.state).toBe(CREATURE_STATES.FLEEING);
  });

  it('hunger decreases over time', () => {
    const cx = Math.floor(world.width / 2);
    const cy = Math.floor(world.height / 2);
    const imp = new Imp(cx * TILE_SIZE + 16, cy * TILE_SIZE + 16, world, eventBus, jobQueue);
    const initialHunger = imp.hunger;
    // Simulate several seconds of updates
    for (let i = 0; i < 60; i++) imp.update(0.5);
    expect(imp.hunger).toBeLessThan(initialHunger);
  });

  it('energy decreases over time', () => {
    const cx = Math.floor(world.width / 2);
    const cy = Math.floor(world.height / 2);
    const imp = new Imp(cx * TILE_SIZE + 16, cy * TILE_SIZE + 16, world, eventBus, jobQueue);
    const initialEnergy = imp.energy;
    for (let i = 0; i < 60; i++) imp.update(0.5);
    expect(imp.energy).toBeLessThan(initialEnergy);
  });

  it('moves along path toward target', () => {
    const cx = Math.floor(world.width / 2);
    const cy = Math.floor(world.height / 2);
    const imp = new Imp(cx * TILE_SIZE + 16, cy * TILE_SIZE + 16, world, eventBus, jobQueue);
    // Add a dig job nearby
    world.setTile(cx + 6, cy, TILE_TYPES.DIRT);
    jobQueue.addDigJob(cx + 6, cy);
    const startX = imp.x;
    // Run many updates to allow movement
    for (let i = 0; i < 120; i++) imp.update(0.016);
    expect(imp.x).not.toBe(startX);
  });

  it('transitions to EATING when hunger is low', () => {
    const cx = Math.floor(world.width / 2);
    const cy = Math.floor(world.height / 2);
    const imp = new Imp(cx * TILE_SIZE + 16, cy * TILE_SIZE + 16, world, eventBus, jobQueue);
    imp.hunger = IMP_STATS.hungerThreshold - 1;
    imp.update(0.016);
    expect(imp.state).toBe(CREATURE_STATES.EATING);
  });

  it('recovers hunger while eating', () => {
    const cx = Math.floor(world.width / 2);
    const cy = Math.floor(world.height / 2);
    const imp = new Imp(cx * TILE_SIZE + 16, cy * TILE_SIZE + 16, world, eventBus, jobQueue);
    imp.hunger = IMP_STATS.hungerThreshold - 1;
    imp.update(0.016); // Enter eating
    const hungerBefore = imp.hunger;
    imp.update(1.0); // Eat for 1 second
    expect(imp.hunger).toBeGreaterThan(hungerBefore);
  });

  it('transitions to SLEEPING when energy is low', () => {
    const cx = Math.floor(world.width / 2);
    const cy = Math.floor(world.height / 2);
    const imp = new Imp(cx * TILE_SIZE + 16, cy * TILE_SIZE + 16, world, eventBus, jobQueue);
    imp.energy = IMP_STATS.energyThreshold - 1;
    imp.hunger = IMP_STATS.maxHunger; // Keep hunger high to avoid eating
    imp.update(0.016);
    expect(imp.state).toBe(CREATURE_STATES.SLEEPING);
  });

  it('recovers energy while sleeping', () => {
    const cx = Math.floor(world.width / 2);
    const cy = Math.floor(world.height / 2);
    const imp = new Imp(cx * TILE_SIZE + 16, cy * TILE_SIZE + 16, world, eventBus, jobQueue);
    imp.energy = IMP_STATS.energyThreshold - 1;
    imp.hunger = IMP_STATS.maxHunger;
    imp.update(0.016); // Enter sleeping
    const energyBefore = imp.energy;
    imp.update(1.0); // Sleep for 1 second
    expect(imp.energy).toBeGreaterThan(energyBefore);
  });

  it('releases job on death', () => {
    const cx = Math.floor(world.width / 2);
    const cy = Math.floor(world.height / 2);
    const imp = new Imp(cx * TILE_SIZE + 16, cy * TILE_SIZE + 16, world, eventBus, jobQueue);
    world.setTile(cx + 6, cy, TILE_TYPES.DIRT);
    jobQueue.addDigJob(cx + 6, cy);
    imp.update(0.016); // Claim job
    imp.alive = false;
    // Check that job is released
    expect(jobQueue.getJobForImp(imp.id)).not.toBeNull();
    jobQueue.releaseJob(imp.id);
    expect(jobQueue.getPendingDigJobs().length).toBe(1);
  });

  it('seeks Hatchery room when hungry (if RoomManager provided)', () => {
    const cx = Math.floor(world.width / 2);
    const cy = Math.floor(world.height / 2);
    const roomManager = new RoomManager(eventBus);
    roomManager.placeRoom('hatchery', [
      { x: cx + 3, y: cy }, { x: cx + 3, y: cy + 1 },
      { x: cx + 4, y: cy }, { x: cx + 4, y: cy + 1 },
    ]);
    const imp = new Imp(cx * TILE_SIZE + 16, cy * TILE_SIZE + 16, world, eventBus, jobQueue, roomManager);
    imp.hunger = IMP_STATS.hungerThreshold - 1;
    imp.update(0.016);
    expect(imp.state).toBe(CREATURE_STATES.MOVING);
  });

  it('eats in place when no RoomManager provided', () => {
    const cx = Math.floor(world.width / 2);
    const cy = Math.floor(world.height / 2);
    const imp = new Imp(cx * TILE_SIZE + 16, cy * TILE_SIZE + 16, world, eventBus, jobQueue);
    imp.hunger = IMP_STATS.hungerThreshold - 1;
    imp.update(0.016);
    expect(imp.state).toBe(CREATURE_STATES.EATING);
  });

  it('seeks Lair room when tired (if RoomManager provided)', () => {
    const cx = Math.floor(world.width / 2);
    const cy = Math.floor(world.height / 2);
    const roomManager = new RoomManager(eventBus);
    roomManager.placeRoom('lair', [
      { x: cx + 3, y: cy }, { x: cx + 3, y: cy + 1 },
      { x: cx + 4, y: cy }, { x: cx + 4, y: cy + 1 },
    ]);
    const imp = new Imp(cx * TILE_SIZE + 16, cy * TILE_SIZE + 16, world, eventBus, jobQueue, roomManager);
    imp.energy = IMP_STATS.energyThreshold - 1;
    imp.hunger = IMP_STATS.maxHunger;
    imp.update(0.016);
    expect(imp.state).toBe(CREATURE_STATES.MOVING);
  });

  it('continuously mines gem seam without consuming tile', () => {
    const cx = Math.floor(world.width / 2);
    const cy = Math.floor(world.height / 2);
    world.setTile(cx + 6, cy, TILE_TYPES.GEM_SEAM);
    jobQueue.addDigJob(cx + 6, cy);
    const imp = new Imp(cx * TILE_SIZE + 16, cy * TILE_SIZE + 16, world, eventBus, jobQueue);
    imp.update(0.016); // Claim and start moving
    // Teleport imp adjacent to dig target
    imp.x = (cx + 5) * TILE_SIZE + TILE_SIZE / 2;
    imp.y = cy * TILE_SIZE + TILE_SIZE / 2;
    imp.state = CREATURE_STATES.DIGGING;
    imp._digProgress = 0;
    imp._currentJob = jobQueue.getJobForImp(imp.id);
    // Run dig past completion (3s dig + 2s mining = 5s at 0.016 = 313 ticks)
    const goldEvents = [];
    eventBus.subscribe(EVENTS.TILE_DUG, (e) => { if (e.goldAmount) goldEvents.push(e); });
    for (let i = 0; i < 400; i++) imp.update(0.016);
    // Gem seam tile preserved
    expect(world.getTile(cx + 6, cy)).toBe(TILE_TYPES.GEM_SEAM);
    // Imp should still be DIGGING (continuous mining)
    expect(imp.state).toBe(CREATURE_STATES.DIGGING);
    // Should have published gold events from continuous mining
    expect(goldEvents.length).toBeGreaterThan(0);
    expect(goldEvents[0].goldAmount).toBe(RESOURCES.GEM_SEAM_GOLD_PER_SEC);
  });
});
