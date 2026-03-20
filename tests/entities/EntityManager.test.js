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
