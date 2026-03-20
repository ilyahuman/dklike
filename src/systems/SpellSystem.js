import { Imp } from '../entities/Imp.js';
import { SPELL_TYPES, SPELL_CONFIG, EVENTS, TILE_SIZE, ROOM_TYPES, ENTITY_TYPES } from '../constants.js';

/**
 * Manages spell selection, casting, and possess mode.
 * Communicates with other systems via EventBus.
 */
export class SpellSystem {
  /**
   * @param {import('../world/World.js').World} world
   * @param {import('../entities/EntityManager.js').EntityManager} entityManager
   * @param {import('../core/EventBus.js').EventBus} eventBus
   * @param {import('./ResourceManager.js').ResourceManager} resourceManager
   * @param {import('./RoomManager.js').RoomManager} roomManager
   * @param {import('./JobQueue.js').JobQueue|null} [jobQueue=null]
   */
  constructor(world, entityManager, eventBus, resourceManager, roomManager, jobQueue = null) {
    this._world = world;
    this._entityManager = entityManager;
    this._eventBus = eventBus;
    this._resourceManager = resourceManager;
    this._roomManager = roomManager;
    this._jobQueue = jobQueue;

    /** @type {string|null} Currently selected spell type */
    this._activeSpell = null;

    /** @type {{timer: number, position: {x: number, y: number}|null}} */
    this._castAnim = { timer: 0, position: null };

    /** @type {number|null} ID of the possessed entity */
    this._possessedEntityId = null;
  }

  // ── Spell selection ──────────────────────────────────

  /**
   * Set the active spell (or clear with null).
   * @param {string|null} type - SPELL_TYPES value or null.
   */
  selectSpell(type) {
    this._activeSpell = type;
  }

  /**
   * @returns {string|null} Currently selected spell type.
   */
  getActiveSpell() {
    return this._activeSpell;
  }

  // ── Create Imp ───────────────────────────────────────

  /**
   * Cast the Create Imp spell: spend mana, spawn an Imp at the dungeon heart.
   * @returns {boolean} True if cast succeeded.
   */
  castCreateImp() {
    const config = SPELL_CONFIG[SPELL_TYPES.CREATE_IMP];

    // Try to spend mana
    if (!this._resourceManager.spendMana(config.manaCost)) {
      return false;
    }

    // Find dungeon heart center tile
    const heartTiles = this._roomManager.getRoomTilesOfType(ROOM_TYPES.DUNGEON_HEART);
    if (!heartTiles || heartTiles.length === 0) return false;

    // Use the center of the first heart tile (in pixels)
    const tile = heartTiles[Math.floor(heartTiles.length / 2)];
    const px = tile.x * TILE_SIZE + TILE_SIZE / 2;
    const py = tile.y * TILE_SIZE + TILE_SIZE / 2;

    // Spawn Imp
    const imp = new Imp(px, py, this._world, this._eventBus, this._jobQueue, this._roomManager);
    imp.team = 'player';
    this._entityManager.add(imp);

    // Set cast animation timer
    this._castAnim = { timer: config.castTime, position: { x: px, y: py } };

    // Publish events
    this._eventBus.publish(EVENTS.SPELL_CAST, {
      spell: SPELL_TYPES.CREATE_IMP,
      x: px,
      y: py,
    });
    this._eventBus.publish(EVENTS.ENTITY_SPAWNED, {
      entityId: imp.id,
      type: ENTITY_TYPES.IMP,
      x: px,
      y: py,
    });

    return true;
  }

  // ── Lightning Strike ─────────────────────────────────

  /**
   * Cast Lightning Strike at world coordinates.
   * AoE 3x3 tile damage, skipping player-team entities.
   * @param {number} worldX - Target X in pixels.
   * @param {number} worldY - Target Y in pixels.
   * @returns {boolean} True if cast succeeded.
   */
  castLightningStrike(worldX, worldY) {
    const config = SPELL_CONFIG[SPELL_TYPES.LIGHTNING_STRIKE];

    // Check for friendlies-only in area
    const radiusPx = config.aoeRadius * TILE_SIZE;
    const entitiesInArea = this._entityManager.getEntitiesInRadius(worldX, worldY, radiusPx);
    const hasEnemies = entitiesInArea.some(e => e.alive && e.team && e.team !== 'player');
    if (!hasEnemies && entitiesInArea.some(e => e.alive && e.team === 'player')) {
      return false; // Only friendlies in area
    }

    // Try to spend mana
    if (!this._resourceManager.spendMana(config.manaCost)) {
      return false;
    }

    // Apply AoE damage to non-player entities
    for (const entity of entitiesInArea) {
      if (!entity.alive || entity.team === 'player') continue;
      entity.takeDamage(config.damage);
      this._eventBus.publish(EVENTS.ENTITY_DAMAGED, {
        targetId: entity.id,
        attackerId: null,
        damage: config.damage,
        x: entity.x,
        y: entity.y,
      });
      if (entity.isDead()) {
        entity.alive = false;
        this._eventBus.publish(EVENTS.ENTITY_DIED, {
          entityId: entity.id,
          type: entity.type,
          x: entity.x,
          y: entity.y,
          team: entity.team,
          goldDrop: entity.goldDrop || 0,
        });
      }
    }

    // Set cast animation
    this._castAnim = { timer: config.shakeDuration, position: { x: worldX, y: worldY } };

    // Publish spell cast event
    this._eventBus.publish(EVENTS.SPELL_CAST, {
      spell: SPELL_TYPES.LIGHTNING_STRIKE,
      x: worldX,
      y: worldY,
    });

    return true;
  }

  // ── Possess ──────────────────────────────────────────

  /**
   * Possess a player-team creature.
   * @param {number} entityId
   * @returns {boolean} True if possession succeeded.
   */
  castPossess(entityId) {
    const entity = this._entityManager.getById(entityId);
    if (!entity || !entity.alive || entity.team !== 'player') return false;

    const config = SPELL_CONFIG[SPELL_TYPES.POSSESS_CREATURE];
    if (!this._resourceManager.spendMana(config.manaCost)) return false;

    // If already possessing, unpossess first
    if (this._possessedEntityId !== null) {
      this.unpossess('switch');
    }

    this._possessedEntityId = entityId;
    entity._aiSuspended = true;

    this._eventBus.publish(EVENTS.POSSESS_START, {
      entityId,
      entityType: entity.type,
    });

    this._eventBus.publish(EVENTS.SPELL_CAST, {
      spell: SPELL_TYPES.POSSESS_CREATURE,
      entityId,
    });

    return true;
  }

  /**
   * End possession.
   * @param {string} [reason='manual']
   */
  unpossess(reason = 'manual') {
    if (this._possessedEntityId === null) return;

    const entity = this._entityManager.getById(this._possessedEntityId);
    if (entity) {
      entity._aiSuspended = false;
    }

    const entityId = this._possessedEntityId;
    this._possessedEntityId = null;

    this._eventBus.publish(EVENTS.POSSESS_END, {
      entityId,
      reason,
    });
  }

  /**
   * Move the possessed creature.
   * @param {number} dx - Direction X (-1, 0, 1).
   * @param {number} dy - Direction Y (-1, 0, 1).
   * @param {number} dt - Delta time in seconds.
   */
  movePossessed(dx, dy, dt) {
    if (this._possessedEntityId === null) return;

    const entity = this._entityManager.getById(this._possessedEntityId);
    if (!entity || !entity.alive) return;

    const speed = (entity.speed || 80) * dt;
    const newX = entity.x + dx * speed;
    const newY = entity.y + dy * speed;

    // Check walkability at the target tile
    const tx = Math.floor(newX / TILE_SIZE);
    const ty = Math.floor(newY / TILE_SIZE);
    if (this._world.isWalkable(tx, ty)) {
      entity.x = newX;
      entity.y = newY;
    }
  }

  /**
   * Make the possessed creature attack the nearest enemy.
   * @returns {boolean} True if an attack was performed.
   */
  possessedAttack() {
    if (this._possessedEntityId === null) return false;

    const entity = this._entityManager.getById(this._possessedEntityId);
    if (!entity || !entity.alive || !entity.damage) return false;
    if (entity._attackTimer > 0) return false;

    // Find nearest enemy in range
    const rangePx = (entity.attackRange || 1.5) * TILE_SIZE;
    const nearby = this._entityManager.getEntitiesInRadius(entity.x, entity.y, rangePx);
    let nearest = null;
    let nearestDist = Infinity;

    for (const other of nearby) {
      if (!other.alive || other.team === 'player' || other.team === null) continue;
      const dx = other.x - entity.x;
      const dy = other.y - entity.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearest = other;
      }
    }

    if (!nearest) return false;

    // Deal damage
    entity._attackTimer = entity.attackCooldown;
    nearest.takeDamage(entity.damage);

    this._eventBus.publish(EVENTS.ENTITY_DAMAGED, {
      targetId: nearest.id,
      attackerId: entity.id,
      damage: entity.damage,
      x: nearest.x,
      y: nearest.y,
    });

    if (nearest.isDead()) {
      nearest.alive = false;
      this._eventBus.publish(EVENTS.ENTITY_DIED, {
        entityId: nearest.id,
        type: nearest.type,
        x: nearest.x,
        y: nearest.y,
        team: nearest.team,
        goldDrop: nearest.goldDrop || 0,
      });
    }

    return true;
  }

  // ── Update loop ──────────────────────────────────────

  /**
   * @param {number} dt - Delta time in seconds.
   */
  update(dt) {
    // Update cast animation timer
    if (this._castAnim.timer > 0) {
      this._castAnim.timer = Math.max(0, this._castAnim.timer - dt);
      if (this._castAnim.timer <= 0) {
        this._castAnim.position = null;
      }
    }

    // Auto-unpossess dead creatures
    if (this._possessedEntityId !== null) {
      const entity = this._entityManager.getById(this._possessedEntityId);
      if (!entity || !entity.alive) {
        this.unpossess('death');
      }
    }
  }

  // ── Getters ──────────────────────────────────────────

  /**
   * @returns {{timer: number, position: {x: number, y: number}|null}}
   */
  getCastAnimState() {
    return { timer: this._castAnim.timer, position: this._castAnim.position };
  }

  /** @returns {boolean} */
  get isPossessing() {
    return this._possessedEntityId !== null;
  }

  /** @returns {number|null} */
  get possessedEntityId() {
    return this._possessedEntityId;
  }
}
