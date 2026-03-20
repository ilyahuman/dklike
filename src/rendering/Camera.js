import { MAP_WIDTH, MAP_HEIGHT, TILE_SIZE, CAMERA } from '../constants.js';

/**
 * Camera for panning and zooming the game view.
 * Position is in world-space pixels. Provides world<->screen conversion.
 */
export class Camera {
  /**
   * @param {number} viewportWidth - Screen width in CSS pixels.
   * @param {number} viewportHeight - Screen height in CSS pixels.
   */
  constructor(viewportWidth, viewportHeight) {
    this.viewportWidth = viewportWidth;
    this.viewportHeight = viewportHeight;
    this.zoom = 1.0;
    // Start centered on the map
    this.x = (MAP_WIDTH * TILE_SIZE) / 2;
    this.y = (MAP_HEIGHT * TILE_SIZE) / 2;
  }

  /**
   * Convert world coordinates to screen coordinates.
   * @param {number} wx - World X in pixels.
   * @param {number} wy - World Y in pixels.
   * @returns {[number, number]} Screen [x, y].
   */
  worldToScreen(wx, wy) {
    const sx = (wx - this.x) * this.zoom + this.viewportWidth / 2;
    const sy = (wy - this.y) * this.zoom + this.viewportHeight / 2;
    return [sx, sy];
  }

  /**
   * Convert screen coordinates to world coordinates.
   * @param {number} sx - Screen X.
   * @param {number} sy - Screen Y.
   * @returns {[number, number]} World [x, y] in pixels.
   */
  screenToWorld(sx, sy) {
    const wx = (sx - this.viewportWidth / 2) / this.zoom + this.x;
    const wy = (sy - this.viewportHeight / 2) / this.zoom + this.y;
    return [wx, wy];
  }

  /**
   * Pan the camera by delta in world pixels.
   * @param {number} dx
   * @param {number} dy
   */
  pan(dx, dy) {
    this.x += dx;
    this.y += dy;
  }

  /**
   * Zoom by delta, clamped to min/max.
   * @param {number} delta - Positive to zoom in, negative to zoom out.
   */
  zoomBy(delta) {
    this.zoom = Math.max(CAMERA.ZOOM_MIN, Math.min(CAMERA.ZOOM_MAX, this.zoom + delta));
  }

  /** Clamp camera position so viewport stays within world bounds. */
  clampToWorld() {
    const worldW = MAP_WIDTH * TILE_SIZE;
    const worldH = MAP_HEIGHT * TILE_SIZE;
    const halfVW = this.viewportWidth / (2 * this.zoom);
    const halfVH = this.viewportHeight / (2 * this.zoom);

    this.x = Math.max(halfVW, Math.min(worldW - halfVW, this.x));
    this.y = Math.max(halfVH, Math.min(worldH - halfVH, this.y));
  }

  /**
   * Get the tile coordinate range visible in the viewport.
   * @returns {{startX: number, startY: number, endX: number, endY: number}}
   */
  getViewportTileBounds() {
    const [topLeftWx, topLeftWy] = this.screenToWorld(0, 0);
    const [botRightWx, botRightWy] = this.screenToWorld(this.viewportWidth, this.viewportHeight);

    return {
      startX: Math.max(0, Math.floor(topLeftWx / TILE_SIZE) - 1),
      startY: Math.max(0, Math.floor(topLeftWy / TILE_SIZE) - 1),
      endX: Math.min(MAP_WIDTH, Math.ceil(botRightWx / TILE_SIZE) + 1),
      endY: Math.min(MAP_HEIGHT, Math.ceil(botRightWy / TILE_SIZE) + 1),
    };
  }

  /**
   * Update viewport dimensions (call on window resize).
   * @param {number} w
   * @param {number} h
   */
  resize(w, h) {
    this.viewportWidth = w;
    this.viewportHeight = h;
  }
}
