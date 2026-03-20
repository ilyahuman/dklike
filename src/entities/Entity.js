/**
 * Base class for all game entities.
 * Pure data — no rendering, no DOM refs.
 * Subclasses add behavior via update(dt).
 */
export class Entity {
  static _nextId = 1;

  /**
   * @param {string} type - ENTITY_TYPES value.
   * @param {number} x - World position in pixels.
   * @param {number} y - World position in pixels.
   */
  constructor(type, x, y) {
    this.id = Entity._nextId++;
    this.type = type;
    this.x = x;
    this.y = y;
    this.prevX = x;
    this.prevY = y;
    this.vx = 0;
    this.vy = 0;
    this.health = 0;
    this.maxHealth = 0;
    this.state = 'idle';
    this.alive = true;
  }

  /**
   * Apply damage to entity.
   * @param {number} amount
   */
  takeDamage(amount) {
    this.health = Math.max(0, this.health - amount);
  }

  /**
   * @returns {boolean} True if health is zero or below.
   */
  isDead() {
    return this.health <= 0;
  }

  /**
   * Get tile coordinates for this entity's position.
   * @param {number} tileSize
   * @returns {{tx: number, ty: number}}
   */
  getTile(tileSize) {
    return {
      tx: Math.floor(this.x / tileSize),
      ty: Math.floor(this.y / tileSize),
    };
  }

  /**
   * Update entity state. Override in subclasses.
   * @param {number} _dt - Delta time in seconds.
   */
  update(_dt) {
    // Base does nothing — subclasses implement behavior
  }
}
