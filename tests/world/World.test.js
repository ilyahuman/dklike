import { describe, it, expect } from 'vitest';
import { World } from '../../src/world/World.js';
import { TILE_TYPES, MAP_WIDTH, MAP_HEIGHT } from '../../src/constants.js';

describe('World', () => {
  it('creates a grid of correct dimensions', () => {
    const world = new World();
    expect(world.width).toBe(MAP_WIDTH);
    expect(world.height).toBe(MAP_HEIGHT);
  });

  it('initializes all tiles to ROCK', () => {
    const world = new World();
    expect(world.getTile(0, 0)).toBe(TILE_TYPES.ROCK);
    expect(world.getTile(40, 30)).toBe(TILE_TYPES.ROCK);
  });

  it('setTile and getTile round-trip', () => {
    const world = new World();
    world.setTile(5, 5, TILE_TYPES.DIRT);
    expect(world.getTile(5, 5)).toBe(TILE_TYPES.DIRT);
  });

  it('getTile returns null for out-of-bounds', () => {
    const world = new World();
    expect(world.getTile(-1, 0)).toBeNull();
    expect(world.getTile(MAP_WIDTH, 0)).toBeNull();
    expect(world.getTile(0, MAP_HEIGHT)).toBeNull();
  });

  it('getNeighbors returns 4 cardinal neighbors', () => {
    const world = new World();
    const neighbors = world.getNeighbors(5, 5);
    expect(neighbors).toHaveLength(4);
    const coords = neighbors.map(n => `${n.x},${n.y}`);
    expect(coords).toContain('4,5');
    expect(coords).toContain('6,5');
    expect(coords).toContain('5,4');
    expect(coords).toContain('5,6');
  });

  it('getNeighbors excludes out-of-bounds at corner', () => {
    const world = new World();
    const neighbors = world.getNeighbors(0, 0);
    expect(neighbors).toHaveLength(2);
  });

  it('isWalkable returns true for floor tiles', () => {
    const world = new World();
    world.setTile(3, 3, TILE_TYPES.CLAIMED_FLOOR);
    expect(world.isWalkable(3, 3)).toBe(true);
    world.setTile(3, 3, TILE_TYPES.UNCLAIMED_FLOOR);
    expect(world.isWalkable(3, 3)).toBe(true);
  });

  it('isWalkable returns false for solid tiles', () => {
    const world = new World();
    expect(world.isWalkable(3, 3)).toBe(false);
  });

  it('isDiggable returns true for dirt and ore', () => {
    const world = new World();
    world.setTile(3, 3, TILE_TYPES.DIRT);
    expect(world.isDiggable(3, 3)).toBe(true);
    world.setTile(3, 3, TILE_TYPES.GOLD_VEIN);
    expect(world.isDiggable(3, 3)).toBe(true);
  });

  it('isDiggable returns false for rock and floor', () => {
    const world = new World();
    expect(world.isDiggable(3, 3)).toBe(false);
    world.setTile(3, 3, TILE_TYPES.CLAIMED_FLOOR);
    expect(world.isDiggable(3, 3)).toBe(false);
  });

  it('isInBounds checks boundaries correctly', () => {
    const world = new World();
    expect(world.isInBounds(0, 0)).toBe(true);
    expect(world.isInBounds(MAP_WIDTH - 1, MAP_HEIGHT - 1)).toBe(true);
    expect(world.isInBounds(-1, 0)).toBe(false);
    expect(world.isInBounds(MAP_WIDTH, 0)).toBe(false);
  });
});
