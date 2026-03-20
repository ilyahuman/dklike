import { describe, it, expect, vi } from 'vitest';
import { ResourceManager } from '../../src/systems/ResourceManager.js';
import { EventBus } from '../../src/core/EventBus.js';
import { RESOURCES, EVENTS } from '../../src/constants.js';

describe('ResourceManager', () => {
  it('starts with zero gold and zero mana', () => {
    const rm = new ResourceManager(new EventBus());
    expect(rm.gold).toBe(0);
    expect(rm.mana).toBe(0);
  });

  it('earnGold adds gold up to cap', () => {
    const rm = new ResourceManager(new EventBus());
    rm.earnGold(500);
    expect(rm.gold).toBe(500);
    rm.earnGold(800);
    expect(rm.gold).toBe(RESOURCES.GOLD_BASE_CAP);
  });

  it('spendGold deducts gold and returns true', () => {
    const rm = new ResourceManager(new EventBus());
    rm.earnGold(500);
    expect(rm.spendGold(200)).toBe(true);
    expect(rm.gold).toBe(300);
  });

  it('spendGold returns false if insufficient gold', () => {
    const rm = new ResourceManager(new EventBus());
    rm.earnGold(100);
    expect(rm.spendGold(200)).toBe(false);
    expect(rm.gold).toBe(100);
  });

  it('mana regenerates via update(dt)', () => {
    const rm = new ResourceManager(new EventBus());
    rm.update(1.0);
    expect(rm.mana).toBeCloseTo(RESOURCES.MANA_REGEN_PER_SEC);
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
    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ gold: 100 }));
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
    expect(rm.spendMana(100)).toBe(false);
    expect(rm.mana).toBe(0);
  });

  it('getSnapshot returns current state', () => {
    const rm = new ResourceManager(new EventBus());
    rm.earnGold(300);
    rm.update(1.0);
    const snap = rm.getSnapshot();
    expect(snap.gold).toBe(300);
    expect(snap.mana).toBeCloseTo(RESOURCES.MANA_REGEN_PER_SEC);
    expect(snap.goldCap).toBe(RESOURCES.GOLD_BASE_CAP);
    expect(snap.manaCap).toBe(RESOURCES.MANA_CAP);
  });
});
