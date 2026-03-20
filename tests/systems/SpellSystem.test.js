import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SpellSystem } from '../../src/systems/SpellSystem.js';
import { SPELL_TYPES, SPELL_CONFIG, EVENTS, TILE_SIZE, ROOM_TYPES, ENTITY_TYPES } from '../../src/constants.js';

// ── Test helpers ───────────────────────────────────────

function makeEventBus() {
  const subs = {};
  return {
    publish: vi.fn((event, data) => { (subs[event] || []).forEach(fn => fn(data)); }),
    subscribe: vi.fn((event, fn) => { if (!subs[event]) subs[event] = []; subs[event].push(fn); }),
  };
}

function makeResourceManager(gold = 1000, mana = 500) {
  return {
    gold, mana,
    spendMana: vi.fn(function(amount) { if (this.mana < amount) return false; this.mana -= amount; return true; }),
    spendGold: vi.fn(function(amount) { if (this.gold < amount) return false; this.gold -= amount; return true; }),
  };
}

function makeEntityManager() {
  const entities = new Map();
  return {
    add: vi.fn(e => entities.set(e.id, e)),
    getAll: () => Array.from(entities.values()),
    getById: id => entities.get(id),
    getEntitiesInRadius: vi.fn(() => []),
    getByType: vi.fn(type => Array.from(entities.values()).filter(e => e.type === type)),
  };
}

function makeWorld() {
  return { width: 80, height: 60, getTile: vi.fn(() => 'claimed_floor'), isWalkable: vi.fn(() => true), getNeighbors: vi.fn(() => []) };
}

function makeRoomManager() {
  return {
    getRoomTilesOfType: vi.fn(() => [{ x: 40, y: 30 }]),
    getRoomAt: vi.fn(() => ({ type: 'dungeon_heart' })),
    isRoomTile: vi.fn(() => false),
  };
}

// ── Tests ──────────────────────────────────────────────

describe('SpellSystem', () => {
  let world, entityManager, eventBus, resourceManager, roomManager, spellSystem;

  beforeEach(() => {
    world = makeWorld();
    entityManager = makeEntityManager();
    eventBus = makeEventBus();
    resourceManager = makeResourceManager();
    roomManager = makeRoomManager();
    spellSystem = new SpellSystem(world, entityManager, eventBus, resourceManager, roomManager);
  });

  // ── selectSpell / getActiveSpell ─────────────────────

  describe('selectSpell / getActiveSpell', () => {
    it('returns null when no spell is selected', () => {
      expect(spellSystem.getActiveSpell()).toBeNull();
    });

    it('sets and returns the active spell', () => {
      spellSystem.selectSpell(SPELL_TYPES.CREATE_IMP);
      expect(spellSystem.getActiveSpell()).toBe(SPELL_TYPES.CREATE_IMP);
    });

    it('clears active spell with null', () => {
      spellSystem.selectSpell(SPELL_TYPES.CREATE_IMP);
      spellSystem.selectSpell(null);
      expect(spellSystem.getActiveSpell()).toBeNull();
    });

    it('switches between spell types', () => {
      spellSystem.selectSpell(SPELL_TYPES.CREATE_IMP);
      spellSystem.selectSpell(SPELL_TYPES.LIGHTNING_STRIKE);
      expect(spellSystem.getActiveSpell()).toBe(SPELL_TYPES.LIGHTNING_STRIKE);
    });
  });

  // ── castCreateImp ────────────────────────────────────

  describe('castCreateImp', () => {
    it('returns true and spawns an imp when mana is sufficient', () => {
      const result = spellSystem.castCreateImp();
      expect(result).toBe(true);
      expect(entityManager.add).toHaveBeenCalledTimes(1);
      const addedEntity = entityManager.add.mock.calls[0][0];
      expect(addedEntity.type).toBe(ENTITY_TYPES.IMP);
      expect(addedEntity.team).toBe('player');
    });

    it('returns false when mana is insufficient', () => {
      resourceManager.mana = 100; // Less than 200 required
      const result = spellSystem.castCreateImp();
      expect(result).toBe(false);
      expect(entityManager.add).not.toHaveBeenCalled();
    });

    it('spends the correct amount of mana', () => {
      const initialMana = resourceManager.mana;
      spellSystem.castCreateImp();
      expect(resourceManager.spendMana).toHaveBeenCalledWith(SPELL_CONFIG[SPELL_TYPES.CREATE_IMP].manaCost);
      expect(resourceManager.mana).toBe(initialMana - 200);
    });

    it('spawns imp at dungeon heart tile center', () => {
      const heartTile = { x: 40, y: 30 };
      roomManager.getRoomTilesOfType.mockReturnValue([heartTile]);
      spellSystem.castCreateImp();
      const imp = entityManager.add.mock.calls[0][0];
      expect(imp.x).toBe(heartTile.x * TILE_SIZE + TILE_SIZE / 2);
      expect(imp.y).toBe(heartTile.y * TILE_SIZE + TILE_SIZE / 2);
    });

    it('publishes SPELL_CAST event', () => {
      spellSystem.castCreateImp();
      expect(eventBus.publish).toHaveBeenCalledWith(
        EVENTS.SPELL_CAST,
        expect.objectContaining({ spell: SPELL_TYPES.CREATE_IMP }),
      );
    });

    it('publishes ENTITY_SPAWNED event', () => {
      spellSystem.castCreateImp();
      expect(eventBus.publish).toHaveBeenCalledWith(
        EVENTS.ENTITY_SPAWNED,
        expect.objectContaining({ type: ENTITY_TYPES.IMP }),
      );
    });

    it('sets castAnimTimer on successful cast', () => {
      spellSystem.castCreateImp();
      const animState = spellSystem.getCastAnimState();
      expect(animState.timer).toBe(SPELL_CONFIG[SPELL_TYPES.CREATE_IMP].castTime);
      expect(animState.position).not.toBeNull();
    });

    it('returns false when no dungeon heart tiles exist', () => {
      roomManager.getRoomTilesOfType.mockReturnValue([]);
      const result = spellSystem.castCreateImp();
      // Mana was spent but no tiles found — still returns false
      // Actually: spendMana succeeds first, then tiles check fails.
      // Let's check the behavior: mana is spent, but no imp is placed.
      expect(result).toBe(false);
    });

    it('queries room manager for dungeon heart tiles', () => {
      spellSystem.castCreateImp();
      expect(roomManager.getRoomTilesOfType).toHaveBeenCalledWith(ROOM_TYPES.DUNGEON_HEART);
    });
  });

  // ── Lightning Strike ────────────────────────────────

  describe('Lightning Strike', () => {
    it('should deal AoE damage to enemies in radius', () => {
      const mockEnemy = {
        id: 'enemy1',
        x: 100,
        y: 100,
        alive: true,
        team: 'dungeon',
        type: ENTITY_TYPES.TROLL,
        takeDamage: vi.fn(),
        isDead: vi.fn(() => false),
      };
      entityManager.getEntitiesInRadius.mockReturnValue([mockEnemy]);

      const result = spellSystem.castLightningStrike(100, 100);

      expect(result).toBe(true);
      expect(mockEnemy.takeDamage).toHaveBeenCalledWith(SPELL_CONFIG[SPELL_TYPES.LIGHTNING_STRIKE].damage);
      expect(eventBus.publish).toHaveBeenCalledWith(
        EVENTS.ENTITY_DAMAGED,
        expect.objectContaining({ targetId: 'enemy1', damage: 80 }),
      );
    });

    it('should not cast when only friendly targets in area', () => {
      const mockFriendly = {
        id: 'ally1',
        x: 100,
        y: 100,
        alive: true,
        team: 'player',
        type: ENTITY_TYPES.IMP,
      };
      entityManager.getEntitiesInRadius.mockReturnValue([mockFriendly]);

      const result = spellSystem.castLightningStrike(100, 100);

      expect(result).toBe(false);
      expect(resourceManager.spendMana).not.toHaveBeenCalled();
    });

    it('should fail when mana is insufficient', () => {
      resourceManager.mana = 0;
      const mockEnemy = {
        id: 'enemy1',
        x: 100,
        y: 100,
        alive: true,
        team: 'dungeon',
      };
      entityManager.getEntitiesInRadius.mockReturnValue([mockEnemy]);

      const result = spellSystem.castLightningStrike(100, 100);

      expect(result).toBe(false);
    });

    it('should publish SPELL_CAST event on success', () => {
      entityManager.getEntitiesInRadius.mockReturnValue([]); // Empty area

      const result = spellSystem.castLightningStrike(200, 300);

      expect(result).toBe(true);
      expect(eventBus.publish).toHaveBeenCalledWith(
        EVENTS.SPELL_CAST,
        expect.objectContaining({
          spell: SPELL_TYPES.LIGHTNING_STRIKE,
          x: 200,
          y: 300,
        }),
      );
    });

    it('should kill entities reduced to 0 HP', () => {
      const mockEnemy = {
        id: 'enemy1',
        x: 100,
        y: 100,
        alive: true,
        team: 'dungeon',
        type: ENTITY_TYPES.TROLL,
        goldDrop: 50,
        takeDamage: vi.fn(),
        isDead: vi.fn(() => true),
      };
      entityManager.getEntitiesInRadius.mockReturnValue([mockEnemy]);

      const result = spellSystem.castLightningStrike(100, 100);

      expect(result).toBe(true);
      expect(mockEnemy.alive).toBe(false);
      expect(eventBus.publish).toHaveBeenCalledWith(
        EVENTS.ENTITY_DIED,
        expect.objectContaining({
          entityId: 'enemy1',
          type: ENTITY_TYPES.TROLL,
          goldDrop: 50,
        }),
      );
    });
  });

  // ── update ───────────────────────────────────────────

  describe('update', () => {
    it('decrements cast animation timer', () => {
      spellSystem.castCreateImp();
      const initialTimer = spellSystem.getCastAnimState().timer;
      spellSystem.update(0.1);
      expect(spellSystem.getCastAnimState().timer).toBe(initialTimer - 0.1);
    });

    it('clears animation position when timer expires', () => {
      spellSystem.castCreateImp();
      spellSystem.update(1.0); // Exceeds castTime of 0.5
      const state = spellSystem.getCastAnimState();
      expect(state.timer).toBe(0);
      expect(state.position).toBeNull();
    });
  });

  // ── Possess Creature ─────────────────────────────────

  describe('Possess Creature', () => {
    let mockCreature;

    beforeEach(() => {
      mockCreature = {
        id: 50, type: 'troll', team: 'player', alive: true,
        x: 100, y: 100, _aiSuspended: false, _facingRight: true,
        _attackTimer: 0, attackRange: 1.2, attackCooldown: 1.0, damage: 15,
        speed: 40,
        getEffectiveSpeed: () => 40,
      };
      entityManager.add(mockCreature);
    });

    it('should possess a player creature and spend mana', () => {
      const result = spellSystem.castPossess(50);
      expect(result).toBe(true);
      expect(spellSystem.isPossessing).toBe(true);
      expect(spellSystem.possessedEntityId).toBe(50);
      expect(mockCreature._aiSuspended).toBe(true);
    });

    it('should not possess enemy entities', () => {
      mockCreature.team = 'enemy';
      const result = spellSystem.castPossess(50);
      expect(result).toBe(false);
    });

    it('should fail when mana insufficient', () => {
      resourceManager.mana = 0;
      const result = spellSystem.castPossess(50);
      expect(result).toBe(false);
    });

    it('should unpossess and restore AI', () => {
      spellSystem.castPossess(50);
      spellSystem.unpossess();
      expect(spellSystem.isPossessing).toBe(false);
      expect(mockCreature._aiSuspended).toBe(false);
    });

    it('should publish POSSESS_START with entityType and POSSESS_END events', () => {
      spellSystem.castPossess(50);
      expect(eventBus.publish).toHaveBeenCalledWith(
        EVENTS.POSSESS_START,
        expect.objectContaining({ entityId: 50, entityType: 'troll' }),
      );

      spellSystem.unpossess();
      expect(eventBus.publish).toHaveBeenCalledWith(
        EVENTS.POSSESS_END,
        expect.objectContaining({ entityId: 50, reason: 'manual' }),
      );
    });

    it('should auto-unpossess with reason=death if creature dies during update', () => {
      spellSystem.castPossess(50);
      mockCreature.alive = false;
      spellSystem.update(0.1);
      expect(spellSystem.isPossessing).toBe(false);
      expect(eventBus.publish).toHaveBeenCalledWith(
        EVENTS.POSSESS_END,
        expect.objectContaining({ entityId: 50, reason: 'death' }),
      );
    });
  });

  // ── movePossessed ──────────────────────────────────

  describe('movePossessed', () => {
    let mockCreature;

    beforeEach(() => {
      mockCreature = {
        id: 50, type: 'troll', team: 'player', alive: true,
        x: 100, y: 100, _aiSuspended: false, _facingRight: true,
        _attackTimer: 0, attackRange: 1.2, attackCooldown: 1.0, damage: 15,
        speed: 40,
        getEffectiveSpeed: () => 40,
      };
      entityManager.add(mockCreature);
      spellSystem.castPossess(50);
    });

    it('should move possessed creature when tile is walkable', () => {
      const oldX = mockCreature.x;
      spellSystem.movePossessed(1, 0, 0.1);
      expect(mockCreature.x).toBeGreaterThan(oldX);
    });

    it('should not move when target tile is not walkable', () => {
      world.isWalkable.mockReturnValue(false);
      const oldX = mockCreature.x;
      spellSystem.movePossessed(1, 0, 0.1);
      expect(mockCreature.x).toBe(oldX);
    });
  });

  // ── possessedAttack ────────────────────────────────

  describe('possessedAttack', () => {
    let mockCreature, mockEnemy;

    beforeEach(() => {
      mockCreature = {
        id: 50, type: 'troll', team: 'player', alive: true,
        x: 100, y: 100, _aiSuspended: false, _facingRight: true,
        _attackTimer: 0, attackRange: 1.2, attackCooldown: 1.0, damage: 15,
        speed: 40,
        getEffectiveSpeed: () => 40,
      };
      mockEnemy = {
        id: 60, type: 'knight', team: 'enemy', alive: true,
        x: 130, y: 100, health: 150, maxHealth: 150, goldDrop: 50,
        takeDamage: vi.fn(function(d) { this.health -= d; }),
        isDead: vi.fn(function() { return this.health <= 0; }),
      };
      entityManager.add(mockCreature);
      entityManager.add(mockEnemy);
      entityManager.getEntitiesInRadius.mockReturnValue([mockEnemy]);
      spellSystem.castPossess(50);
    });

    it('should attack nearest enemy in range', () => {
      const result = spellSystem.possessedAttack();
      expect(result).toBe(true);
      expect(mockEnemy.takeDamage).toHaveBeenCalledWith(15);
    });

    it('should not attack when on cooldown', () => {
      mockCreature._attackTimer = 0.5;
      const result = spellSystem.possessedAttack();
      expect(result).toBe(false);
    });

    it('should not attack when no enemies in range', () => {
      entityManager.getEntitiesInRadius.mockReturnValue([]);
      const result = spellSystem.possessedAttack();
      expect(result).toBe(false);
    });

    it('should kill enemy when HP reaches 0', () => {
      mockEnemy.health = 10;
      const result = spellSystem.possessedAttack();
      expect(result).toBe(true);
      expect(mockEnemy.alive).toBe(false);
      expect(eventBus.publish).toHaveBeenCalledWith(
        EVENTS.ENTITY_DIED,
        expect.objectContaining({ entityId: 60 }),
      );
    });
  });

  // ── Possess getters (initial state) ──────────────────

  describe('possess getters', () => {
    it('isPossessing returns false initially', () => {
      expect(spellSystem.isPossessing).toBe(false);
    });

    it('possessedEntityId returns null initially', () => {
      expect(spellSystem.possessedEntityId).toBeNull();
    });
  });
});
