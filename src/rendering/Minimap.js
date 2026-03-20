import { TILE_TYPES, MAP_WIDTH, MAP_HEIGHT, TILE_SIZE, MINIMAP_WIDTH, MINIMAP_HEIGHT, COLORS } from '../constants.js';

/**
 * 120x90px minimap overlay in the top-right corner.
 * Shows full map with color-coded tiles. Camera viewport rectangle drawn.
 * Clickable to pan camera.
 */
export class Minimap {
  /**
   * @param {CanvasRenderingContext2D} ctx
   * @param {import('../world/World.js').World} world
   * @param {import('./Camera.js').Camera} camera
   * @param {import('../core/EventBus.js').EventBus} eventBus
   */
  constructor(ctx, world, camera, eventBus) {
    this._ctx = ctx;
    this._world = world;
    this._camera = camera;
    this._eventBus = eventBus;
    this._scaleX = MINIMAP_WIDTH / MAP_WIDTH;
    this._scaleY = MINIMAP_HEIGHT / MAP_HEIGHT;

    // Minimap position (top-right with padding)
    this._offsetX = 0; // Set dynamically in render
    this._offsetY = 8;
    this._padding = 8;
  }

  /** @private */
  _getTileColor(type) {
    switch (type) {
      case TILE_TYPES.ROCK: return COLORS.ROCK;
      case TILE_TYPES.DIRT: return COLORS.DIRT;
      case TILE_TYPES.UNCLAIMED_FLOOR: return COLORS.UNCLAIMED_FLOOR;
      case TILE_TYPES.CLAIMED_FLOOR: return COLORS.CLAIMED_FLOOR;
      case TILE_TYPES.GOLD_VEIN: return COLORS.GOLD_VEIN;
      case TILE_TYPES.GEM_SEAM: return COLORS.GEM_SEAM;
      case TILE_TYPES.LAVA: return COLORS.LAVA;
      case TILE_TYPES.WATER: return COLORS.WATER;
      default: return '#000000';
    }
  }

  /**
   * Render the minimap overlay.
   */
  render() {
    const ctx = this._ctx;
    const viewW = this._camera.viewportWidth;
    this._offsetX = viewW - MINIMAP_WIDTH - this._padding;

    // Background
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(this._offsetX - 2, this._offsetY - 2, MINIMAP_WIDTH + 4, MINIMAP_HEIGHT + 4);

    // Draw tiles
    for (let y = 0; y < MAP_HEIGHT; y++) {
      for (let x = 0; x < MAP_WIDTH; x++) {
        const type = this._world.getTile(x, y);
        ctx.fillStyle = this._getTileColor(type);
        ctx.fillRect(
          this._offsetX + x * this._scaleX,
          this._offsetY + y * this._scaleY,
          Math.ceil(this._scaleX),
          Math.ceil(this._scaleY)
        );
      }
    }

    // Draw camera viewport rectangle
    const bounds = this._camera.getViewportTileBounds();
    ctx.strokeStyle = COLORS.MINIMAP_CAMERA;
    ctx.lineWidth = 1;
    ctx.strokeRect(
      this._offsetX + bounds.startX * this._scaleX,
      this._offsetY + bounds.startY * this._scaleY,
      (bounds.endX - bounds.startX) * this._scaleX,
      (bounds.endY - bounds.startY) * this._scaleY
    );

    // Border
    ctx.strokeStyle = 'rgba(150, 130, 100, 0.5)';
    ctx.lineWidth = 1;
    ctx.strokeRect(this._offsetX - 2, this._offsetY - 2, MINIMAP_WIDTH + 4, MINIMAP_HEIGHT + 4);
  }

  /**
   * Handle click on minimap to pan camera.
   * @param {number} screenX
   * @param {number} screenY
   * @returns {boolean} True if click was on minimap.
   */
  handleClick(screenX, screenY) {
    const viewW = this._camera.viewportWidth;
    const ox = viewW - MINIMAP_WIDTH - this._padding;
    const oy = this._offsetY;

    if (screenX >= ox && screenX <= ox + MINIMAP_WIDTH &&
        screenY >= oy && screenY <= oy + MINIMAP_HEIGHT) {
      // Convert minimap click to world position
      const tileX = (screenX - ox) / this._scaleX;
      const tileY = (screenY - oy) / this._scaleY;
      this._camera.x = tileX * TILE_SIZE;
      this._camera.y = tileY * TILE_SIZE;
      this._camera.clampToWorld();
      return true;
    }
    return false;
  }
}
