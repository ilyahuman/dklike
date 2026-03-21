import { EVENTS, CAMERA, TILE_SIZE } from '../constants.js';

/**
 * Captures all mouse and keyboard input, converts to world-space
 * coordinates, and publishes events on the EventBus.
 * Nothing else should read raw DOM events directly.
 */
export class InputManager {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {import('../rendering/Camera.js').Camera} camera
   * @param {import('../core/EventBus.js').EventBus} eventBus
   */
  constructor(canvas, camera, eventBus) {
    this._canvas = canvas;
    this._camera = camera;
    this._eventBus = eventBus;
    this._keysDown = new Set();
    this._middleMouseDown = false;
    this._lastMouseX = 0;
    this._lastMouseY = 0;
    this._leftMouseDown = false;
    this._lastDragTileX = -1;
    this._lastDragTileY = -1;

    this._bindEvents();
  }

  /** @private */
  _bindEvents() {
    this._canvas.addEventListener('click', (e) => {
      const [wx, wy] = this._camera.screenToWorld(e.clientX, e.clientY);
      this._eventBus.publish(EVENTS.INPUT_CLICK, {
        screenX: e.clientX, screenY: e.clientY,
        worldX: wx, worldY: wy,
        tileX: Math.floor(wx / TILE_SIZE), tileY: Math.floor(wy / TILE_SIZE),
      });
    });

    this._canvas.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      const [wx, wy] = this._camera.screenToWorld(e.clientX, e.clientY);
      this._eventBus.publish(EVENTS.INPUT_RIGHT_CLICK, {
        screenX: e.clientX, screenY: e.clientY,
        worldX: wx, worldY: wy,
        tileX: Math.floor(wx / TILE_SIZE), tileY: Math.floor(wy / TILE_SIZE),
      });
    });

    this._canvas.addEventListener('mousemove', (e) => {
      // Middle-mouse drag for camera pan
      if (this._middleMouseDown) {
        const dx = (this._lastMouseX - e.clientX) / this._camera.zoom;
        const dy = (this._lastMouseY - e.clientY) / this._camera.zoom;
        this._camera.pan(dx, dy);
        this._camera.clampToWorld();
      }
      this._lastMouseX = e.clientX;
      this._lastMouseY = e.clientY;

      const [wx, wy] = this._camera.screenToWorld(e.clientX, e.clientY);
      this._eventBus.publish(EVENTS.INPUT_MOUSE_MOVE, {
        screenX: e.clientX, screenY: e.clientY,
        worldX: wx, worldY: wy,
        tileX: Math.floor(wx / TILE_SIZE), tileY: Math.floor(wy / TILE_SIZE),
      });

      // Drag-to-dig: publish INPUT_DRAG when left button held and tile changes
      if (this._leftMouseDown) {
        const dragTileX = Math.floor(wx / TILE_SIZE);
        const dragTileY = Math.floor(wy / TILE_SIZE);
        if (dragTileX !== this._lastDragTileX || dragTileY !== this._lastDragTileY) {
          this._lastDragTileX = dragTileX;
          this._lastDragTileY = dragTileY;
          this._eventBus.publish(EVENTS.INPUT_DRAG, {
            screenX: e.clientX, screenY: e.clientY,
            worldX: wx, worldY: wy,
            tileX: dragTileX, tileY: dragTileY,
          });
        }
      }
    });

    this._canvas.addEventListener('mousedown', (e) => {
      if (e.button === 0) {
        this._leftMouseDown = true;
        this._lastDragTileX = -1;
        this._lastDragTileY = -1;
      }
      if (e.button === 1) {
        this._middleMouseDown = true;
        this._lastMouseX = e.clientX;
        this._lastMouseY = e.clientY;
        e.preventDefault();
      }
    });

    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) {
        this._leftMouseDown = false;
        this._eventBus.publish(EVENTS.INPUT_MOUSE_UP, {});
      }
      if (e.button === 1) {
        this._middleMouseDown = false;
      }
    });

    this._canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      const delta = e.deltaY < 0 ? CAMERA.ZOOM_STEP : -CAMERA.ZOOM_STEP;
      this._camera.zoomBy(delta);
      this._camera.clampToWorld();
      this._eventBus.publish(EVENTS.INPUT_SCROLL, { delta });
    }, { passive: false });

    window.addEventListener('keydown', (e) => {
      if (this._keysDown.has(e.code)) return; // ignore repeat
      this._keysDown.add(e.code);
      this._eventBus.publish(EVENTS.INPUT_KEY_DOWN, { code: e.code, key: e.key });
    });

    window.addEventListener('keyup', (e) => {
      this._keysDown.delete(e.code);
      this._eventBus.publish(EVENTS.INPUT_KEY_UP, { code: e.code, key: e.key });
    });
  }

  /**
   * Check if a key is currently pressed.
   * @param {string} code - Key code (e.g., 'KeyW').
   * @returns {boolean}
   */
  isKeyDown(code) { return this._keysDown.has(code); }

  /**
   * Called each update tick to handle continuous key-based panning.
   * @param {number} dt - Delta time in seconds.
   */
  update(dt) {
    const panSpeed = CAMERA.PAN_SPEED * dt / this._camera.zoom;
    let dx = 0, dy = 0;
    if (this._keysDown.has('KeyW') || this._keysDown.has('ArrowUp')) dy -= panSpeed;
    if (this._keysDown.has('KeyS') || this._keysDown.has('ArrowDown')) dy += panSpeed;
    if (this._keysDown.has('KeyA') || this._keysDown.has('ArrowLeft')) dx -= panSpeed;
    if (this._keysDown.has('KeyD') || this._keysDown.has('ArrowRight')) dx += panSpeed;
    if (dx !== 0 || dy !== 0) {
      this._camera.pan(dx, dy);
      this._camera.clampToWorld();
    }
  }
}
