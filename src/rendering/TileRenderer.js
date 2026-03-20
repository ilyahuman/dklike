import { TILE_TYPES, TILE_SIZE, COLORS } from '../constants.js';

/**
 * Draws only the tiles visible in the camera viewport.
 * Each tile type has a distinct procedural appearance.
 * Reads World state — never mutates it.
 */
export class TileRenderer {
  /**
   * @param {CanvasRenderingContext2D} ctx
   * @param {import('../world/World.js').World} world
   * @param {import('./Camera.js').Camera} camera
   */
  constructor(ctx, world, camera) {
    this._ctx = ctx;
    this._world = world;
    this._camera = camera;
    // Pre-generate noise seeds for tile variation
    this._noiseSeed = new Uint8Array(world.width * world.height);
    for (let i = 0; i < this._noiseSeed.length; i++) {
      this._noiseSeed[i] = (i * 7919 + 104729) % 256;
    }
  }

  /**
   * Render all visible tiles.
   * @param {number} _alpha - Interpolation alpha (unused for tiles, they don't move).
   */
  render(_alpha) {
    const ctx = this._ctx;
    const bounds = this._camera.getViewportTileBounds();

    for (let y = bounds.startY; y < bounds.endY; y++) {
      for (let x = bounds.startX; x < bounds.endX; x++) {
        const type = this._world.getTile(x, y);
        if (type === null) continue;

        const [sx, sy] = this._camera.worldToScreen(x * TILE_SIZE, y * TILE_SIZE);
        const size = TILE_SIZE * this._camera.zoom;
        const noise = this._noiseSeed[y * this._world.width + x];

        this._drawTile(ctx, type, sx, sy, size, noise, x, y);
      }
    }
  }

  /**
   * Draw a single tile procedurally.
   * @private
   */
  _drawTile(ctx, type, sx, sy, size, noise, tx, ty) {
    switch (type) {
      case TILE_TYPES.ROCK:
        this._drawRock(ctx, sx, sy, size, noise);
        break;
      case TILE_TYPES.DIRT:
        this._drawDirt(ctx, sx, sy, size, noise);
        break;
      case TILE_TYPES.UNCLAIMED_FLOOR:
        this._drawFloor(ctx, sx, sy, size, noise, '#4a4a4e');
        break;
      case TILE_TYPES.CLAIMED_FLOOR:
        this._drawFloor(ctx, sx, sy, size, noise, '#5a5a60');
        break;
      case TILE_TYPES.GOLD_VEIN:
        this._drawGoldVein(ctx, sx, sy, size, noise);
        break;
      case TILE_TYPES.GEM_SEAM:
        this._drawGemSeam(ctx, sx, sy, size, noise);
        break;
      case TILE_TYPES.LAVA:
        this._drawLava(ctx, sx, sy, size, noise);
        break;
      case TILE_TYPES.WATER:
        this._drawWater(ctx, sx, sy, size, noise);
        break;
    }
  }

  /** @private */
  _drawRock(ctx, x, y, size, noise) {
    // Dark stone base
    const shade = 30 + (noise % 15);
    ctx.fillStyle = `rgb(${shade}, ${shade}, ${shade + 4})`;
    ctx.fillRect(x, y, size, size);
    // Subtle cracks
    ctx.strokeStyle = `rgba(0, 0, 0, 0.3)`;
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(x + (noise % 10) * size / 32, y + size * 0.3);
    ctx.lineTo(x + size * 0.6, y + size * 0.7 + (noise % 5));
    ctx.stroke();
  }

  /** @private */
  _drawDirt(ctx, x, y, size, noise) {
    // Brown base
    const r = 80 + (noise % 20);
    const g = 60 + (noise % 15);
    const b = 40 + (noise % 10);
    ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
    ctx.fillRect(x, y, size, size);
    // Speckled texture
    ctx.fillStyle = `rgba(100, 80, 50, 0.4)`;
    for (let i = 0; i < 3; i++) {
      const px = x + ((noise * (i + 1) * 13) % 28) * size / 32;
      const py = y + ((noise * (i + 1) * 7) % 28) * size / 32;
      ctx.fillRect(px, py, size / 16, size / 16);
    }
    // Lighter edge on top-left
    ctx.fillStyle = `rgba(140, 110, 70, 0.15)`;
    ctx.fillRect(x, y, size, size / 8);
  }

  /** @private */
  _drawFloor(ctx, x, y, size, noise, baseColor) {
    ctx.fillStyle = baseColor;
    ctx.fillRect(x, y, size, size);
    // Subtle grid lines
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.15)';
    ctx.lineWidth = 0.5;
    ctx.strokeRect(x + 0.5, y + 0.5, size - 1, size - 1);
    // Slight variation
    if (noise % 4 === 0) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.03)';
      ctx.fillRect(x + 2, y + 2, size - 4, size - 4);
    }
  }

  /** @private */
  _drawGoldVein(ctx, x, y, size, noise) {
    // Rock base
    this._drawRock(ctx, x, y, size, noise);
    // Gold flecks
    ctx.fillStyle = COLORS.GOLD_VEIN;
    for (let i = 0; i < 5; i++) {
      const fx = x + ((noise * (i + 3) * 11) % 26) * size / 32;
      const fy = y + ((noise * (i + 2) * 17) % 26) * size / 32;
      const fs = size / 10 + (i % 2) * size / 16;
      ctx.fillRect(fx, fy, fs, fs);
    }
    // Glitter highlight
    ctx.fillStyle = 'rgba(255, 220, 80, 0.5)';
    ctx.beginPath();
    ctx.arc(x + size * 0.5, y + size * 0.4, size / 8, 0, Math.PI * 2);
    ctx.fill();
  }

  /** @private */
  _drawGemSeam(ctx, x, y, size, noise) {
    // Rock base
    this._drawRock(ctx, x, y, size, noise);
    // Crystal facets
    const colors = ['#8a4ec0', '#6a3ea0', '#aa60e0', '#5040b0'];
    for (let i = 0; i < 4; i++) {
      ctx.fillStyle = colors[i % colors.length];
      const cx = x + ((noise * (i + 1) * 7) % 22 + 5) * size / 32;
      const cy = y + ((noise * (i + 2) * 11) % 22 + 5) * size / 32;
      // Diamond shape
      ctx.beginPath();
      const s = size / 12 + (i % 2) * 2;
      ctx.moveTo(cx, cy - s);
      ctx.lineTo(cx + s, cy);
      ctx.lineTo(cx, cy + s);
      ctx.lineTo(cx - s, cy);
      ctx.closePath();
      ctx.fill();
    }
  }

  /** @private */
  _drawLava(ctx, x, y, size, noise) {
    const t = performance.now() / 1000;
    const pulse = Math.sin(t * 2 + noise * 0.1) * 0.15 + 0.85;
    const r = Math.floor(180 * pulse + (noise % 20));
    const g = Math.floor(60 * pulse + (noise % 15));
    ctx.fillStyle = `rgb(${r}, ${g}, 20)`;
    ctx.fillRect(x, y, size, size);
    // Shimmer
    ctx.fillStyle = `rgba(255, 150, 0, ${0.2 + Math.sin(t * 3 + noise) * 0.1})`;
    ctx.fillRect(x + size * 0.2, y + size * 0.2, size * 0.6, size * 0.3);
  }

  /** @private */
  _drawWater(ctx, x, y, size, noise) {
    const t = performance.now() / 1000;
    const wave = Math.sin(t * 1.5 + noise * 0.15) * 0.1 + 0.9;
    ctx.fillStyle = `rgb(30, ${Math.floor(60 * wave)}, ${Math.floor(150 * wave)})`;
    ctx.fillRect(x, y, size, size);
    // Ripple highlights
    ctx.strokeStyle = `rgba(100, 160, 255, ${0.15 + Math.sin(t * 2 + noise * 0.2) * 0.1})`;
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(x + size * 0.1, y + size * (0.4 + Math.sin(t + noise) * 0.05));
    ctx.lineTo(x + size * 0.9, y + size * (0.4 + Math.sin(t + noise + 1) * 0.05));
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x + size * 0.2, y + size * (0.7 + Math.sin(t * 0.8 + noise) * 0.05));
    ctx.lineTo(x + size * 0.8, y + size * (0.7 + Math.sin(t * 0.8 + noise + 1) * 0.05));
    ctx.stroke();
  }
}
