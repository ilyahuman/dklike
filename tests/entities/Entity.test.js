import { describe, it, expect } from 'vitest';
import { Entity } from '../../src/entities/Entity.js';

describe('Entity', () => {
  it('creates with unique id', () => {
    const e1 = new Entity('imp', 100, 200);
    const e2 = new Entity('imp', 100, 200);
    expect(e1.id).not.toBe(e2.id);
  });

  it('stores type and initial position', () => {
    const e = new Entity('knight', 50, 75);
    expect(e.type).toBe('knight');
    expect(e.x).toBe(50);
    expect(e.y).toBe(75);
  });

  it('has default health, velocity, and state', () => {
    const e = new Entity('imp', 0, 0);
    expect(e.health).toBe(0);
    expect(e.maxHealth).toBe(0);
    expect(e.vx).toBe(0);
    expect(e.vy).toBe(0);
    expect(e.state).toBe('idle');
  });

  it('takeDamage reduces health', () => {
    const e = new Entity('imp', 0, 0);
    e.health = 100;
    e.maxHealth = 100;
    e.takeDamage(30);
    expect(e.health).toBe(70);
  });

  it('takeDamage does not go below zero', () => {
    const e = new Entity('imp', 0, 0);
    e.health = 10;
    e.maxHealth = 100;
    e.takeDamage(50);
    expect(e.health).toBe(0);
  });

  it('isDead returns true when health is zero', () => {
    const e = new Entity('imp', 0, 0);
    e.health = 0;
    expect(e.isDead()).toBe(true);
    e.health = 1;
    expect(e.isDead()).toBe(false);
  });

  it('stores previous position for interpolation', () => {
    const e = new Entity('imp', 10, 20);
    expect(e.prevX).toBe(10);
    expect(e.prevY).toBe(20);
  });

  it('has default combat properties', () => {
    const e = new Entity('imp', 0, 0);
    expect(e.team).toBeNull();
    expect(e.level).toBe(1);
    expect(e.xp).toBe(0);
    expect(e.damage).toBe(0);
    expect(e.attackRange).toBe(0);
    expect(e.attackCooldown).toBe(0);
    expect(e.speed).toBe(0);
    expect(e.maxTargets).toBe(1);
    expect(e.debuffOnHit).toBeNull();
    expect(e.goldDrop).toBe(0);
    expect(e.debuffs).toEqual([]);
  });

  it('applyDebuff adds a new debuff', () => {
    const e = new Entity('imp', 0, 0);
    e.applyDebuff('slow', 3.0, 0.5);
    expect(e.debuffs.length).toBe(1);
    expect(e.debuffs[0]).toEqual({ type: 'slow', remaining: 3.0, factor: 0.5 });
  });

  it('applyDebuff refreshes duration of existing debuff', () => {
    const e = new Entity('imp', 0, 0);
    e.applyDebuff('slow', 2.0, 0.5);
    e.applyDebuff('slow', 5.0, 0.5);
    expect(e.debuffs.length).toBe(1);
    expect(e.debuffs[0].remaining).toBe(5.0);
  });

  it('getDebuffFactor returns factor for active debuff', () => {
    const e = new Entity('imp', 0, 0);
    expect(e.getDebuffFactor('slow')).toBe(1.0);
    e.applyDebuff('slow', 3.0, 0.5);
    expect(e.getDebuffFactor('slow')).toBe(0.5);
  });

  it('updateDebuffs removes expired debuffs', () => {
    const e = new Entity('imp', 0, 0);
    e.applyDebuff('slow', 1.0, 0.5);
    e.updateDebuffs(0.5);
    expect(e.debuffs.length).toBe(1);
    e.updateDebuffs(0.6);
    expect(e.debuffs.length).toBe(0);
  });

  it('getEffectiveSpeed applies slow debuff', () => {
    const e = new Entity('imp', 0, 0);
    e.speed = 100;
    expect(e.getEffectiveSpeed()).toBe(100);
    e.applyDebuff('slow', 3.0, 0.5);
    expect(e.getEffectiveSpeed()).toBe(50);
  });
});
