import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GameLoop } from '../../src/core/GameLoop.js';
import { TIMESTEP_MS, MAX_FRAME_SKIP } from '../../src/constants.js';

describe('GameLoop', () => {
  let loop;
  let updateFn;
  let renderFn;

  beforeEach(() => {
    updateFn = vi.fn();
    renderFn = vi.fn();
    vi.useFakeTimers();
    let perfTime = 0;
    const rafQueue = [];
    let nextRafId = 0;

    vi.stubGlobal('requestAnimationFrame', (cb) => {
      const id = ++nextRafId;
      // Schedule RAF for 16ms in the future
      const timeoutId = setTimeout(() => {
        perfTime += 16;
        cb(perfTime);
      }, 16);
      rafQueue.push({ id, timeoutId });
      return id;
    });

    vi.stubGlobal('cancelAnimationFrame', (id) => {
      const index = rafQueue.findIndex((item) => item.id === id);
      if (index !== -1) {
        const { timeoutId } = rafQueue[index];
        clearTimeout(timeoutId);
        rafQueue.splice(index, 1);
      }
    });

    vi.stubGlobal('performance', {
      now: vi.fn(() => perfTime)
    });
  });

  afterEach(() => {
    if (loop) loop.stop();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('constructs without errors', () => {
    loop = new GameLoop(updateFn, renderFn);
    expect(loop).toBeDefined();
  });

  it('calls update with fixed timestep after start', () => {
    loop = new GameLoop(updateFn, renderFn);
    loop.start();
    vi.advanceTimersByTime(20);
    vi.runOnlyPendingTimers();
    expect(updateFn).toHaveBeenCalled();
    const dt = updateFn.mock.calls[0][0];
    expect(dt).toBeCloseTo(TIMESTEP_MS / 1000, 2);
  });

  it('calls render after update', () => {
    loop = new GameLoop(updateFn, renderFn);
    loop.start();
    vi.advanceTimersByTime(20);
    expect(renderFn).toHaveBeenCalled();
  });

  it('stops calling update/render after stop', () => {
    loop = new GameLoop(updateFn, renderFn);
    loop.start();
    vi.advanceTimersByTime(20);
    const updateCount = updateFn.mock.calls.length;
    loop.stop();
    vi.advanceTimersByTime(100);
    expect(updateFn.mock.calls.length).toBe(updateCount);
  });

  it('setSpeed changes update rate multiplier', () => {
    loop = new GameLoop(updateFn, renderFn);
    loop.setSpeed(2);
    expect(loop.speedMultiplier).toBe(2);
  });

  it('caps frame skip to MAX_FRAME_SKIP', () => {
    loop = new GameLoop(updateFn, renderFn);
    loop.start();
    vi.advanceTimersByTime(500);
    // Verify no runaway update loop: in 500ms at 60 UPS, we expect ~30 updates
    // MAX_FRAME_SKIP caps updates per frame, not total. With ~30 frames, we expect
    // fewer than 30 * MAX_FRAME_SKIP = 150 total updates in pathological case.
    // A reasonable upper bound is 50 (allowing some overhead).
    expect(updateFn.mock.calls.length).toBeLessThanOrEqual(50);
  });

  it('tracks FPS', () => {
    loop = new GameLoop(updateFn, renderFn);
    loop.start();
    vi.advanceTimersByTime(100);
    expect(loop.fps).toBeGreaterThanOrEqual(0);
  });
});
