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

    // ── Combat properties (Phase 4) ──
    this.team = null;           // 'player' | 'enemy' | null
    this.level = 1;
    this.xp = 0;
    this.damage = 0;
    this.attackRange = 0;       // tiles
    this.attackCooldown = 0;    // seconds between attacks
    this._attackTimer = 0;      // current cooldown remaining
    this.speed = 0;             // pixels per second
    this.maxTargets = 1;
    this.debuffOnHit = null;    // {type, duration, factor} or null
    this.debuffs = [];          // [{type, remaining, factor}]
    this.goldDrop = 0;
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

  applyDebuff(type, duration, factor) {
    const existing = this.debuffs.find(d => d.type === type);
    if (existing) {
      existing.remaining = Math.max(existing.remaining, duration);
    } else {
      this.debuffs.push({ type, remaining: duration, factor });
    }
  }

  getDebuffFactor(type) {
    const debuff = this.debuffs.find(d => d.type === type);
    return debuff ? debuff.factor : 1.0;
  }

  updateDebuffs(dt) {
    for (let i = this.debuffs.length - 1; i >= 0; i--) {
      this.debuffs[i].remaining -= dt;
      if (this.debuffs[i].remaining <= 0) {
        this.debuffs.splice(i, 1);
      }
    }
  }

  getEffectiveSpeed() {
    return this.speed * this.getDebuffFactor('slow');
  }
}
