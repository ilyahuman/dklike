/**
 * Manages all game entities — lifecycle, updates, and spatial queries.
 * Single source of truth for entity existence.
 */
export class EntityManager {
  constructor() {
    /** @type {Map<number, import('./Entity.js').Entity>} */
    this._entities = new Map();
    /** @type {Map<number, import('./Entity.js').Entity[]>} */
    this._spatialGrid = new Map();
    this._cellSize = 128; // 4 tiles (TILE_SIZE=32)
  }

  /**
   * Add an entity.
   * @param {import('./Entity.js').Entity} entity
   */
  add(entity) {
    this._entities.set(entity.id, entity);
  }

  /**
   * Remove an entity by id.
   * @param {number} id
   */
  remove(id) {
    this._entities.delete(id);
  }

  /**
   * Get entity by id.
   * @param {number} id
   * @returns {import('./Entity.js').Entity|undefined}
   */
  getById(id) {
    return this._entities.get(id);
  }

  /**
   * Get all entities.
   * @returns {import('./Entity.js').Entity[]}
   */
  getAll() {
    return Array.from(this._entities.values());
  }

  /**
   * Iterate all entities without allocating an array.
   * @returns {Iterator<import('./Entity.js').Entity>}
   */
  [Symbol.iterator]() {
    return this._entities.values();
  }

  /**
   * Get all entities of a specific type.
   * @param {string} type
   * @returns {import('./Entity.js').Entity[]}
   */
  getByType(type) {
    return this.getAll().filter(e => e.type === type);
  }

  /**
   * Rebuild spatial hash from current entity positions.
   */
  rebuildSpatialHash() {
    this._spatialGrid.clear();
    for (const entity of this._entities.values()) {
      if (!entity.alive) continue;
      const cellKey = this._getCellKey(entity.x, entity.y);
      if (!this._spatialGrid.has(cellKey)) {
        this._spatialGrid.set(cellKey, []);
      }
      this._spatialGrid.get(cellKey).push(entity);
    }
  }

  /**
   * Compute a unique integer key for a grid cell.
   * @private
   * @param {number} x - World X in pixels.
   * @param {number} y - World Y in pixels.
   * @returns {number}
   */
  _getCellKey(x, y) {
    const cx = Math.floor(x / this._cellSize);
    const cy = Math.floor(y / this._cellSize);
    return (cx << 16) | (cy & 0xFFFF);
  }

  /**
   * Get entities within radius of a point using the spatial hash grid.
   * @param {number} x - Center X in world pixels.
   * @param {number} y - Center Y in world pixels.
   * @param {number} radius - Search radius in pixels.
   * @returns {import('./Entity.js').Entity[]}
   */
  getEntitiesInRadius(x, y, radius) {
    const r2 = radius * radius;
    const result = [];
    const minCx = Math.floor((x - radius) / this._cellSize);
    const maxCx = Math.floor((x + radius) / this._cellSize);
    const minCy = Math.floor((y - radius) / this._cellSize);
    const maxCy = Math.floor((y + radius) / this._cellSize);

    for (let cx = minCx; cx <= maxCx; cx++) {
      for (let cy = minCy; cy <= maxCy; cy++) {
        const key = (cx << 16) | (cy & 0xFFFF);
        const cell = this._spatialGrid.get(key);
        if (!cell) continue;
        for (const e of cell) {
          if (!e.alive) continue;
          const dx = e.x - x;
          const dy = e.y - y;
          if (dx * dx + dy * dy <= r2) {
            result.push(e);
          }
        }
      }
    }
    return result;
  }

  /**
   * Update all entities. Stores previous positions for interpolation.
   * Removes dead entities. Rebuilds spatial hash.
   * @param {number} dt - Delta time in seconds.
   */
  update(dt) {
    for (const entity of this._entities.values()) {
      entity.prevX = entity.x;
      entity.prevY = entity.y;
      entity.update(dt);
    }
    // Remove dead entities
    for (const [id, entity] of this._entities) {
      if (!entity.alive) {
        this._entities.delete(id);
      }
    }
    this.rebuildSpatialHash();
  }
}
