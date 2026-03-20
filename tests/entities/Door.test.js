import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Door } from '../../src/entities/Door.js';
import { ENTITY_TYPES, DOOR_HP, TILE_SIZE, TILE_TYPES } from '../../src/constants.js';

function makeWorld() {
  const tiles = {};
  return {
    width: 80, height: 60,
    getTile: vi.fn((x, y) => tiles[`${x},${y}`] || TILE_TYPES.ROCK),
    setTile: vi.fn(),
    isWalkable: vi.fn((x, y) => {
      const t = tiles[`${x},${y}`];
      return t === TILE_TYPES.CLAIMED_FLOOR || t === TILE_TYPES.UNCLAIMED_FLOOR;
    }),
    getNeighbors: vi.fn((x, y) => {
      const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];
      return dirs.map(([dx, dy]) => ({ x: x + dx, y: y + dy, type: tiles[`${x + dx},${y + dy}`] || TILE_TYPES.ROCK }));
    }),
    _tiles: tiles,
  };
}

describe('Door', () => {
  it('should have correct type and HP', () => {
    const door = new Door(5, 5);
    expect(door.type).toBe(ENTITY_TYPES.DOOR);
    expect(door.health).toBe(DOOR_HP);
    expect(door.maxHealth).toBe(DOOR_HP);
    expect(door.team).toBe('player');
  });

  it('should have world position centered on tile', () => {
    const door = new Door(5, 5);
    expect(door.x).toBe(5 * TILE_SIZE + TILE_SIZE / 2);
    expect(door.y).toBe(5 * TILE_SIZE + TILE_SIZE / 2);
  });

  it('should store tile coordinates', () => {
    const door = new Door(10, 15);
    expect(door.tileX).toBe(10);
    expect(door.tileY).toBe(15);
  });

  it('should take damage and die', () => {
    const door = new Door(5, 5);
    door.takeDamage(100);
    expect(door.health).toBe(DOOR_HP - 100);
    expect(door.isDead()).toBe(false);
    door.takeDamage(DOOR_HP);
    expect(door.isDead()).toBe(true);
  });

  describe('isValidDoorPlacement', () => {
    it('should return true for horizontal corridor', () => {
      const world = makeWorld();
      world._tiles['4,5'] = TILE_TYPES.CLAIMED_FLOOR;
      world._tiles['6,5'] = TILE_TYPES.CLAIMED_FLOOR;
      world._tiles['5,5'] = TILE_TYPES.CLAIMED_FLOOR;
      expect(Door.isValidDoorPlacement(world, 5, 5)).toBe(true);
    });

    it('should return true for vertical corridor', () => {
      const world = makeWorld();
      world._tiles['5,4'] = TILE_TYPES.CLAIMED_FLOOR;
      world._tiles['5,6'] = TILE_TYPES.CLAIMED_FLOOR;
      world._tiles['5,5'] = TILE_TYPES.CLAIMED_FLOOR;
      expect(Door.isValidDoorPlacement(world, 5, 5)).toBe(true);
    });

    it('should return false for open area (3+ walkable neighbors)', () => {
      const world = makeWorld();
      world._tiles['4,5'] = TILE_TYPES.CLAIMED_FLOOR;
      world._tiles['6,5'] = TILE_TYPES.CLAIMED_FLOOR;
      world._tiles['5,4'] = TILE_TYPES.CLAIMED_FLOOR;
      world._tiles['5,5'] = TILE_TYPES.CLAIMED_FLOOR;
      expect(Door.isValidDoorPlacement(world, 5, 5)).toBe(false);
    });

    it('should return false for dead end (only 1 walkable neighbor)', () => {
      const world = makeWorld();
      world._tiles['4,5'] = TILE_TYPES.CLAIMED_FLOOR;
      world._tiles['5,5'] = TILE_TYPES.CLAIMED_FLOOR;
      expect(Door.isValidDoorPlacement(world, 5, 5)).toBe(false);
    });

    it('should require opposing walkable neighbors', () => {
      const world = makeWorld();
      world._tiles['4,5'] = TILE_TYPES.CLAIMED_FLOOR;
      world._tiles['5,4'] = TILE_TYPES.CLAIMED_FLOOR;
      world._tiles['5,5'] = TILE_TYPES.CLAIMED_FLOOR;
      expect(Door.isValidDoorPlacement(world, 5, 5)).toBe(false);
    });
  });

  describe('Door walkability', () => {
    it('door tile remains walkable (creatures path through)', () => {
      const world = makeWorld();
      world._tiles['5,5'] = TILE_TYPES.CLAIMED_FLOOR;
      const door = new Door(5, 5);
      expect(world.isWalkable(5, 5)).toBe(true);
    });
  });

  describe('open/close visual state', () => {
    it('should be closed by default', () => {
      const door = new Door(5, 5);
      expect(door._isOpen).toBe(false);
    });

    it('should open when friendly creature is nearby', () => {
      const em = {
        getEntitiesInRadius: vi.fn(() => [
          { team: 'player', type: 'troll', alive: true }
        ]),
      };
      const door = new Door(5, 5, em);
      door.update(0.1);
      expect(door._isOpen).toBe(true);
    });

    it('should stay closed when no friendlies nearby', () => {
      const em = {
        getEntitiesInRadius: vi.fn(() => []),
      };
      const door = new Door(5, 5, em);
      door.update(0.1);
      expect(door._isOpen).toBe(false);
    });
  });
});
