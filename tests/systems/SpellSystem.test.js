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
