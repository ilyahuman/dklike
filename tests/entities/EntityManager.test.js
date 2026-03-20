import { describe, it, expect, vi } from 'vitest';
import { EntityManager } from '../../src/entities/EntityManager.js';
import { Entity } from '../../src/entities/Entity.js';

describe('EntityManager', () => {
  it('adds and retrieves entities', () => {
    const em = new EntityManager();
    const e = new Entity('imp', 100, 200);
    em.add(e);
    expect(em.getById(e.id)).toBe(e);
  });

  it('removes entities', () => {
    const em = new EntityManager();
    const e = new Entity('imp', 100, 200);
    em.add(e);
    em.remove(e.id);
    expect(em.getById(e.id)).toBeUndefined();
  });

  it('getAll returns all entities', () => {
    const em = new EntityManager();
    em.add(new Entity('imp', 0, 0));
    em.add(new Entity('imp', 100, 100));
    expect(em.getAll().length).toBe(2);
  });

  it('getByType filters by entity type', () => {
    const em = new EntityManager();
    em.add(new Entity('imp', 0, 0));
    em.add(new Entity('knight', 100, 100));
    em.add(new Entity('imp', 200, 200));
    expect(em.getByType('imp').length).toBe(2);
    expect(em.getByType('knight').length).toBe(1);
  });

  it('update calls update on all entities', () => {
    const em = new EntityManager();
    const e = new Entity('imp', 0, 0);
    e.update = vi.fn();
    em.add(e);
    em.update(0.016);
    expect(e.update).toHaveBeenCalledWith(0.016);
  });

  it('update removes dead entities', () => {
    const em = new EntityManager();
    const e = new Entity('imp', 0, 0);
    e.health = 100;
    e.maxHealth = 100;
    em.add(e);
    e.alive = false;
    em.update(0.016);
    expect(em.getAll().length).toBe(0);
  });

  it('getEntitiesInRadius returns nearby entities', () => {
    const em = new EntityManager();
    const e1 = new Entity('imp', 100, 100);
    const e2 = new Entity('imp', 110, 110);
    const e3 = new Entity('imp', 500, 500);
    em.add(e1);
    em.add(e2);
    em.add(e3);
    em.rebuildSpatialHash();
    const nearby = em.getEntitiesInRadius(100, 100, 50);
    expect(nearby.length).toBe(2);
    expect(nearby).toContain(e1);
    expect(nearby).toContain(e2);
  });

  it('stores previous positions before update', () => {
    const em = new EntityManager();
    const e = new Entity('imp', 100, 200);
    e.update = (dt) => { e.x += 10; e.y += 5; };
    em.add(e);
    em.update(0.016);
    expect(e.prevX).toBe(100);
    expect(e.prevY).toBe(200);
  });
});

describe('spatial hash - getEntitiesInRadius', () => {
  it('should find entities within radius', () => {
    const em = new EntityManager();
    const e1 = { id: 1, x: 100, y: 100, prevX: 100, prevY: 100, alive: true, update: vi.fn() };
    const e2 = { id: 2, x: 500, y: 500, prevX: 500, prevY: 500, alive: true, update: vi.fn() };
    em.add(e1);
    em.add(e2);
    em.rebuildSpatialHash();
    const nearby = em.getEntitiesInRadius(100, 100, 50);
    expect(nearby).toContain(e1);
    expect(nearby).not.toContain(e2);
  });

  it('should return empty array when no entities nearby', () => {
    const em = new EntityManager();
    em.rebuildSpatialHash();
    expect(em.getEntitiesInRadius(100, 100, 50)).toEqual([]);
  });

  it('should handle entities at cell boundaries', () => {
    const em = new EntityManager();
    const e1 = { id: 1, x: 128, y: 128, prevX: 128, prevY: 128, alive: true, update: vi.fn() };
    em.add(e1);
    em.rebuildSpatialHash();
    const nearby = em.getEntitiesInRadius(130, 130, 50);
    expect(nearby).toContain(e1);
  });
});
