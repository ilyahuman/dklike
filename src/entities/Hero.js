import { Entity } from './Entity.js';
import { Pathfinder } from '../world/Pathfinder.js';
import { CREATURE_STATES, TILE_SIZE, WAVE, ENTITY_TYPES } from '../constants.js';

/**
 * Shared base class for hero entities (Knight, Thief, Wizard).
 * Pathfinds to Dungeon Heart, re-paths every 3 seconds.
 * CombatSystem handles damage; this class handles movement.
 */
export class Hero extends Entity {
  constructor(type, x, y, stats, world, eventBus, entityManager, roomManager) {
    super(type, x, y);
    this.team = 'enemy';
    this.health = stats.hp;
    this.maxHealth = stats.hp;
    this.damage = stats.damage;
    this.attackRange = stats.attackRange;
    this.attackCooldown = stats.attackCooldown;
    this.speed = stats.speed;
    this.goldDrop = stats.goldDrop;
    this.state = CREATURE_STATES.MOVING;

    this._world = world;
    this._eventBus = eventBus;
    this._entityManager = entityManager;
    this._roomManager = roomManager;

    this._path = null;
    this._pathIndex = 0;
    this._repathTimer = 0;
    this._facingRight = true;
    this._attackingDoor = null;

    this._repath();
  }

  update(dt) {
    this._repathTimer += dt;
    if (this._repathTimer >= WAVE.REPATH_INTERVAL_SEC) {
      this._repathTimer = 0;
      this._repath();
    }

    // Check for door blocking path
    const door = this._checkForDoor();
    if (door) {
      this._attackingDoor = door;
      this.state = CREATURE_STATES.ATTACKING;
      this._facingRight = door.x > this.x;
      return; // Stop moving, CombatSystem handles damage
    }

    if (this._attackingDoor) {
      if (!this._attackingDoor.alive) {
        this._attackingDoor = null;
        this.state = CREATURE_STATES.MOVING;
      } else {
        return; // Still attacking door
      }
    }

    this._followPath(dt);
  }

  /** Override in subclasses for different targeting. */
  _repath() {
    this._pathToDungeonHeart();
  }

  _pathToDungeonHeart() {
    const cx = Math.floor(this._world.width / 2);
    const cy = Math.floor(this._world.height / 2);
    this._pathToTile(cx, cy);
  }

  _pathToTile(tx, ty) {
    const { tx: sx, ty: sy } = this.getTile(TILE_SIZE);
    const path = Pathfinder.findPath(this._world, sx, sy, tx, ty);
    if (path && path.length > 0) {
      this._path = path;
      this._pathIndex = 0;
    } else {
      this._path = null;
    }
  }

  _followPath(dt) {
    if (!this._path || this._pathIndex >= this._path.length) return;
    const target = this._path[this._pathIndex];
    const targetX = target.x * TILE_SIZE + TILE_SIZE / 2;
    const targetY = target.y * TILE_SIZE + TILE_SIZE / 2;
    const dx = targetX - this.x;
    const dy = targetY - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < 2) {
      this.x = targetX;
      this.y = targetY;
      this._pathIndex++;
      return;
    }

    const move = Math.min(this.getEffectiveSpeed() * dt, dist);
    this.x += (dx / dist) * move;
    this.y += (dy / dist) * move;
    this._facingRight = dx > 0;
  }

  /** Check for a door entity blocking the hero's path. */
  _checkForDoor() {
    if (!this._entityManager) return null;
    for (const e of this._entityManager.getAll()) {
      if (e.type !== ENTITY_TYPES.DOOR || !e.alive) continue;
      const dx = Math.abs(e.x - this.x);
      const dy = Math.abs(e.y - this.y);
      if (dx < TILE_SIZE * 1.2 && dy < TILE_SIZE * 1.2) {
        return e;
      }
    }
    return null;
  }

  get facingRight() { return this._facingRight; }
}
