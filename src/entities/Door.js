import { Entity } from './Entity.js';
import { ENTITY_TYPES, DOOR_HP, TILE_SIZE } from '../constants.js';

/**
 * Door entity placed on corridor tiles.
 * Heroes must attack through; player creatures pass freely.
 * HP-based — destroyed when HP reaches 0.
 */
export class Door extends Entity {
  /**
   * @param {number} tileX - Tile X coordinate.
   * @param {number} tileY - Tile Y coordinate.
   * @param {import('../entities/EntityManager.js').EntityManager} [entityManager=null]
   */
  constructor(tileX, tileY, entityManager = null) {
    const px = tileX * TILE_SIZE + TILE_SIZE / 2;
    const py = tileY * TILE_SIZE + TILE_SIZE / 2;
    super(ENTITY_TYPES.DOOR, px, py);
    this.team = 'player';
    this.health = DOOR_HP;
    this.maxHealth = DOOR_HP;
    this.tileX = tileX;
    this.tileY = tileY;
    this._entityManager = entityManager;
    this._isOpen = false;
  }

  static isValidDoorPlacement(world, tx, ty) {
    if (!world.isWalkable(tx, ty)) return false;
    const left = world.isWalkable(tx - 1, ty);
    const right = world.isWalkable(tx + 1, ty);
    const up = world.isWalkable(tx, ty - 1);
    const down = world.isWalkable(tx, ty + 1);
    const horizontal = left && right && !up && !down;
    const vertical = up && down && !left && !right;
    return horizontal || vertical;
  }

  update(_dt) {
    if (this._entityManager) {
      const nearby = this._entityManager.getEntitiesInRadius(this.x, this.y, TILE_SIZE * 1.5);
      this._isOpen = nearby.some(e => e.team === 'player' && e.type !== ENTITY_TYPES.DOOR && e.alive);
    }
  }
}
