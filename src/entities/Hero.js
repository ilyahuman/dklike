import { Entity } from './Entity.js';
import { Pathfinder } from '../world/Pathfinder.js';
import { CREATURE_STATES, TILE_SIZE, TILE_TYPES, WAVE, ENTITY_TYPES, EVENTS } from '../constants.js';

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
    this._digTimer = 0;
    this._digTargetX = -1;
    this._digTargetY = -1;

    this._repath();
  }

  update(dt) {
    // Digging state: dig through walls toward heart
    if (this.state === CREATURE_STATES.DIGGING) {
      this._repathTimer += dt;
      if (this._repathTimer >= WAVE.REPATH_INTERVAL_SEC) {
        this._repathTimer = 0;
        this._repath(); // check if a path opened up
      }
      if (this.state === CREATURE_STATES.DIGGING) {
        this._updateDigging(dt);
      }
      return;
    }

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
    // If no path found, enter digging state
    if (!this._path) {
      if (this.state !== CREATURE_STATES.DIGGING) {
        this.state = CREATURE_STATES.DIGGING;
        this._pickDigTarget();
      }
    } else if (this.state === CREATURE_STATES.DIGGING) {
      this.state = CREATURE_STATES.MOVING;
      this._digTimer = 0;
    }
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

  /** Pick the adjacent wall tile closest to the dungeon heart center. */
  _pickDigTarget() {
    const heartCx = Math.floor(this._world.width / 2);
    const heartCy = Math.floor(this._world.height / 2);
    const { tx, ty } = this.getTile(TILE_SIZE);
    const neighbors = [
      { x: tx - 1, y: ty },
      { x: tx + 1, y: ty },
      { x: tx, y: ty - 1 },
      { x: tx, y: ty + 1 },
    ];

    let best = null;
    let bestDist = Infinity;
    for (const n of neighbors) {
      if (!this._world.isInBounds(n.x, n.y)) continue;
      if (this._world.isWalkable(n.x, n.y)) continue; // skip already walkable
      const tile = this._world.getTile(n.x, n.y);
      if (tile === TILE_TYPES.LAVA || tile === TILE_TYPES.WATER || tile === TILE_TYPES.ROCK) continue;
      const dist = Math.abs(n.x - heartCx) + Math.abs(n.y - heartCy);
      if (dist < bestDist) {
        bestDist = dist;
        best = n;
      }
    }
    if (best) {
      this._digTargetX = best.x;
      this._digTargetY = best.y;
      this._digTimer = 0;
    }
  }

  /** Process one tick of wall-digging. */
  _updateDigging(dt) {
    if (this._digTargetX < 0) {
      this._pickDigTarget();
      if (this._digTargetX < 0) {
        // No diggable neighbor — try re-pathing
        this._repath();
        return;
      }
    }

    this._digTimer += dt;
    if (this._digTimer >= WAVE.HERO_DIG_TIME_SEC) {
      // Dig the tile
      this._world.setTile(this._digTargetX, this._digTargetY, TILE_TYPES.UNCLAIMED_FLOOR);
      this._eventBus.publish(EVENTS.TILE_CHANGED, {
        x: this._digTargetX,
        y: this._digTargetY,
        type: TILE_TYPES.UNCLAIMED_FLOOR,
      });
      Pathfinder.clearCache();

      // Move hero to the newly dug tile
      this.x = this._digTargetX * TILE_SIZE + TILE_SIZE / 2;
      this.y = this._digTargetY * TILE_SIZE + TILE_SIZE / 2;

      // Reset and try to repath
      this._digTimer = 0;
      this._digTargetX = -1;
      this._digTargetY = -1;
      this._repath();
    }
  }

  get facingRight() { return this._facingRight; }
}
