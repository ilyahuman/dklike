import { EVENTS } from '../constants.js';

const STATES = Object.freeze({
  MENU: 'menu',
  PLAYING: 'playing',
  PAUSED: 'paused',
  GAME_OVER: 'game_over',
  VICTORY: 'victory',
});

/**
 * Simple state machine for game lifecycle.
 * Manages transitions: MENU → PLAYING ↔ PAUSED → GAME_OVER/VICTORY.
 * Tracks session stats (waves survived, gold earned, etc.).
 */
export class GameStateManager {
  /** @param {import('./EventBus.js').EventBus} eventBus */
  constructor(eventBus) {
    this._eventBus = eventBus;
    this._state = STATES.MENU;
    this._stats = {};
    this._elapsedTime = 0;
    this._resetStats();
  }

  get state() { return this._state; }
  get elapsedTime() { return this._elapsedTime; }

  startGame() {
    if (this._state !== STATES.MENU) return;
    this._state = STATES.PLAYING;
    this._elapsedTime = 0;
    this._resetStats();
    this._eventBus.publish(EVENTS.GAME_STATE_CHANGED, { state: STATES.PLAYING });
  }

  pause() {
    if (this._state !== STATES.PLAYING) return;
    this._state = STATES.PAUSED;
    this._eventBus.publish(EVENTS.GAME_STATE_CHANGED, { state: STATES.PAUSED });
  }

  resume() {
    if (this._state !== STATES.PAUSED) return;
    this._state = STATES.PLAYING;
    this._eventBus.publish(EVENTS.GAME_STATE_CHANGED, { state: STATES.PLAYING });
  }

  gameOver() {
    if (this._state !== STATES.PLAYING && this._state !== STATES.PAUSED) return;
    this._state = STATES.GAME_OVER;
    this._eventBus.publish(EVENTS.GAME_OVER, {
      stats: { ...this._stats },
      elapsedTime: this._elapsedTime,
    });
    this._eventBus.publish(EVENTS.GAME_STATE_CHANGED, { state: STATES.GAME_OVER });
  }

  victory() {
    if (this._state !== STATES.PLAYING) return;
    this._state = STATES.VICTORY;
    this._eventBus.publish(EVENTS.GAME_VICTORY, {
      stats: { ...this._stats },
      elapsedTime: this._elapsedTime,
    });
    this._eventBus.publish(EVENTS.GAME_STATE_CHANGED, { state: STATES.VICTORY });
  }

  restart() {
    this._state = STATES.MENU;
    this._elapsedTime = 0;
    this._resetStats();
    this._eventBus.publish(EVENTS.GAME_STATE_CHANGED, { state: STATES.MENU });
  }

  /** @param {number} dt - Seconds since last update. */
  updateTime(dt) {
    if (this._state === STATES.PLAYING) {
      this._elapsedTime += dt;
    }
  }

  addStat(key, value) {
    this._stats[key] = (this._stats[key] || 0) + value;
  }

  getStat(key) {
    return this._stats[key] || 0;
  }

  getStats() {
    return { ...this._stats, elapsedTime: this._elapsedTime };
  }

  /** @private */
  _resetStats() {
    this._stats = {
      wavesSurvived: 0,
      goldEarned: 0,
      creaturesLost: 0,
      heroesKilled: 0,
    };
  }
}

export { STATES as GAME_STATES };
