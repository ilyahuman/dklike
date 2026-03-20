import { TILE_TYPES, MAP_WIDTH, MAP_HEIGHT, MAP_GEN } from '../constants.js';

/**
 * Seeded procedural map generator.
 * Same seed always produces the same map.
 */
export class MapGenerator {
  /**
   * Generate a complete dungeon map.
   * @param {import('./World.js').World} world
   * @param {number} seed
   */
  static generate(world, seed) {
    const rng = MapGenerator._createRng(seed);

    // Step 1: Fill everything with rock
    for (let y = 0; y < MAP_HEIGHT; y++) {
      for (let x = 0; x < MAP_WIDTH; x++) {
        world.setTile(x, y, TILE_TYPES.ROCK);
      }
    }

    // Step 2: Fill interior with dirt
    for (let y = 1; y < MAP_HEIGHT - 1; y++) {
      for (let x = 1; x < MAP_WIDTH - 1; x++) {
        world.setTile(x, y, TILE_TYPES.DIRT);
      }
    }

    // Step 3: Carve dungeon heart at center (3x3 claimed floor)
    const cx = Math.floor(MAP_WIDTH / 2);
    const cy = Math.floor(MAP_HEIGHT / 2);
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        world.setTile(cx + dx, cy + dy, TILE_TYPES.CLAIMED_FLOOR);
      }
    }

    // Step 4: Place gold vein clusters
    const goldCount = MapGenerator._randInt(rng, MAP_GEN.GOLD_VEIN_MIN, MAP_GEN.GOLD_VEIN_MAX);
    for (let i = 0; i < goldCount; i++) {
      MapGenerator._placeCluster(world, rng, TILE_TYPES.GOLD_VEIN, 1, 3);
    }

    // Step 5: Place gem seams
    const gemCount = MapGenerator._randInt(rng, MAP_GEN.GEM_SEAM_MIN, MAP_GEN.GEM_SEAM_MAX);
    for (let i = 0; i < gemCount; i++) {
      MapGenerator._placeCluster(world, rng, TILE_TYPES.GEM_SEAM, 1, 2);
    }

    // Step 6: Place lava pools
    const lavaCount = MapGenerator._randInt(rng, MAP_GEN.LAVA_POOL_MIN, MAP_GEN.LAVA_POOL_MAX);
    for (let i = 0; i < lavaCount; i++) {
      MapGenerator._placeCluster(world, rng, TILE_TYPES.LAVA, 3, 6);
    }

    // Step 7: Place water channels
    const waterCount = MapGenerator._randInt(rng, MAP_GEN.WATER_CHANNEL_MIN, MAP_GEN.WATER_CHANNEL_MAX);
    for (let i = 0; i < waterCount; i++) {
      MapGenerator._placeChannel(world, rng, TILE_TYPES.WATER, 5, 12);
    }
  }

  /** @private */
  static _placeCluster(world, rng, tileType, minSize, maxSize) {
    const x = MapGenerator._randInt(rng, 3, MAP_WIDTH - 4);
    const y = MapGenerator._randInt(rng, 3, MAP_HEIGHT - 4);
    const size = MapGenerator._randInt(rng, minSize, maxSize);
    const cx = Math.floor(MAP_WIDTH / 2);
    const cy = Math.floor(MAP_HEIGHT / 2);

    world.setTile(x, y, tileType);
    for (let i = 1; i < size; i++) {
      const dx = MapGenerator._randInt(rng, -1, 1);
      const dy = MapGenerator._randInt(rng, -1, 1);
      const nx = x + dx + MapGenerator._randInt(rng, -1, 1);
      const ny = y + dy + MapGenerator._randInt(rng, -1, 1);
      if (nx > 1 && nx < MAP_WIDTH - 2 && ny > 1 && ny < MAP_HEIGHT - 2) {
        if (Math.abs(nx - cx) > 2 || Math.abs(ny - cy) > 2) {
          world.setTile(nx, ny, tileType);
        }
      }
    }
  }

  /** @private */
  static _placeChannel(world, rng, tileType, minLen, maxLen) {
    let x = MapGenerator._randInt(rng, 5, MAP_WIDTH - 6);
    let y = MapGenerator._randInt(rng, 5, MAP_HEIGHT - 6);
    const len = MapGenerator._randInt(rng, minLen, maxLen);
    const cx = Math.floor(MAP_WIDTH / 2);
    const cy = Math.floor(MAP_HEIGHT / 2);

    for (let i = 0; i < len; i++) {
      if (x > 1 && x < MAP_WIDTH - 2 && y > 1 && y < MAP_HEIGHT - 2) {
        if (Math.abs(x - cx) > 2 || Math.abs(y - cy) > 2) {
          world.setTile(x, y, tileType);
        }
      }
      const dir = MapGenerator._randInt(rng, 0, 3);
      if (dir === 0) x++;
      else if (dir === 1) x--;
      else if (dir === 2) y++;
      else y--;
    }
  }

  /**
   * Simple seeded PRNG (mulberry32).
   * @param {number} seed
   * @returns {Function} Returns 0-1 float each call.
   */
  static _createRng(seed) {
    let s = seed | 0;
    return () => {
      s |= 0;
      s = s + 0x6D2B79F5 | 0;
      let t = Math.imul(s ^ s >>> 15, 1 | s);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  /** @private */
  static _randInt(rng, min, max) {
    return Math.floor(rng() * (max - min + 1)) + min;
  }
}
