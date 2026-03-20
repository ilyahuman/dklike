import { describe, it, expect } from 'vitest';
import { MapGenerator } from '../../src/world/MapGenerator.js';
import { World } from '../../src/world/World.js';
import { TILE_TYPES, MAP_WIDTH, MAP_HEIGHT, MAP_GEN } from '../../src/constants.js';

describe('MapGenerator', () => {
  it('fills border with ROCK', () => {
    const world = new World();
    MapGenerator.generate(world, 12345);
    for (let x = 0; x < MAP_WIDTH; x++) {
      expect(world.getTile(x, 0)).toBe(TILE_TYPES.ROCK);
      expect(world.getTile(x, MAP_HEIGHT - 1)).toBe(TILE_TYPES.ROCK);
    }
    for (let y = 0; y < MAP_HEIGHT; y++) {
      expect(world.getTile(0, y)).toBe(TILE_TYPES.ROCK);
      expect(world.getTile(MAP_WIDTH - 1, y)).toBe(TILE_TYPES.ROCK);
    }
  });

  it('fills interior with DIRT', () => {
    const world = new World();
    MapGenerator.generate(world, 12345);
    let dirtCount = 0;
    for (let y = 1; y < MAP_HEIGHT - 1; y++) {
      for (let x = 1; x < MAP_WIDTH - 1; x++) {
        if (world.getTile(x, y) === TILE_TYPES.DIRT) dirtCount++;
      }
    }
    expect(dirtCount).toBeGreaterThan((MAP_WIDTH - 2) * (MAP_HEIGHT - 2) * 0.7);
  });

  it('places dungeon heart at center as claimed floor', () => {
    const world = new World();
    MapGenerator.generate(world, 12345);
    const cx = Math.floor(MAP_WIDTH / 2);
    const cy = Math.floor(MAP_HEIGHT / 2);
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        expect(world.getTile(cx + dx, cy + dy)).toBe(TILE_TYPES.CLAIMED_FLOOR);
      }
    }
  });

  it('places gold veins within range', () => {
    const world = new World();
    MapGenerator.generate(world, 12345);
    let goldCount = 0;
    for (let y = 0; y < MAP_HEIGHT; y++) {
      for (let x = 0; x < MAP_WIDTH; x++) {
        if (world.getTile(x, y) === TILE_TYPES.GOLD_VEIN) goldCount++;
      }
    }
    expect(goldCount).toBeGreaterThanOrEqual(MAP_GEN.GOLD_VEIN_MIN);
    expect(goldCount).toBeLessThanOrEqual(MAP_GEN.GOLD_VEIN_MAX * 4);
  });

  it('places gem seams', () => {
    const world = new World();
    MapGenerator.generate(world, 12345);
    let gemCount = 0;
    for (let y = 0; y < MAP_HEIGHT; y++) {
      for (let x = 0; x < MAP_WIDTH; x++) {
        if (world.getTile(x, y) === TILE_TYPES.GEM_SEAM) gemCount++;
      }
    }
    expect(gemCount).toBeGreaterThanOrEqual(MAP_GEN.GEM_SEAM_MIN);
  });

  it('places lava pools', () => {
    const world = new World();
    MapGenerator.generate(world, 12345);
    let lavaCount = 0;
    for (let y = 0; y < MAP_HEIGHT; y++) {
      for (let x = 0; x < MAP_WIDTH; x++) {
        if (world.getTile(x, y) === TILE_TYPES.LAVA) lavaCount++;
      }
    }
    expect(lavaCount).toBeGreaterThanOrEqual(1);
  });

  it('places water channels', () => {
    const world = new World();
    MapGenerator.generate(world, 12345);
    let waterCount = 0;
    for (let y = 0; y < MAP_HEIGHT; y++) {
      for (let x = 0; x < MAP_WIDTH; x++) {
        if (world.getTile(x, y) === TILE_TYPES.WATER) waterCount++;
      }
    }
    expect(waterCount).toBeGreaterThanOrEqual(1);
  });

  it('same seed produces same map', () => {
    const w1 = new World();
    const w2 = new World();
    MapGenerator.generate(w1, 42);
    MapGenerator.generate(w2, 42);
    for (let i = 0; i < w1.tiles.length; i++) {
      expect(w1.tiles[i]).toBe(w2.tiles[i]);
    }
  });

  it('different seed produces different map', () => {
    const w1 = new World();
    const w2 = new World();
    MapGenerator.generate(w1, 100);
    MapGenerator.generate(w2, 200);
    let differences = 0;
    for (let i = 0; i < w1.tiles.length; i++) {
      if (w1.tiles[i] !== w2.tiles[i]) differences++;
    }
    expect(differences).toBeGreaterThan(0);
  });
});
