/**
 * Manages all game entities — lifecycle, updates, and spatial queries.
 * Single source of truth for entity existence.
 */
export class EntityManager {
  constructor() {
    /** @type {Map<number, import('./Entity.js').Entity>} */
    this._entities = new Map();
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
   * Get all entities of a specific type.
   * @param {string} type
   * @returns {import('./Entity.js').Entity[]}
   */
  getByType(type) {
    return this.getAll().filter(e => e.type === type);
  }

  /**
   * Get entities within radius of a point.
   * @param {number} x - Center X in world pixels.
   * @param {number} y - Center Y in world pixels.
   * @param {number} radius - Search radius in pixels.
   * @returns {import('./Entity.js').Entity[]}
   */
  getEntitiesInRadius(x, y, radius) {
    const r2 = radius * radius;
    return this.getAll().filter(e => {
      const dx = e.x - x;
      const dy = e.y - y;
      return dx * dx + dy * dy <= r2;
    });
  }

  /**
   * Update all entities. Stores previous positions for interpolation.
   * Removes dead entities.
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
  }
}
