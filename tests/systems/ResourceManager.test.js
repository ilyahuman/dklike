import { describe, it, expect, vi } from 'vitest';
import { ResourceManager } from '../../src/systems/ResourceManager.js';
import { EventBus } from '../../src/core/EventBus.js';
import { RESOURCES, EVENTS, DUNGEON_HEART_HP } from '../../src/constants.js';

describe('ResourceManager', () => {
  it('starts with STARTING_GOLD and STARTING_MANA', () => {
    const rm = new ResourceManager(new EventBus());
    expect(rm.gold).toBe(RESOURCES.STARTING_GOLD);
    expect(rm.mana).toBe(RESOURCES.STARTING_MANA);
  });

  it('publishes RESOURCES_CHANGED on construction', () => {
    const eventBus = new EventBus();
    const spy = vi.fn();
    eventBus.subscribe(EVENTS.RESOURCES_CHANGED, spy);
    const rm = new ResourceManager(eventBus);
    expect(spy).toHaveBeenCalledWith(expect.objectContaining({
      gold: RESOURCES.STARTING_GOLD,
      mana: RESOURCES.STARTING_MANA,
    }));
  });

  it('earnGold adds gold up to cap', () => {
    const rm = new ResourceManager(new EventBus());
    rm.earnGold(300);
    expect(rm.gold).toBe(RESOURCES.STARTING_GOLD + 300);
    rm.earnGold(800);
    expect(rm.gold).toBe(RESOURCES.GOLD_BASE_CAP);
  });

  it('spendGold deducts gold and returns true', () => {
    const rm = new ResourceManager(new EventBus());
    rm.earnGold(200);
    expect(rm.spendGold(300)).toBe(true);
    expect(rm.gold).toBe(RESOURCES.STARTING_GOLD + 200 - 300);
  });

  it('spendGold returns false if insufficient gold', () => {
    const rm = new ResourceManager(new EventBus());
    rm.earnGold(100);
    expect(rm.spendGold(RESOURCES.STARTING_GOLD + 200)).toBe(false);
    expect(rm.gold).toBe(RESOURCES.STARTING_GOLD + 100);
  });

  it('mana regenerates via update(dt)', () => {
    const rm = new ResourceManager(new EventBus());
    const before = rm.mana;
    rm.update(1.0);
    expect(rm.mana).toBeCloseTo(before + RESOURCES.MANA_REGEN_PER_SEC);
  });

  it('mana clamped to MANA_CAP', () => {
    const rm = new ResourceManager(new EventBus());
    rm.update(9999);
    expect(rm.mana).toBe(RESOURCES.MANA_CAP);
  });

  it('setTreasuryTileCount scales gold cap', () => {
    const rm = new ResourceManager(new EventBus());
    rm.setTreasuryTileCount(4);
    const expectedCap = RESOURCES.GOLD_BASE_CAP + 4 * RESOURCES.GOLD_PER_TREASURY_TILE;
    expect(rm.goldCap).toBe(expectedCap);
  });

  it('publishes RESOURCES_CHANGED on earnGold', () => {
    const eventBus = new EventBus();
    const spy = vi.fn();
    eventBus.subscribe(EVENTS.RESOURCES_CHANGED, spy);
    const rm = new ResourceManager(eventBus);
    rm.earnGold(100);
    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ gold: RESOURCES.STARTING_GOLD + 100 }));
  });

  it('spendMana deducts mana and returns true', () => {
    const rm = new ResourceManager(new EventBus());
    rm.update(10);
    const before = rm.mana;
    expect(rm.spendMana(10)).toBe(true);
    expect(rm.mana).toBeCloseTo(before - 10);
  });

  it('spendMana returns false if insufficient', () => {
    const rm = new ResourceManager(new EventBus());
    expect(rm.spendMana(RESOURCES.STARTING_MANA + 100)).toBe(false);
    expect(rm.mana).toBe(RESOURCES.STARTING_MANA);
  });

  it('getSnapshot returns current state', () => {
    const rm = new ResourceManager(new EventBus());
    rm.earnGold(300);
    rm.update(1.0);
    const snap = rm.getSnapshot();
    expect(snap.gold).toBe(RESOURCES.STARTING_GOLD + 300);
    expect(snap.mana).toBeCloseTo(RESOURCES.STARTING_MANA + RESOURCES.MANA_REGEN_PER_SEC);
    expect(snap.goldCap).toBe(RESOURCES.GOLD_BASE_CAP);
    expect(snap.manaCap).toBe(RESOURCES.MANA_CAP);
  });
});

describe('Dungeon Heart HP', () => {
  it('should start with full HP', () => {
    const rm = new ResourceManager(new EventBus());
    expect(rm.heartHP).toBe(DUNGEON_HEART_HP);
    expect(rm.heartMaxHP).toBe(DUNGEON_HEART_HP);
  });

  it('damageHeart should reduce HP', () => {
    const rm = new ResourceManager(new EventBus());
    rm.damageHeart(100);
    expect(rm.heartHP).toBe(DUNGEON_HEART_HP - 100);
  });

  it('damageHeart should not go below 0', () => {
    const rm = new ResourceManager(new EventBus());
    rm.damageHeart(DUNGEON_HEART_HP + 100);
    expect(rm.heartHP).toBe(0);
  });

  it('should return true from isHeartDestroyed when HP is 0', () => {
    const rm = new ResourceManager(new EventBus());
    rm.damageHeart(DUNGEON_HEART_HP);
    expect(rm.isHeartDestroyed).toBe(true);
  });

  it('should publish RESOURCES_CHANGED when heart damaged', () => {
    const eb = new EventBus();
    vi.spyOn(eb, 'publish');
    const rm = new ResourceManager(eb);
    rm.damageHeart(50);
    expect(eb.publish).toHaveBeenCalledWith(EVENTS.RESOURCES_CHANGED, expect.objectContaining({ heartHP: DUNGEON_HEART_HP - 50 }));
  });
});
