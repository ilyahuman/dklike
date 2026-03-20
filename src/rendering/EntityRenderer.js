import { ENTITY_TYPES, CREATURE_STATES, TILE_SIZE } from '../constants.js';

/**
 * Draws all entities procedurally on the canvas.
 * Reads entity state — never mutates it.
 * Supports interpolation between update ticks for smooth visuals.
 */
export class EntityRenderer {
  /**
   * @param {CanvasRenderingContext2D} ctx
   * @param {import('../entities/EntityManager.js').EntityManager} entityManager
   * @param {import('./Camera.js').Camera} camera
   */
  constructor(ctx, entityManager, camera) {
    this._ctx = ctx;
    this._entityManager = entityManager;
    this._camera = camera;
    this._animTime = 0;
  }

  /**
   * Render all entities with interpolation.
   * @param {number} alpha - Interpolation factor 0-1.
   */
  render(alpha) {
    this._animTime += 0.016; // Approximate frame time for animation
    const ctx = this._ctx;

    for (const entity of this._entityManager.getAll()) {
      // Interpolate position
      const x = entity.prevX + (entity.x - entity.prevX) * alpha;
      const y = entity.prevY + (entity.y - entity.prevY) * alpha;

      const [sx, sy] = this._camera.worldToScreen(x, y);
      const zoom = this._camera.zoom;

      switch (entity.type) {
        case ENTITY_TYPES.IMP:
          this._drawImp(ctx, sx, sy, zoom, entity);
          break;
        // Phase 4+ will add TROLL, DARK_MISTRESS, KNIGHT, etc.
      }
    }
  }

  /**
   * Draw imp: small hunched figure with walk bob and direction awareness.
   * @private
   */
  _drawImp(ctx, sx, sy, zoom, imp) {
    const size = TILE_SIZE * zoom * 0.6;
    const halfSize = size / 2;
    const bobY = imp.state === CREATURE_STATES.MOVING
      ? Math.sin(this._animTime * 10) * 2 * zoom
      : 0;

    ctx.save();
    ctx.translate(sx, sy + bobY);

    // Flip if facing left
    if (!imp.facingRight) {
      ctx.scale(-1, 1);
    }

    // Body (hunched oval)
    ctx.fillStyle = '#c08040';
    ctx.beginPath();
    ctx.ellipse(0, -halfSize * 0.3, halfSize * 0.5, halfSize * 0.7, 0, 0, Math.PI * 2);
    ctx.fill();

    // Head
    ctx.fillStyle = '#d09050';
    ctx.beginPath();
    ctx.arc(halfSize * 0.1, -halfSize * 0.9, halfSize * 0.3, 0, Math.PI * 2);
    ctx.fill();

    // Eyes (tiny white dots)
    ctx.fillStyle = '#fff';
    ctx.fillRect(halfSize * 0.15, -halfSize * 1.0, 2 * zoom, 2 * zoom);

    // Arms (lines)
    ctx.strokeStyle = '#a06830';
    ctx.lineWidth = 1.5 * zoom;
    ctx.beginPath();
    ctx.moveTo(-halfSize * 0.3, -halfSize * 0.3);
    ctx.lineTo(-halfSize * 0.6, halfSize * 0.1);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(halfSize * 0.3, -halfSize * 0.3);
    ctx.lineTo(halfSize * 0.6, halfSize * 0.1);
    ctx.stroke();

    // Dig progress indicator (3-stage crack above imp)
    if (imp.state === CREATURE_STATES.DIGGING) {
      const progress = imp.digProgressRatio;
      ctx.fillStyle = '#ff0';
      const barW = size * 0.8;
      ctx.fillRect(-barW / 2, -halfSize * 1.5, barW * progress, 3 * zoom);
      ctx.strokeStyle = '#880';
      ctx.lineWidth = 0.5;
      ctx.strokeRect(-barW / 2, -halfSize * 1.5, barW, 3 * zoom);
    }

    // State indicator (small colored dot)
    if (imp.state === CREATURE_STATES.FLEEING) {
      ctx.fillStyle = '#f00';
      ctx.beginPath();
      ctx.arc(0, -halfSize * 1.3, 2 * zoom, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }
}
