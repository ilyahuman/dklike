import { describe, it, expect, beforeEach } from 'vitest';
import { Pathfinder } from '../../src/world/Pathfinder.js';
import { World } from '../../src/world/World.js';
import { TILE_TYPES } from '../../src/constants.js';

/**
 * Helper: create a small world with a corridor of walkable floor.
 * Default: 10x10, all rock, with a cleared path.
 */
function makeTestWorld(width = 10, height = 10) {
  const world = new World();
  // Override dimensions for test world
  world.width = width;
  world.height = height;
  world.tiles = new Array(width * height).fill(TILE_TYPES.ROCK);
  return world;
}

function clearRect(world, x1, y1, x2, y2) {
  for (let y = y1; y <= y2; y++) {
    for (let x = x1; x <= x2; x++) {
      world.setTile(x, y, TILE_TYPES.CLAIMED_FLOOR);
    }
  }
}

describe('Pathfinder', () => {
  beforeEach(() => { Pathfinder.clearCache(); });

  it('finds straight-line path on open floor', () => {
    const world = makeTestWorld();
    clearRect(world, 0, 0, 9, 9);
    const path = Pathfinder.findPath(world, 0, 0, 5, 0);
    expect(path).not.toBeNull();
    expect(path.length).toBeGreaterThan(0);
    // Path should end at destination
    const last = path[path.length - 1];
    expect(last.x).toBe(5);
    expect(last.y).toBe(0);
  });

  it('returns null when no path exists', () => {
    const world = makeTestWorld();
    // Only clear two disconnected areas
    world.setTile(0, 0, TILE_TYPES.CLAIMED_FLOOR);
    world.setTile(9, 9, TILE_TYPES.CLAIMED_FLOOR);
    const path = Pathfinder.findPath(world, 0, 0, 9, 9);
    expect(path).toBeNull();
  });

  it('navigates around obstacles', () => {
    const world = makeTestWorld();
    clearRect(world, 0, 0, 9, 9);
    // Wall across middle with one gap
    for (let x = 0; x < 9; x++) {
      world.setTile(x, 5, TILE_TYPES.ROCK);
    }
    // Gap at x=9, y=5 (already floor)
    const path = Pathfinder.findPath(world, 0, 0, 0, 9);
    expect(path).not.toBeNull();
    // Path must go around via x=9
    const maxX = Math.max(...path.map(p => p.x));
    expect(maxX).toBeGreaterThanOrEqual(9);
  });

  it('supports diagonal movement', () => {
    const world = makeTestWorld();
    clearRect(world, 0, 0, 9, 9);
    const path = Pathfinder.findPath(world, 0, 0, 3, 3);
    expect(path).not.toBeNull();
    // Diagonal path should be shorter than Manhattan
    expect(path.length).toBeLessThanOrEqual(4);
  });

  it('does not cut corners diagonally', () => {
    const world = makeTestWorld();
    clearRect(world, 0, 0, 4, 4);
    // Block corner: (1,0) and (0,1) are rock, making diagonal (0,0)->(1,1) impossible
    world.setTile(1, 0, TILE_TYPES.ROCK);
    world.setTile(0, 1, TILE_TYPES.ROCK);
    const path = Pathfinder.findPath(world, 0, 0, 1, 1);
    // (0,0) is completely enclosed by rock on two sides — no valid path exists
    // because corner-cutting is disabled and the only exit is diagonal
    expect(path).toBeNull();
  });

  it('returns path that starts adjacent to origin (excludes start tile)', () => {
    const world = makeTestWorld();
    clearRect(world, 0, 0, 5, 5);
    const path = Pathfinder.findPath(world, 0, 0, 3, 0);
    expect(path).not.toBeNull();
    // First tile should not be the start
    expect(path[0].x !== 0 || path[0].y !== 0).toBe(true);
  });

  it('uses cache for repeated identical queries', () => {
    const world = makeTestWorld();
    clearRect(world, 0, 0, 9, 9);
    const path1 = Pathfinder.findPath(world, 0, 0, 5, 5);
    const path2 = Pathfinder.findPath(world, 0, 0, 5, 5);
    expect(path1).toEqual(path2);
  });

  it('clearCache invalidates cached paths', () => {
    const world = makeTestWorld();
    clearRect(world, 0, 0, 9, 9);
    Pathfinder.findPath(world, 0, 0, 5, 5);
    Pathfinder.clearCache();
    // Should still work after cache clear
    const path = Pathfinder.findPath(world, 0, 0, 5, 5);
    expect(path).not.toBeNull();
  });

  it('handles start equals destination', () => {
    const world = makeTestWorld();
    world.setTile(3, 3, TILE_TYPES.CLAIMED_FLOOR);
    const path = Pathfinder.findPath(world, 3, 3, 3, 3);
    expect(path).not.toBeNull();
    expect(path.length).toBe(0);
  });
});
