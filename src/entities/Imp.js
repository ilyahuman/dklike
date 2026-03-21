import { Entity } from './Entity.js';
import { Pathfinder } from '../world/Pathfinder.js';
import { ENTITY_TYPES, CREATURE_STATES, IMP_STATS, TILE_SIZE, TILE_TYPES, EVENTS, ROOM_TYPES, RESOURCES } from '../constants.js';

/**
 * Imp worker creature with autonomous AI.
 * Priority: flee (health < 20) -> eat (hunger < 30) -> sleep (energy < 20) -> dig -> idle wander.
 * Note: CARRYING is deferred to Phase 3 when Treasury rooms exist.
 * Imp directly references World and JobQueue for pragmatic pathfinding/job access.
 */
export class Imp extends Entity {
  /**
   * @param {number} x - World X in pixels.
   * @param {number} y - World Y in pixels.
   * @param {import('../world/World.js').World} world
   * @param {import('../core/EventBus.js').EventBus} eventBus
   * @param {import('../systems/JobQueue.js').JobQueue} jobQueue
   * @param {import('../systems/RoomManager.js').RoomManager|null} [roomManager=null]
   */
  constructor(x, y, world, eventBus, jobQueue, roomManager = null) {
    super(ENTITY_TYPES.IMP, x, y);
    this.health = IMP_STATS.hp;
    this.maxHealth = IMP_STATS.hp;
    this.hunger = IMP_STATS.maxHunger;
    this.energy = IMP_STATS.maxEnergy;
    this.happiness = IMP_STATS.maxHappiness;
    this.state = CREATURE_STATES.IDLE;

    this._world = world;
    this._eventBus = eventBus;
    this._jobQueue = jobQueue;
    this._roomManager = roomManager;

    /** @type {Array<{x:number,y:number}>|null} */
    this._path = null;
    this._pathIndex = 0;
    this._currentJob = null;
    this._digProgress = 0;
    this._idleTimer = 0;
    this._wanderTarget = null;
    this._facingRight = true;
    this._eatTimer = 0;
    this._sleepTimer = 0;
    /** @type {'dig'|'eat'|'sleep'|'wander'|null} */
    this._moveGoal = null;
    /** @type {boolean} True when continuously mining a gem seam. */
    this._miningGemSeam = false;
    /** @type {number} Accumulator for gem seam gold ticks. */
    this._mineAccumulator = 0;
  }

  /**
   * @param {number} dt - Delta time in seconds.
   */
  update(dt) {
    // Drain needs over time
    this.hunger = Math.max(0, this.hunger - dt * 0.5);
    this.energy = Math.max(0, this.energy - dt * 0.3);

    // Priority-based AI: flee -> eat -> sleep -> (continue current) -> decide
    if (this.health < IMP_STATS.fleeHealthThreshold) {
      this._enterFlee();
    } else if (this.state === CREATURE_STATES.FLEEING) {
      this._updateFlee(dt);
    } else if (this.state === CREATURE_STATES.EATING) {
      this._updateEat(dt);
    } else if (this.state === CREATURE_STATES.SLEEPING) {
      this._updateSleep(dt);
    } else if (this.hunger < IMP_STATS.hungerThreshold && this.state !== CREATURE_STATES.DIGGING) {
      this._enterEat();
    } else if (this.energy < IMP_STATS.energyThreshold && this.state !== CREATURE_STATES.DIGGING) {
      this._enterSleep();
    } else if (this.state === CREATURE_STATES.DIGGING) {
      this._updateDig(dt);
    } else if (this.state === CREATURE_STATES.MOVING) {
      this._updateMove(dt);
    } else {
      // IDLE -- look for work
      this._decideAction();
      if (this.state === CREATURE_STATES.IDLE) {
        this._updateIdle(dt);
      }
    }
  }

  /** @private */
  _decideAction() {
    // Try to claim a dig job (only if energy above threshold)
    if (this.energy > IMP_STATS.energyThreshold && !this._currentJob) {
      const pending = this._jobQueue.getPendingDigJobs();
      for (const job of pending) {
        job.assignedTo = this.id;
        this._currentJob = job;
        this._pathToAdjacentWalkable(job.x, job.y);
        if (this._path) {
          this._moveGoal = 'dig';
          return;
        }
        // Can't reach this job — release and try next
        job.assignedTo = null;
        this._currentJob = null;
      }
    }

    // No work -- wander
    this.state = CREATURE_STATES.IDLE;
    this._moveGoal = null;
  }

  /** @private */
  _enterFlee() {
    if (this.state === CREATURE_STATES.FLEEING) return;
    this.state = CREATURE_STATES.FLEEING;
    // Release any job
    if (this._currentJob) {
      this._jobQueue.releaseJob(this.id);
      this._currentJob = null;
      this._miningGemSeam = false;
    }
    // Path toward center of map (dungeon heart area)
    const cx = Math.floor(this._world.width / 2);
    const cy = Math.floor(this._world.height / 2);
    this._pathToTile(cx, cy);
  }

  /** @private */
  _updateFlee(dt) {
    if (this.health >= IMP_STATS.fleeHealthThreshold) {
      this.state = CREATURE_STATES.IDLE;
      this._path = null;
      return;
    }
    this._followPath(dt);
  }

  /** @private */
  _enterEat() {
    if (this.state === CREATURE_STATES.EATING) return;
    if (this._currentJob) {
      this._jobQueue.releaseJob(this.id);
      this._currentJob = null;
      this._miningGemSeam = false;
    }

    // Try to find a Hatchery room tile
    if (this._roomManager) {
      const tiles = this._roomManager.getRoomTilesOfType(ROOM_TYPES.HATCHERY);
      if (tiles.length > 0) {
        const target = this._findNearestRoomTile(tiles);
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

    // Fallback: eat in place
    this.state = CREATURE_STATES.EATING;
    this._eatTimer = 0;
    this._path = null;
    this._moveGoal = null;
  }

  /** @private */
  _updateEat(dt) {
    this._eatTimer += dt;
    // Restore hunger over 3 seconds
    this.hunger = Math.min(IMP_STATS.maxHunger, this.hunger + dt * 20);
    if (this.hunger >= IMP_STATS.maxHunger * 0.8 || this._eatTimer > 3) {
      this.state = CREATURE_STATES.IDLE;
    }
  }

  /** @private */
  _enterSleep() {
    if (this.state === CREATURE_STATES.SLEEPING) return;
    if (this._currentJob) {
      this._jobQueue.releaseJob(this.id);
      this._currentJob = null;
      this._miningGemSeam = false;
    }

    // Try to find a Lair room tile
    if (this._roomManager) {
      const tiles = this._roomManager.getRoomTilesOfType(ROOM_TYPES.LAIR);
      if (tiles.length > 0) {
        const target = this._findNearestRoomTile(tiles);
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

    // Fallback: sleep in place
    this.state = CREATURE_STATES.SLEEPING;
    this._sleepTimer = 0;
    this._path = null;
    this._moveGoal = null;
  }

  /** @private */
  _updateSleep(dt) {
    this._sleepTimer += dt;
    // Restore energy over 4 seconds
    this.energy = Math.min(IMP_STATS.maxEnergy, this.energy + dt * 15);
    if (this.energy >= IMP_STATS.maxEnergy * 0.8 || this._sleepTimer > 4) {
      this.state = CREATURE_STATES.IDLE;
    }
  }

  /** @private */
  _updateMove(dt) {
    if (!this._path || this._pathIndex >= this._path.length) {
      // Arrived at destination — check moveGoal
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
      if (this._currentJob) {
        const { tx, ty } = this.getTile(TILE_SIZE);
        const job = this._currentJob;
        const dist = Math.abs(tx - job.x) + Math.abs(ty - job.y);
        if (dist <= 1) {
          this.state = CREATURE_STATES.DIGGING;
          this._digProgress = 0;
          this._moveGoal = null;
          return;
        }
        this._pathToAdjacentWalkable(job.x, job.y);
        if (!this._path) {
          this._jobQueue.releaseJob(this.id);
          this._currentJob = null;
          this.state = CREATURE_STATES.IDLE;
          this._moveGoal = null;
        }
      } else {
        this.state = CREATURE_STATES.IDLE;
        this._moveGoal = null;
      }
      return;
    }
    this._followPath(dt);
  }

  /** @private */
  _updateDig(dt) {
    if (!this._currentJob) {
      this.state = CREATURE_STATES.IDLE;
      this._miningGemSeam = false;
      return;
    }
    const { x, y } = this._currentJob;
    const tileType = this._world.getTile(x, y);

    // Continuous gem seam mining mode
    if (this._miningGemSeam) {
      this._mineAccumulator += dt;
      if (this._mineAccumulator >= 1.0) {
        this._mineAccumulator -= 1.0;
        this._eventBus.publish(EVENTS.TILE_DUG, {
          x, y, tileType, goldAmount: RESOURCES.GEM_SEAM_GOLD_PER_SEC,
        });
      }
      return;
    }

    this._digProgress += dt;
    if (this._digProgress >= IMP_STATS.digTime) {
      if (tileType === TILE_TYPES.GEM_SEAM) {
        // Gem seam: don't consume tile, enter continuous mining
        this._miningGemSeam = true;
        this._mineAccumulator = 0;
        this._eventBus.publish(EVENTS.TILE_DUG, { x, y, tileType });
        Pathfinder.clearCache();
        return;
      }
      // Normal dig: convert to floor
      this._world.setTile(x, y, TILE_TYPES.UNCLAIMED_FLOOR);
      this._claimAdjacentFloor(x, y);
      this._eventBus.publish(EVENTS.TILE_DUG, { x, y, tileType });
      Pathfinder.clearCache();
      this._jobQueue.completeDigJob(x, y);
      this._currentJob = null;
      this._digProgress = 0;
      this.state = CREATURE_STATES.IDLE;
    }
  }

  /** @private */
  _updateIdle(dt) {
    this._idleTimer += dt;
    if (this._idleTimer > 2) {
      this._idleTimer = 0;
      // Random wander on claimed floor
      this._wanderRandomly();
    }
    if (this._wanderTarget) {
      this._followPath(dt);
      if (!this._path || this._pathIndex >= this._path.length) {
        this._wanderTarget = null;
      }
    }
  }

  /** @private */
  _wanderRandomly() {
    const { tx, ty } = this.getTile(TILE_SIZE);
    const range = 3;
    for (let attempt = 0; attempt < 5; attempt++) {
      const nx = tx + Math.floor(Math.random() * range * 2) - range;
      const ny = ty + Math.floor(Math.random() * range * 2) - range;
      if (this._world.isWalkable(nx, ny)) {
        this._pathToTile(nx, ny);
        this._wanderTarget = { x: nx, y: ny };
        return;
      }
    }
  }

  /** @private */
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

  /**
   * Pathfind to a walkable tile adjacent to (tx, ty).
   * @private
   */
  _pathToAdjacentWalkable(tx, ty) {
    const { tx: sx, ty: sy } = this.getTile(TILE_SIZE);
    const dirs = [[0, -1], [0, 1], [-1, 0], [1, 0]];
    for (const [dx, dy] of dirs) {
      const nx = tx + dx;
      const ny = ty + dy;
      if (this._world.isWalkable(nx, ny)) {
        const path = Pathfinder.findPath(this._world, sx, sy, nx, ny);
        if (path) {
          this._path = path;
          this._pathIndex = 0;
          this.state = CREATURE_STATES.MOVING;
          return;
        }
      }
    }
    this._path = null;
  }

  /**
   * Find the nearest room tile by Manhattan distance.
   * @private
   */
  _findNearestRoomTile(tiles) {
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

  /** @private */
  _followPath(dt) {
    if (!this._path || this._pathIndex >= this._path.length) return;

    const target = this._path[this._pathIndex];
    // Target is center of tile
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

    const speed = IMP_STATS.speed * dt;
    const move = Math.min(speed, dist);
    this.x += (dx / dist) * move;
    this.y += (dy / dist) * move;
    this._facingRight = dx > 0;
  }

  /**
   * Claim adjacent unclaimed floor tiles.
   * @private
   */
  _claimAdjacentFloor(cx, cy) {
    const dirs = [[0, -1], [0, 1], [-1, 0], [1, 0]];
    for (const [dx, dy] of dirs) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (this._world.getTile(nx, ny) === TILE_TYPES.UNCLAIMED_FLOOR) {
        this._world.setTile(nx, ny, TILE_TYPES.CLAIMED_FLOOR);
      }
    }
    // Also claim the newly dug tile
    this._world.setTile(cx, cy, TILE_TYPES.CLAIMED_FLOOR);
  }

  /** @returns {number} Dig progress 0-1. */
  get digProgressRatio() {
    if (this.state !== CREATURE_STATES.DIGGING) return 0;
    return Math.min(1, this._digProgress / IMP_STATS.digTime);
  }

  /** @returns {boolean} */
  get facingRight() { return this._facingRight; }
}
