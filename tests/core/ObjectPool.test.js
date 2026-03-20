import { describe, it, expect } from 'vitest';
import { ObjectPool } from '../../src/core/ObjectPool.js';

describe('ObjectPool', () => {
  it('creates pool with specified size', () => {
    const pool = new ObjectPool(() => ({ x: 0, y: 0 }), 10);
    expect(pool.size).toBe(10);
    expect(pool.activeCount).toBe(0);
  });

  it('acquire returns an object from the pool', () => {
    const pool = new ObjectPool(() => ({ x: 0, y: 0 }), 5);
    const obj = pool.acquire();
    expect(obj).toBeDefined();
    expect(pool.activeCount).toBe(1);
  });

  it('release returns object to pool', () => {
    const pool = new ObjectPool(() => ({ x: 0, y: 0 }), 5);
    const obj = pool.acquire();
    pool.release(obj);
    expect(pool.activeCount).toBe(0);
  });

  it('acquire reuses released objects', () => {
    const pool = new ObjectPool(() => ({ x: 0, y: 0 }), 2);
    const obj1 = pool.acquire();
    obj1.x = 99;
    pool.release(obj1);
    const obj2 = pool.acquire();
    expect(obj2).toBe(obj1);
  });

  it('acquire returns null when pool exhausted', () => {
    const pool = new ObjectPool(() => ({ x: 0, y: 0 }), 2);
    pool.acquire();
    pool.acquire();
    const obj = pool.acquire();
    expect(obj).toBeNull();
  });

  it('calls reset function on release if provided', () => {
    const reset = (obj) => { obj.x = 0; obj.y = 0; };
    const pool = new ObjectPool(() => ({ x: 0, y: 0 }), 3, reset);
    const obj = pool.acquire();
    obj.x = 50;
    obj.y = 75;
    pool.release(obj);
    const reused = pool.acquire();
    expect(reused.x).toBe(0);
    expect(reused.y).toBe(0);
  });

  it('forEach iterates only active objects', () => {
    const pool = new ObjectPool(() => ({ x: 0 }), 5);
    pool.acquire().x = 1;
    pool.acquire().x = 2;
    pool.acquire().x = 3;
    const values = [];
    pool.forEach(obj => values.push(obj.x));
    expect(values).toEqual([3, 2, 1]);
  });
});
