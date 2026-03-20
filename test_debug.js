import { describe, it, expect, vi } from 'vitest';
import { GameLoop } from './src/core/GameLoop.js';
import { TIMESTEP_MS, MAX_FRAME_SKIP } from './src/constants.js';

describe('GameLoop Debug', () => {
  it('debug timing', () => {
    const updateFn = vi.fn();
    const renderFn = vi.fn();
    
    vi.useFakeTimers();
    
    let rafTime = 0;
    vi.stubGlobal('requestAnimationFrame', (cb) => {
      console.log('RAF called, scheduling callback at', rafTime + 16);
      return setTimeout(() => {
        console.log('RAF callback executing, time is', Date.now());
        cb(rafTime + 16);
        rafTime += 16;
      }, 16);
    });
    
    vi.stubGlobal('cancelAnimationFrame', (id) => clearTimeout(id));
    
    let perfTime = 0;
    vi.stubGlobal('performance', {
      now: vi.fn(() => {
        console.log('performance.now() called, returning', perfTime);
        return perfTime;
      })
    });
    
    const loop = new GameLoop(updateFn, renderFn);
    console.log('Starting loop');
    loop.start();
    console.log('Loop started');
    
    console.log('Advancing timers by 20ms');
    perfTime = 20;
    vi.advanceTimersByTime(20);
    
    console.log('Update calls:', updateFn.mock.calls.length);
    console.log('Render calls:', renderFn.mock.calls.length);
    
    vi.useRealTimers();
    expect(updateFn).toHaveBeenCalled();
  });
});
