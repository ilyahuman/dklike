import { TILE_TYPES, MAP_WIDTH, MAP_HEIGHT, WALKABLE_TILES, DIGGABLE_TILES } from '../constants.js';

/**
 * 2D tile grid representing the dungeon map.
 * Pure data — no rendering, no DOM refs.
 */
export class World {
  constructor() {
    this.width = MAP_WIDTH;
    this.height = MAP_HEIGHT;
    /** @type {string[]} Flat array, row-major: tiles[y * width + x] */
    this.tiles = new Array(this.width * this.height).fill(TILE_TYPES.ROCK);
  }

  /**
   * Get tile type at position.
   * @param {number} x
   * @param {number} y
   * @returns {string|null} Tile type or null if out of bounds.
   */
  getTile(x, y) {
    if (!this.isInBounds(x, y)) return null;
    return this.tiles[y * this.width + x];
  }

  /**
   * Set tile type at position.
   * @param {number} x
   * @param {number} y
   * @param {string} type - TILE_TYPES value.
   */
  setTile(x, y, type) {
    if (!this.isInBounds(x, y)) return;
    this.tiles[y * this.width + x] = type;
  }

  /**
   * Get cardinal neighbors (up to 4).
   * @param {number} x
   * @param {number} y
   * @returns {{x: number, y: number, type: string}[]}
   */
  getNeighbors(x, y) {
    const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];
    const result = [];
    for (const [dx, dy] of dirs) {
      const nx = x + dx;
      const ny = y + dy;
      if (this.isInBounds(nx, ny)) {
        result.push({ x: nx, y: ny, type: this.getTile(nx, ny) });
      }
    }
    return result;
  }

  /**
   * @param {number} x
   * @param {number} y
   * @returns {boolean}
   */
  isWalkable(x, y) {
    const tile = this.getTile(x, y);
    return tile !== null && WALKABLE_TILES.includes(tile);
  }

  /**
   * @param {number} x
   * @param {number} y
   * @returns {boolean}
   */
  isDiggable(x, y) {
    const tile = this.getTile(x, y);
    return tile !== null && DIGGABLE_TILES.includes(tile);
  }

  /**
   * @param {number} x
   * @param {number} y
   * @returns {boolean}
   */
  isInBounds(x, y) {
    return x >= 0 && x < this.width && y >= 0 && y < this.height;
  }
}
