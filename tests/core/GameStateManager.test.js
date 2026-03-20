import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GameStateManager } from '../../src/core/GameStateManager.js';
import { EVENTS } from '../../src/constants.js';

function makeEventBus() {
  return {
    publish: vi.fn(),
    subscribe: vi.fn(),
  };
}

describe('GameStateManager', () => {
  let gsm, eventBus;

  beforeEach(() => {
    eventBus = makeEventBus();
    gsm = new GameStateManager(eventBus);
  });

  it('should start in MENU state', () => {
    expect(gsm.state).toBe('menu');
  });

  it('should transition MENU → PLAYING via startGame()', () => {
    gsm.startGame();
    expect(gsm.state).toBe('playing');
    expect(eventBus.publish).toHaveBeenCalledWith(EVENTS.GAME_STATE_CHANGED, { state: 'playing' });
  });

  it('should transition PLAYING → PAUSED via pause()', () => {
    gsm.startGame();
    gsm.pause();
    expect(gsm.state).toBe('paused');
  });

  it('should transition PAUSED → PLAYING via resume()', () => {
    gsm.startGame();
    gsm.pause();
    gsm.resume();
    expect(gsm.state).toBe('playing');
  });

  it('should transition PLAYING → GAME_OVER via gameOver()', () => {
    gsm.startGame();
    gsm.gameOver();
    expect(gsm.state).toBe('game_over');
    expect(eventBus.publish).toHaveBeenCalledWith(EVENTS.GAME_OVER, expect.any(Object));
  });

  it('should transition PLAYING → VICTORY via victory()', () => {
    gsm.startGame();
    gsm.victory();
    expect(gsm.state).toBe('victory');
    expect(eventBus.publish).toHaveBeenCalledWith(EVENTS.GAME_VICTORY, expect.any(Object));
  });

  it('should not allow invalid transitions', () => {
    gsm.pause();
    expect(gsm.state).toBe('menu');
  });

  it('should track stats', () => {
    gsm.startGame();
    gsm.addStat('heroesKilled', 5);
    gsm.addStat('heroesKilled', 3);
    gsm.addStat('goldEarned', 1000);
    expect(gsm.getStat('heroesKilled')).toBe(8);
    expect(gsm.getStat('goldEarned')).toBe(1000);
  });

  it('should include stats in gameOver event', () => {
    gsm.startGame();
    gsm.addStat('heroesKilled', 5);
    gsm.gameOver();
    const call = eventBus.publish.mock.calls.find(c => c[0] === EVENTS.GAME_OVER);
    expect(call[1].stats.heroesKilled).toBe(5);
  });

  it('should reset all state via restart()', () => {
    gsm.startGame();
    gsm.addStat('heroesKilled', 5);
    gsm.restart();
    expect(gsm.state).toBe('menu');
    expect(gsm.getStat('heroesKilled')).toBe(0);
  });

  it('should track elapsed time', () => {
    gsm.startGame();
    gsm.updateTime(1.5);
    gsm.updateTime(2.0);
    expect(gsm.elapsedTime).toBeCloseTo(3.5);
  });
});
