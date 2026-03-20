/**
 * Generic pre-allocated object pool.
 * Avoids per-frame heap allocations for frequently spawned objects
 * like particles, floating text, etc.
 */
export class ObjectPool {
  /**
   * @param {Function} factory - Creates a new pool object.
   * @param {number} size - Number of objects to pre-allocate.
   * @param {Function} [resetFn] - Optional reset called on release.
   */
  constructor(factory, size, resetFn) {
    this._resetFn = resetFn || null;
    this._pool = [];
    this._active = [];
    for (let i = 0; i < size; i++) {
      this._pool.push(factory());
    }
  }

  /** @returns {number} Total pool capacity. */
  get size() { return this._pool.length + this._active.length; }

  /** @returns {number} Currently active (acquired) objects. */
  get activeCount() { return this._active.length; }

  /**
   * Acquire an object from the pool.
   * @returns {Object|null} Pool object, or null if exhausted.
   */
  acquire() {
    if (this._pool.length === 0) return null;
    const obj = this._pool.pop();
    this._active.push(obj);
    return obj;
  }

  /**
   * Release an object back to the pool.
   * @param {Object} obj
   */
  release(obj) {
    const idx = this._active.indexOf(obj);
    if (idx === -1) return;
    this._active.splice(idx, 1);
    if (this._resetFn) this._resetFn(obj);
    this._pool.push(obj);
  }

  /**
   * Iterate over all active objects.
   * Safe to call release() on items during iteration.
   * @param {Function} fn - Called with each active object.
   */
  forEach(fn) {
    for (let i = this._active.length - 1; i >= 0; i--) {
      if (i < this._active.length) {
        fn(this._active[i]);
      }
    }
  }
}
