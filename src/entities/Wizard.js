import { Hero } from './Hero.js';
import { ENTITY_TYPES, WIZARD_STATS, TILE_SIZE, WAVE } from '../constants.js';

/**
 * Wizard hero — medium HP, ranged (3 tiles). Kites melee attackers.
 */
export class Wizard extends Hero {
  constructor(x, y, world, eventBus, entityManager, roomManager) {
    super(ENTITY_TYPES.WIZARD, x, y, WIZARD_STATS, world, eventBus, entityManager, roomManager);
  }

  /** @override */
  update(dt) {
    this._repathTimer += dt;

    const nearestMelee = this._findNearestMeleeEnemy();
    if (nearestMelee) {
      const dx = nearestMelee.x - this.x;
      const dy = nearestMelee.y - this.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const safeRange = this.attackRange * TILE_SIZE * 0.8;

      if (dist < safeRange) {
        this._kiteFrom(nearestMelee, dt);
        return;
      }
    }

    if (this._repathTimer >= WAVE.REPATH_INTERVAL_SEC) {
      this._repathTimer = 0;
      this._repath();
    }
    this._followPath(dt);
  }

  /** @private */
  _findNearestMeleeEnemy() {
    let nearest = null;
    let nearestDist = Infinity;
    for (const e of this._entityManager.getAll()) {
      if (!e.alive || e.team === this.team || e.team === null) continue;
      if (e.attackRange > 2) continue;
      const dx = e.x - this.x;
      const dy = e.y - this.y;
      const dist = dx * dx + dy * dy;
      if (dist < nearestDist) {
        nearestDist = dist;
        nearest = e;
      }
    }
    return nearest;
  }

  /** @private */
  _kiteFrom(enemy, dt) {
    const dx = this.x - enemy.x;
    const dy = this.y - enemy.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 1) return;

    const move = this.getEffectiveSpeed() * dt;
    const nx = this.x + (dx / dist) * move;
    const ny = this.y + (dy / dist) * move;

    const tileX = Math.floor(nx / TILE_SIZE);
    const tileY = Math.floor(ny / TILE_SIZE);
    if (this._world.isWalkable(tileX, tileY)) {
      this.x = nx;
      this.y = ny;
      this._facingRight = dx > 0;
    }
  }
}
