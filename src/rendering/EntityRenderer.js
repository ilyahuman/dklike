import { ENTITY_TYPES, CREATURE_STATES, TILE_SIZE, COLORS } from '../constants.js';

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
        case ENTITY_TYPES.TROLL:
          this._drawTroll(ctx, sx, sy, zoom, entity);
          break;
        case ENTITY_TYPES.DARK_MISTRESS:
          this._drawDarkMistress(ctx, sx, sy, zoom, entity);
          break;
        case ENTITY_TYPES.KNIGHT:
          this._drawKnight(ctx, sx, sy, zoom, entity);
          break;
        case ENTITY_TYPES.THIEF:
          this._drawThief(ctx, sx, sy, zoom, entity);
          break;
        case ENTITY_TYPES.WIZARD:
          this._drawWizard(ctx, sx, sy, zoom, entity);
          break;
        case ENTITY_TYPES.DOOR:
          this._drawDoor(ctx, sx, sy, zoom, entity);
          break;
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

  /** @private */
  _drawHealthBar(ctx, x, y, size, entity) {
    if (entity.health >= entity.maxHealth) return;
    const barW = size * 0.8;
    const barH = 3 * (size / (TILE_SIZE * 0.6));
    const barX = x - barW / 2;
    const barY = y - size * 0.9;
    ctx.fillStyle = COLORS.UI_HEALTH_BG;
    ctx.fillRect(barX, barY, barW, barH);
    const ratio = entity.health / entity.maxHealth;
    ctx.fillStyle = entity.team === 'enemy' ? '#c06040' : COLORS.UI_HEALTH_BAR;
    ctx.fillRect(barX, barY, barW * ratio, barH);
  }

  /** @private */
  _drawLevelBadge(ctx, x, y, size, entity) {
    if (!entity.level || entity.level <= 1) return;
    const r = 5 * (size / (TILE_SIZE * 0.6));
    ctx.fillStyle = entity.team === 'enemy' ? '#c06040' : '#40a0c0';
    ctx.beginPath();
    ctx.arc(x + size * 0.4, y - size * 0.7, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = `bold ${r * 1.4}px Inter, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(entity.level), x + size * 0.4, y - size * 0.7);
    ctx.textBaseline = 'alphabetic';
  }

  /** @private Troll: large hulking green figure */
  _drawTroll(ctx, sx, sy, zoom, entity) {
    const size = TILE_SIZE * zoom * 0.8;
    const halfSize = size / 2;
    const bobY = entity.state === CREATURE_STATES.MOVING
      ? Math.sin(this._animTime * 6) * 3 * zoom : 0;

    ctx.save();
    ctx.translate(sx, sy + bobY);
    if (!entity.facingRight) ctx.scale(-1, 1);

    // Body
    ctx.fillStyle = '#4a7a40';
    ctx.beginPath();
    ctx.ellipse(0, -halfSize * 0.2, halfSize * 0.55, halfSize * 0.8, 0, 0, Math.PI * 2);
    ctx.fill();

    // Head
    ctx.fillStyle = '#5a8a50';
    ctx.beginPath();
    ctx.arc(0, -halfSize * 0.9, halfSize * 0.35, 0, Math.PI * 2);
    ctx.fill();

    // Eyes
    ctx.fillStyle = '#ff4040';
    ctx.fillRect(halfSize * 0.05, -halfSize * 1.0, 3 * zoom, 2 * zoom);
    ctx.fillRect(-halfSize * 0.2, -halfSize * 1.0, 3 * zoom, 2 * zoom);

    // Arms
    ctx.strokeStyle = '#3a6a30';
    ctx.lineWidth = 2.5 * zoom;
    ctx.beginPath();
    ctx.moveTo(-halfSize * 0.4, -halfSize * 0.2);
    ctx.lineTo(-halfSize * 0.7, halfSize * 0.3);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(halfSize * 0.4, -halfSize * 0.2);
    ctx.lineTo(halfSize * 0.7, halfSize * 0.3);
    ctx.stroke();

    ctx.restore();
    this._drawHealthBar(ctx, sx, sy, size, entity);
    this._drawLevelBadge(ctx, sx, sy, size, entity);
  }

  /** @private DarkMistress: tall lithe purple figure with whip */
  _drawDarkMistress(ctx, sx, sy, zoom, entity) {
    const size = TILE_SIZE * zoom * 0.75;
    const halfSize = size / 2;
    const bobY = entity.state === CREATURE_STATES.MOVING
      ? Math.sin(this._animTime * 12) * 2 * zoom : 0;

    ctx.save();
    ctx.translate(sx, sy + bobY);
    if (!entity.facingRight) ctx.scale(-1, 1);

    // Body (slender)
    ctx.fillStyle = '#8040a0';
    ctx.beginPath();
    ctx.ellipse(0, -halfSize * 0.3, halfSize * 0.35, halfSize * 0.85, 0, 0, Math.PI * 2);
    ctx.fill();

    // Head
    ctx.fillStyle = '#9050b0';
    ctx.beginPath();
    ctx.arc(0, -halfSize * 1.0, halfSize * 0.28, 0, Math.PI * 2);
    ctx.fill();

    // Eyes
    ctx.fillStyle = '#ff80ff';
    ctx.fillRect(halfSize * 0.05, -halfSize * 1.1, 2 * zoom, 2 * zoom);

    // Whip line
    ctx.strokeStyle = '#c060e0';
    ctx.lineWidth = 1.5 * zoom;
    ctx.beginPath();
    ctx.moveTo(halfSize * 0.3, -halfSize * 0.2);
    const whipPhase = Math.sin(this._animTime * 8) * halfSize * 0.4;
    ctx.quadraticCurveTo(halfSize * 0.8, -halfSize * 0.1 + whipPhase, halfSize, halfSize * 0.4);
    ctx.stroke();

    ctx.restore();
    this._drawHealthBar(ctx, sx, sy, size, entity);
    this._drawLevelBadge(ctx, sx, sy, size, entity);
  }

  /** @private Knight: armored figure with shield */
  _drawKnight(ctx, sx, sy, zoom, entity) {
    const size = TILE_SIZE * zoom * 0.75;
    const halfSize = size / 2;
    const bobY = entity.state === CREATURE_STATES.MOVING
      ? Math.sin(this._animTime * 8) * 2 * zoom : 0;

    ctx.save();
    ctx.translate(sx, sy + bobY);
    if (!entity.facingRight) ctx.scale(-1, 1);

    // Body (armored)
    ctx.fillStyle = '#a0a0b0';
    ctx.beginPath();
    ctx.ellipse(0, -halfSize * 0.3, halfSize * 0.45, halfSize * 0.75, 0, 0, Math.PI * 2);
    ctx.fill();

    // Helmet
    ctx.fillStyle = '#b0b0c0';
    ctx.beginPath();
    ctx.arc(0, -halfSize * 0.9, halfSize * 0.32, 0, Math.PI * 2);
    ctx.fill();

    // Visor slit
    ctx.fillStyle = '#202030';
    ctx.fillRect(-halfSize * 0.15, -halfSize * 0.95, halfSize * 0.3, 2 * zoom);

    // Shield
    ctx.fillStyle = '#6080c0';
    ctx.fillRect(-halfSize * 0.6, -halfSize * 0.5, halfSize * 0.25, halfSize * 0.5);

    // Sword
    ctx.strokeStyle = '#d0d0e0';
    ctx.lineWidth = 2 * zoom;
    ctx.beginPath();
    ctx.moveTo(halfSize * 0.4, -halfSize * 0.4);
    ctx.lineTo(halfSize * 0.7, -halfSize * 0.8);
    ctx.stroke();

    ctx.restore();
    this._drawHealthBar(ctx, sx, sy, size, entity);
  }

  /** @private Thief: small hooded dark figure */
  _drawThief(ctx, sx, sy, zoom, entity) {
    const size = TILE_SIZE * zoom * 0.6;
    const halfSize = size / 2;
    const bobY = entity.state === CREATURE_STATES.MOVING
      ? Math.sin(this._animTime * 14) * 1.5 * zoom : 0;

    ctx.save();
    ctx.translate(sx, sy + bobY);
    if (!entity.facingRight) ctx.scale(-1, 1);

    // Body (cloaked)
    ctx.fillStyle = '#404050';
    ctx.beginPath();
    ctx.ellipse(0, -halfSize * 0.3, halfSize * 0.4, halfSize * 0.7, 0, 0, Math.PI * 2);
    ctx.fill();

    // Hood
    ctx.fillStyle = '#353545';
    ctx.beginPath();
    ctx.arc(0, -halfSize * 0.9, halfSize * 0.35, 0, Math.PI * 2);
    ctx.fill();

    // Eyes (gleaming)
    ctx.fillStyle = '#ffff80';
    ctx.fillRect(halfSize * 0.05, -halfSize * 1.0, 2 * zoom, 1.5 * zoom);
    ctx.fillRect(-halfSize * 0.15, -halfSize * 1.0, 2 * zoom, 1.5 * zoom);

    // Dagger
    ctx.strokeStyle = '#c0c0d0';
    ctx.lineWidth = 1.5 * zoom;
    ctx.beginPath();
    ctx.moveTo(halfSize * 0.35, -halfSize * 0.1);
    ctx.lineTo(halfSize * 0.5, halfSize * 0.2);
    ctx.stroke();

    ctx.restore();
    this._drawHealthBar(ctx, sx, sy, size, entity);
  }

  /** @private Wizard: robed figure with staff */
  _drawWizard(ctx, sx, sy, zoom, entity) {
    const size = TILE_SIZE * zoom * 0.7;
    const halfSize = size / 2;
    const bobY = entity.state === CREATURE_STATES.MOVING
      ? Math.sin(this._animTime * 7) * 2 * zoom : 0;

    ctx.save();
    ctx.translate(sx, sy + bobY);
    if (!entity.facingRight) ctx.scale(-1, 1);

    // Robe
    ctx.fillStyle = '#4040a0';
    ctx.beginPath();
    ctx.ellipse(0, -halfSize * 0.2, halfSize * 0.4, halfSize * 0.8, 0, 0, Math.PI * 2);
    ctx.fill();

    // Hat (pointed)
    ctx.fillStyle = '#3030a0';
    ctx.beginPath();
    ctx.moveTo(-halfSize * 0.25, -halfSize * 0.8);
    ctx.lineTo(0, -halfSize * 1.6);
    ctx.lineTo(halfSize * 0.25, -halfSize * 0.8);
    ctx.closePath();
    ctx.fill();

    // Face area
    ctx.fillStyle = '#d0c0a0';
    ctx.beginPath();
    ctx.arc(0, -halfSize * 0.85, halfSize * 0.2, 0, Math.PI * 2);
    ctx.fill();

    // Staff
    ctx.strokeStyle = '#8b6914';
    ctx.lineWidth = 2 * zoom;
    ctx.beginPath();
    ctx.moveTo(-halfSize * 0.5, halfSize * 0.5);
    ctx.lineTo(-halfSize * 0.4, -halfSize * 1.2);
    ctx.stroke();
    // Staff orb
    ctx.fillStyle = '#80c0ff';
    ctx.beginPath();
    ctx.arc(-halfSize * 0.4, -halfSize * 1.3, 3 * zoom, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
    this._drawHealthBar(ctx, sx, sy, size, entity);
  }

  /** @private Door: wooden door with planks, animates open for nearby friendlies */
  _drawDoor(ctx, sx, sy, zoom, entity) {
    const size = TILE_SIZE * zoom;
    const halfSize = size / 2;
    const isOpen = entity._isOpen || false;

    ctx.save();
    ctx.translate(sx, sy);

    // Door frame (dark stone)
    ctx.fillStyle = '#4a4040';
    ctx.fillRect(-halfSize * 0.9, -halfSize * 0.9, size * 0.9, size * 0.9);

    if (isOpen) {
      // Open door: thin sliver on side
      ctx.globalAlpha = 0.5;
      ctx.fillStyle = '#6a4a2a';
      ctx.fillRect(-halfSize * 0.8, -halfSize * 0.8, size * 0.15, size * 0.8);
      ctx.globalAlpha = 1;
    } else {
      // Closed door: full planks
      ctx.fillStyle = '#6a4a2a';
      ctx.fillRect(-halfSize * 0.7, -halfSize * 0.8, size * 0.7, size * 0.8);

      // Horizontal bands (iron)
      ctx.fillStyle = '#555';
      const bandH = 2 * zoom;
      ctx.fillRect(-halfSize * 0.7, -halfSize * 0.5, size * 0.7, bandH);
      ctx.fillRect(-halfSize * 0.7, -halfSize * 0.1, size * 0.7, bandH);
      ctx.fillRect(-halfSize * 0.7, halfSize * 0.3, size * 0.7, bandH);

      // Handle
      ctx.fillStyle = '#888';
      ctx.beginPath();
      ctx.arc(halfSize * 0.2, 0, 2 * zoom, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();

    // Health bar when damaged
    if (entity.health < entity.maxHealth) {
      this._drawHealthBar(ctx, sx, sy, size * 0.8, entity);
    }
  }
}
