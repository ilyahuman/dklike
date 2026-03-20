import { ObjectPool } from '../core/ObjectPool.js';
import { PARTICLE_POOL_SIZE } from '../constants.js';

/**
 * Pooled particle system for visual effects.
 * Uses ObjectPool for zero-allocation particle spawning.
 * Effects: gold bursts, debris on dig, sparks.
 */
export class ParticleSystem {
  /**
   * @param {CanvasRenderingContext2D} ctx
   * @param {import('./Camera.js').Camera} camera
   */
  constructor(ctx, camera) {
    this._ctx = ctx;
    this._camera = camera;
    this._pool = new ObjectPool(
      () => ({
        x: 0, y: 0, vx: 0, vy: 0,
        life: 0, maxLife: 0,
        size: 2, color: '#fff',
        gravity: 0,
      }),
      PARTICLE_POOL_SIZE,
      (p) => {
        p.x = 0; p.y = 0; p.vx = 0; p.vy = 0;
        p.life = 0; p.maxLife = 0;
        p.size = 2; p.color = '#fff';
        p.gravity = 0;
      }
    );
  }

  /**
   * Spawn a burst of particles at a world position.
   * @param {number} x - World X.
   * @param {number} y - World Y.
   * @param {string} color - CSS color.
   * @param {number} count - Number of particles.
   * @param {Object} [opts] - Optional overrides.
   */
  burst(x, y, color, count, opts = {}) {
    const speed = opts.speed || 80;
    const life = opts.life || 0.6;
    const size = opts.size || 2;
    const gravity = opts.gravity || 120;

    for (let i = 0; i < count; i++) {
      const p = this._pool.acquire();
      if (!p) break;
      const angle = Math.random() * Math.PI * 2;
      const mag = Math.random() * speed;
      p.x = x;
      p.y = y;
      p.vx = Math.cos(angle) * mag;
      p.vy = Math.sin(angle) * mag;
      p.life = life + Math.random() * 0.3;
      p.maxLife = p.life;
      p.size = size + Math.random() * size;
      p.color = color;
      p.gravity = gravity;
    }
  }

  /**
   * Update all active particles.
   * @param {number} dt
   */
  update(dt) {
    this._pool.forEach(p => {
      p.life -= dt;
      if (p.life <= 0) {
        this._pool.release(p);
        return;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += p.gravity * dt;
    });
  }

  /**
   * Render all active particles.
   */
  render() {
    const ctx = this._ctx;
    this._pool.forEach(p => {
      const [sx, sy] = this._camera.worldToScreen(p.x, p.y);
      const alpha = Math.max(0, p.life / p.maxLife);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      const sz = p.size * this._camera.zoom;
      ctx.fillRect(sx - sz / 2, sy - sz / 2, sz, sz);
    });
    ctx.globalAlpha = 1;
  }
}
