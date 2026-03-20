import { Entity } from './Entity.js';
import { Pathfinder } from '../world/Pathfinder.js';
import {
  CREATURE_STATES, TILE_SIZE, ROOM_TYPES, ROOM_CONFIG,
  LEVEL_THRESHOLDS, LEVEL_HP_BONUS, LEVEL_SPEED_BONUS, MAX_LEVEL,
} from '../constants.js';

/**
 * Shared base class for player creatures (Troll, Dark Mistress).
 * Provides: need management, pathfinding, combat approach, training, idle wandering.
 * CombatSystem handles actual damage resolution; this class handles movement/state.
 */
export class Creature extends Entity {
  constructor(type, x, y, stats, world, eventBus, entityManager, roomManager) {
    super(type, x, y);
    this.team = 'player';
    this.health = stats.hp;
    this.maxHealth = stats.hp;
    this.damage = stats.damage;
    this.attackRange = stats.attackRange;
    this.attackCooldown = stats.attackCooldown;
    this.speed = stats.speed;
    this.hunger = 100;
    this.energy = 100;
    this.state = CREATURE_STATES.IDLE;

    this._baseStats = stats;
    this._world = world;
    this._eventBus = eventBus;
    this._entityManager = entityManager;
    this._roomManager = roomManager;

    this._path = null;
    this._pathIndex = 0;
    this._facingRight = true;
    this._idleTimer = 0;
    this._eatTimer = 0;
    this._sleepTimer = 0;
    this._moveGoal = null;
    this._attackTarget = null;
  }

  update(dt) {
    if (this._aiSuspended) return;
    this.hunger = Math.max(0, this.hunger - dt * 0.5);
    this.energy = Math.max(0, this.energy - dt * 0.3);

    if (this.health < this.maxHealth * 0.2) {
      this._enterFlee();
    } else if (this.state === CREATURE_STATES.FLEEING) {
      this._updateFlee(dt);
    } else if (this.state === CREATURE_STATES.EATING) {
      this._updateEat(dt);
    } else if (this.state === CREATURE_STATES.SLEEPING) {
      this._updateSleep(dt);
    } else if (this.hunger < 30) {
      this._enterEat();
    } else if (this.energy < 20) {
      this._enterSleep();
    } else if (this.state === CREATURE_STATES.ATTACKING) {
      this._updateAttack(dt);
    } else if (this.state === CREATURE_STATES.TRAINING) {
      this._updateTrain(dt);
    } else if (this.state === CREATURE_STATES.MOVING) {
      this._updateMove(dt);
    } else {
      this._decideAction(dt);
    }
  }

  _decideAction(dt) {
    const enemy = this._findNearestEnemy();
    if (enemy) {
      const dx = enemy.x - this.x;
      const dy = enemy.y - this.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const rangePx = this.attackRange * TILE_SIZE;

      if (dist <= rangePx) {
        this.state = CREATURE_STATES.ATTACKING;
        this._attackTarget = enemy;
        this._facingRight = enemy.x > this.x;
        return;
      }

      const targetTile = enemy.getTile(TILE_SIZE);
      this._pathToTile(targetTile.tx, targetTile.ty);
      if (this._path) {
        this._moveGoal = 'attack';
        return;
      }
    }

    // Training Room
    if (this._roomManager) {
      const trainingTiles = this._roomManager.getRoomTilesOfType(ROOM_TYPES.TRAINING_ROOM);
      if (trainingTiles.length > 0) {
        const { tx, ty } = this.getTile(TILE_SIZE);
        if (trainingTiles.some(t => t.x === tx && t.y === ty)) {
          this.state = CREATURE_STATES.TRAINING;
          this._path = null;
          return;
        }
        const target = this._findNearestTile(trainingTiles);
        if (target) {
          this._pathToTile(target.x, target.y);
          if (this._path) {
            this._moveGoal = 'train';
            return;
          }
        }
      }
    }

    this.state = CREATURE_STATES.IDLE;
    this._moveGoal = null;
    this._updateIdle(dt);
  }

  _updateAttack(_dt) {
    if (!this._attackTarget || !this._attackTarget.alive) {
      this._attackTarget = null;
      this.state = CREATURE_STATES.IDLE;
      return;
    }
    const dx = this._attackTarget.x - this.x;
    const dy = this._attackTarget.y - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > this.attackRange * TILE_SIZE * 1.5) {
      const t = this._attackTarget.getTile(TILE_SIZE);
      this._pathToTile(t.tx, t.ty);
      if (this._path) {
        this._moveGoal = 'attack';
        this.state = CREATURE_STATES.MOVING;
      } else {
        this._attackTarget = null;
        this.state = CREATURE_STATES.IDLE;
      }
      return;
    }
    this._facingRight = this._attackTarget.x > this.x;
  }

  _updateTrain(dt) {
    const { tx, ty } = this.getTile(TILE_SIZE);
    const room = this._roomManager ? this._roomManager.getRoomAt(tx, ty) : null;
    if (!room || room.type !== ROOM_TYPES.TRAINING_ROOM) {
      this.state = CREATURE_STATES.IDLE;
      return;
    }
    this.xp += ROOM_CONFIG[ROOM_TYPES.TRAINING_ROOM].xpPerSec * dt;
    this._checkLevelUp();

    const enemy = this._findNearestEnemy();
    if (enemy) {
      const dx = enemy.x - this.x;
      const dy = enemy.y - this.y;
      if (Math.sqrt(dx * dx + dy * dy) < TILE_SIZE * 8) {
        this.state = CREATURE_STATES.IDLE;
      }
    }
  }

  _checkLevelUp() {
    if (this.level >= MAX_LEVEL) return;
    const nextThreshold = LEVEL_THRESHOLDS[this.level];
    if (this.xp >= nextThreshold) {
      this.level++;
      this.maxHealth = Math.round(this._baseStats.hp * (1 + (this.level - 1) * LEVEL_HP_BONUS));
      this.health = Math.min(this.health + 10, this.maxHealth);
      this.speed = Math.round(this._baseStats.speed * (1 + (this.level - 1) * LEVEL_SPEED_BONUS));
    }
  }

  _enterEat() {
    if (this.state === CREATURE_STATES.EATING) return;
    if (this._roomManager) {
      const tiles = this._roomManager.getRoomTilesOfType(ROOM_TYPES.HATCHERY);
      if (tiles.length > 0) {
        const target = this._findNearestTile(tiles);
        if (target) {
          this._pathToTile(target.x, target.y);
          if (this._path) {
            this._moveGoal = 'eat';
            this.state = CREATURE_STATES.MOVING;
            return;
          }
        }
      }
    }
    this.state = CREATURE_STATES.EATING;
    this._eatTimer = 0;
    this._path = null;
    this._moveGoal = null;
  }

  _updateEat(dt) {
    this._eatTimer += dt;
    this.hunger = Math.min(100, this.hunger + dt * 20);
    if (this.hunger >= 80 || this._eatTimer > 3) {
      this.state = CREATURE_STATES.IDLE;
    }
  }

  _enterSleep() {
    if (this.state === CREATURE_STATES.SLEEPING) return;
    if (this._roomManager) {
      const tiles = this._roomManager.getRoomTilesOfType(ROOM_TYPES.LAIR);
      if (tiles.length > 0) {
        const target = this._findNearestTile(tiles);
        if (target) {
          this._pathToTile(target.x, target.y);
          if (this._path) {
            this._moveGoal = 'sleep';
            this.state = CREATURE_STATES.MOVING;
            return;
          }
        }
      }
    }
    this.state = CREATURE_STATES.SLEEPING;
    this._sleepTimer = 0;
    this._path = null;
    this._moveGoal = null;
  }

  _updateSleep(dt) {
    this._sleepTimer += dt;
    this.energy = Math.min(100, this.energy + dt * 15);
    if (this.energy >= 80 || this._sleepTimer > 4) {
      this.state = CREATURE_STATES.IDLE;
    }
  }

  _enterFlee() {
    if (this.state === CREATURE_STATES.FLEEING) return;
    this.state = CREATURE_STATES.FLEEING;
    this._attackTarget = null;
    const cx = Math.floor(this._world.width / 2);
    const cy = Math.floor(this._world.height / 2);
    this._pathToTile(cx, cy);
  }

  _updateFlee(dt) {
    if (this.health >= this.maxHealth * 0.2) {
      this.state = CREATURE_STATES.IDLE;
      this._path = null;
      return;
    }
    this._followPath(dt);
  }

  _updateMove(dt) {
    if (!this._path || this._pathIndex >= this._path.length) {
      if (this._moveGoal === 'eat') {
        this.state = CREATURE_STATES.EATING;
        this._eatTimer = 0;
        this._moveGoal = null;
        return;
      }
      if (this._moveGoal === 'sleep') {
        this.state = CREATURE_STATES.SLEEPING;
        this._sleepTimer = 0;
        this._moveGoal = null;
        return;
      }
      if (this._moveGoal === 'train') {
        this.state = CREATURE_STATES.TRAINING;
        this._moveGoal = null;
        return;
      }
      if (this._moveGoal === 'attack') {
        this.state = CREATURE_STATES.IDLE;
        this._moveGoal = null;
        return;
      }
      this.state = CREATURE_STATES.IDLE;
      this._moveGoal = null;
      return;
    }
    this._followPath(dt);
  }

  _updateIdle(dt) {
    this._idleTimer += dt;
    if (this._idleTimer > 2) {
      this._idleTimer = 0;
      this._wanderRandomly();
    }
    if (this._path) {
      this._followPath(dt);
      if (!this._path || this._pathIndex >= this._path.length) {
        this._path = null;
      }
    }
  }

  _wanderRandomly() {
    const { tx, ty } = this.getTile(TILE_SIZE);
    for (let i = 0; i < 5; i++) {
      const nx = tx + Math.floor(Math.random() * 6) - 3;
      const ny = ty + Math.floor(Math.random() * 6) - 3;
      if (this._world.isWalkable(nx, ny)) {
        this._pathToTile(nx, ny);
        return;
      }
    }
  }

  _findNearestEnemy() {
    const aggroRange = TILE_SIZE * 10;
    let nearest = null;
    let nearestDist = Infinity;
    for (const e of this._entityManager.getAll()) {
      if (!e.alive || e.team === this.team || e.team === null) continue;
      const dx = e.x - this.x;
      const dy = e.y - this.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < nearestDist && dist < aggroRange) {
        nearestDist = dist;
        nearest = e;
      }
    }
    return nearest;
  }

  _findNearestTile(tiles) {
    const { tx, ty } = this.getTile(TILE_SIZE);
    let best = null;
    let bestDist = Infinity;
    for (const t of tiles) {
      const dist = Math.abs(t.x - tx) + Math.abs(t.y - ty);
      if (dist < bestDist) {
        bestDist = dist;
        best = t;
      }
    }
    return best;
  }

  _pathToTile(tx, ty) {
    const { tx: sx, ty: sy } = this.getTile(TILE_SIZE);
    const path = Pathfinder.findPath(this._world, sx, sy, tx, ty);
    if (path && path.length > 0) {
      this._path = path;
      this._pathIndex = 0;
      if (this.state === CREATURE_STATES.IDLE) {
        this.state = CREATURE_STATES.MOVING;
      }
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

  get facingRight() { return this._facingRight; }
}
