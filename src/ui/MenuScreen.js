import { EVENTS } from '../constants.js';

/**
 * HTML overlay screens for main menu, game over, and victory.
 * Manages four distinct screen states, all rendered as HTML overlays.
 */
export class MenuScreen {
  /**
   * @param {HTMLElement} container - The #hud-overlay element.
   * @param {import('../core/EventBus.js').EventBus} eventBus
   */
  constructor(container, eventBus) {
    this._container = container;
    this._eventBus = eventBus;
    this._buildMainMenu();
    this._buildGameOver();
    this._buildVictory();
    this._buildPauseMenu();
  }

  /** @private */
  _buildMainMenu() {
    this._menuEl = document.createElement('div');
    this._menuEl.id = 'main-menu';
    this._menuEl.style.cssText = `
      position:fixed;top:0;left:0;width:100%;height:100%;
      display:flex;flex-direction:column;align-items:center;justify-content:center;
      background:radial-gradient(ellipse at center, #1a1510 0%, #0a0a08 70%);
      z-index:500;pointer-events:auto;
    `;
    this._menuEl.innerHTML = `
      <h1 style="font-family:'MedievalSharp',cursive;font-size:64px;color:#c0a060;
        text-shadow:0 0 20px rgba(192,160,96,0.4),0 4px 8px rgba(0,0,0,0.8);
        margin-bottom:16px;">Dungeon Keeper</h1>
      <p style="font-family:'Inter',sans-serif;font-size:14px;color:#706050;
        max-width:400px;text-align:center;margin-bottom:40px;line-height:1.6;">
        Carve your domain from the earth. Build rooms to attract creatures.
        Defend your Dungeon Heart against the heroes of the realm.
        Survive ten waves and amass 5000 gold to claim victory.</p>
      <button id="btn-begin" style="font-family:'MedievalSharp',cursive;font-size:28px;
        color:#f0d080;background:linear-gradient(180deg,#4a4238 0%,#3a3228 100%);
        border:2px solid #8a7a5a;border-radius:6px;padding:12px 48px;cursor:pointer;
        transition:all 0.2s;letter-spacing:2px;">BEGIN</button>
    `;
    this._container.appendChild(this._menuEl);

    this._menuEl.querySelector('#btn-begin').addEventListener('click', () => {
      this._eventBus.publish('menu:start', {});
    });
    this._menuEl.querySelector('#btn-begin').addEventListener('mouseenter', (e) => {
      e.target.style.borderColor = '#c0a060';
      e.target.style.color = '#ffe0a0';
      e.target.style.transform = 'scale(1.05)';
    });
    this._menuEl.querySelector('#btn-begin').addEventListener('mouseleave', (e) => {
      e.target.style.borderColor = '#8a7a5a';
      e.target.style.color = '#f0d080';
      e.target.style.transform = 'scale(1)';
    });
  }

  /** @private */
  _buildGameOver() {
    this._gameOverEl = document.createElement('div');
    this._gameOverEl.id = 'game-over-screen';
    this._gameOverEl.style.cssText = `
      position:fixed;top:0;left:0;width:100%;height:100%;
      display:none;flex-direction:column;align-items:center;justify-content:center;
      background:rgba(10,0,0,0.85);z-index:500;pointer-events:auto;
    `;
    this._gameOverEl.innerHTML = `
      <h1 style="font-family:'MedievalSharp',cursive;font-size:56px;color:#c04040;
        text-shadow:0 0 30px rgba(200,0,0,0.5),0 4px 8px rgba(0,0,0,0.8);
        margin-bottom:24px;">YOUR DUNGEON FALLS</h1>
      <div id="go-stats" style="font-family:'Inter',sans-serif;font-size:14px;
        color:#a09080;max-width:350px;text-align:left;line-height:2;
        background:rgba(30,25,20,0.8);padding:20px 30px;border:1px solid #4a3a2a;
        border-radius:6px;margin-bottom:30px;"></div>
      <button id="btn-restart-go" style="font-family:'MedievalSharp',cursive;font-size:24px;
        color:#c0a060;background:linear-gradient(180deg,#4a4238 0%,#3a3228 100%);
        border:2px solid #6a5a45;border-radius:6px;padding:10px 36px;cursor:pointer;">
        RESTART</button>
    `;
    this._container.appendChild(this._gameOverEl);

    this._gameOverEl.querySelector('#btn-restart-go').addEventListener('click', () => {
      this._eventBus.publish('menu:restart', {});
    });
  }

  /** @private */
  _buildVictory() {
    this._victoryEl = document.createElement('div');
    this._victoryEl.id = 'victory-screen';
    this._victoryEl.style.cssText = `
      position:fixed;top:0;left:0;width:100%;height:100%;
      display:none;flex-direction:column;align-items:center;justify-content:center;
      background:rgba(10,8,0,0.85);z-index:500;pointer-events:auto;
    `;
    this._victoryEl.innerHTML = `
      <h1 style="font-family:'MedievalSharp',cursive;font-size:56px;color:#f0c040;
        text-shadow:0 0 30px rgba(240,192,64,0.5),0 4px 8px rgba(0,0,0,0.8);
        margin-bottom:24px;">THE REALM IS YOURS</h1>
      <div id="vic-stats" style="font-family:'Inter',sans-serif;font-size:14px;
        color:#a09080;max-width:350px;text-align:left;line-height:2;
        background:rgba(30,25,20,0.8);padding:20px 30px;border:1px solid #5a4a2a;
        border-radius:6px;margin-bottom:30px;"></div>
      <button id="btn-restart-vic" style="font-family:'MedievalSharp',cursive;font-size:24px;
        color:#f0d080;background:linear-gradient(180deg,#4a4238 0%,#3a3228 100%);
        border:2px solid #8a7a5a;border-radius:6px;padding:10px 36px;cursor:pointer;">
        RESTART</button>
    `;
    this._container.appendChild(this._victoryEl);

    this._victoryEl.querySelector('#btn-restart-vic').addEventListener('click', () => {
      this._eventBus.publish('menu:restart', {});
    });
  }

  /** @private */
  _buildPauseMenu() {
    this._pauseEl = document.createElement('div');
    this._pauseEl.id = 'pause-menu';
    this._pauseEl.style.cssText = `
      position:fixed;top:0;left:0;width:100%;height:100%;
      display:none;flex-direction:column;align-items:center;justify-content:center;
      background:rgba(10,10,10,0.7);z-index:500;pointer-events:auto;
    `;
    this._pauseEl.innerHTML = `
      <h1 style="font-family:'MedievalSharp',cursive;font-size:48px;color:#c0b090;
        text-shadow:0 4px 8px rgba(0,0,0,0.8);margin-bottom:30px;">PAUSED</h1>
      <div style="display:flex;flex-direction:column;gap:12px;">
        <button class="pause-btn" id="btn-resume" style="font-family:'MedievalSharp',cursive;
          font-size:22px;color:#c0a060;background:linear-gradient(180deg,#4a4238 0%,#3a3228 100%);
          border:2px solid #6a5a45;border-radius:6px;padding:10px 36px;cursor:pointer;
          min-width:200px;">RESUME</button>
        <button class="pause-btn" id="btn-restart-pause" style="font-family:'MedievalSharp',cursive;
          font-size:22px;color:#a08060;background:linear-gradient(180deg,#4a4238 0%,#3a3228 100%);
          border:2px solid #6a5a45;border-radius:6px;padding:10px 36px;cursor:pointer;
          min-width:200px;">RESTART</button>
        <button class="pause-btn" id="btn-quit" style="font-family:'MedievalSharp',cursive;
          font-size:22px;color:#806050;background:linear-gradient(180deg,#4a4238 0%,#3a3228 100%);
          border:2px solid #5a4a35;border-radius:6px;padding:10px 36px;cursor:pointer;
          min-width:200px;">QUIT</button>
      </div>
    `;
    this._container.appendChild(this._pauseEl);

    this._pauseEl.querySelector('#btn-resume').addEventListener('click', () => {
      this._eventBus.publish('menu:resume', {});
    });
    this._pauseEl.querySelector('#btn-restart-pause').addEventListener('click', () => {
      this._eventBus.publish('menu:restart', {});
    });
    this._pauseEl.querySelector('#btn-quit').addEventListener('click', () => {
      this._eventBus.publish('menu:quit', {});
    });
  }

  /** Show main menu, hide others. */
  showMenu() {
    this._menuEl.style.display = 'flex';
    this._gameOverEl.style.display = 'none';
    this._victoryEl.style.display = 'none';
    this._pauseEl.style.display = 'none';
  }

  /** Hide all screens. */
  hideAll() {
    this._menuEl.style.display = 'none';
    this._gameOverEl.style.display = 'none';
    this._victoryEl.style.display = 'none';
    this._pauseEl.style.display = 'none';
  }

  /** Show game over screen with stats. */
  showGameOver(stats) {
    this._menuEl.style.display = 'none';
    this._pauseEl.style.display = 'none';
    this._gameOverEl.style.display = 'flex';
    this._gameOverEl.querySelector('#go-stats').innerHTML = this._formatStats(stats);
  }

  /** Show victory screen with stats. */
  showVictory(stats) {
    this._menuEl.style.display = 'none';
    this._pauseEl.style.display = 'none';
    this._victoryEl.style.display = 'flex';
    this._victoryEl.querySelector('#vic-stats').innerHTML = this._formatStats(stats);
  }

  /** Show pause overlay. */
  showPause() {
    this._pauseEl.style.display = 'flex';
  }

  /** Hide pause overlay. */
  hidePause() {
    this._pauseEl.style.display = 'none';
  }

  /** @private */
  _formatStats(stats) {
    const time = stats.elapsedTime || 0;
    const min = Math.floor(time / 60);
    const sec = Math.floor(time % 60);
    return `
      <div>Waves Survived: <span style="color:#e0d0a0">${stats.wavesSurvived || 0}</span></div>
      <div>Gold Earned: <span style="color:#f0c040">${stats.goldEarned || 0}</span></div>
      <div>Heroes Killed: <span style="color:#c06040">${stats.heroesKilled || 0}</span></div>
      <div>Creatures Lost: <span style="color:#a04040">${stats.creaturesLost || 0}</span></div>
      <div>Time: <span style="color:#e0d0a0">${min}m ${sec}s</span></div>
    `;
  }
}
