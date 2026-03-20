import { TIMESTEP_MS, TIMESTEP_SEC, MAX_FRAME_SKIP } from '../constants.js';

/**
 * Fixed-timestep game loop with interpolated rendering.
 * Runs update at 60 UPS regardless of display refresh rate.
 * Render receives interpolation alpha for smooth visuals.
 */
export class GameLoop {
  /**
   * @param {Function} updateFn - Called with (dt) in seconds at fixed timestep.
   * @param {Function} renderFn - Called with (interpolationAlpha) each frame.
   */
  constructor(updateFn, renderFn) {
    this._update = updateFn;
    this._render = renderFn;
    this._rafId = null;
    this._running = false;
    this._accumulator = 0;
    this._lastTime = 0;
    this.speedMultiplier = 1;
    this.fps = 0;
    this._frameCount = 0;
    this._fpsTimer = 0;
    this._tick = this._tick.bind(this);
  }

  /** Start the game loop. */
  start() {
    if (this._running) return;
    this._running = true;
    this._lastTime = performance.now();
    this._accumulator = 0;
    this._frameCount = 0;
    this._fpsTimer = 0;
    this._rafId = requestAnimationFrame(this._tick);
  }

  /** Stop the game loop. */
  stop() {
    this._running = false;
    if (this._rafId !== null) {
      cancelAnimationFrame(this._rafId);
      this._rafId = null;
    }
  }

  /**
   * Set game speed multiplier.
   * @param {number} multiplier - 1 for normal, 2 for double speed.
   */
  setSpeed(multiplier) {
    this.speedMultiplier = multiplier;
  }

  /** @private */
  _tick(now) {
    if (!this._running) return;

    const deltaMs = now - this._lastTime;
    this._lastTime = now;

    // FPS tracking
    this._frameCount++;
    this._fpsTimer += deltaMs;
    if (this._fpsTimer >= 1000) {
      this.fps = this._frameCount;
      this._frameCount = 0;
      this._fpsTimer -= 1000;
    }

    // Accumulate time, scaled by speed multiplier
    this._accumulator += deltaMs * this.speedMultiplier;

    // Fixed-timestep updates with frame skip cap
    let steps = 0;
    while (this._accumulator >= TIMESTEP_MS && steps < MAX_FRAME_SKIP) {
      this._update(TIMESTEP_SEC);
      this._accumulator -= TIMESTEP_MS;
      steps++;
    }

    // If we hit the cap, discard remaining accumulated time
    if (steps >= MAX_FRAME_SKIP) {
      this._accumulator = 0;
    }

    // Interpolated render
    const alpha = this._accumulator / TIMESTEP_MS;
    this._render(alpha);

    this._rafId = requestAnimationFrame(this._tick);
  }
}
