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
});
