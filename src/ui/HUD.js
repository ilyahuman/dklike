import { EVENTS, ENTITY_TYPES } from '../constants.js';

/**
 * Top-bar HUD overlay showing gold, mana, imp count, wave timer.
 * HTML overlay — not canvas-drawn. Reads state, never mutates.
 */
export class HUD {
  /**
   * @param {HTMLElement} container - The #hud-overlay element.
   * @param {import('../core/EventBus.js').EventBus} eventBus
   * @param {import('../systems/ResourceManager.js').ResourceManager} resourceManager
   * @param {import('../entities/EntityManager.js').EntityManager} entityManager
   */
  constructor(container, eventBus, resourceManager, entityManager) {
    this._eventBus = eventBus;
    this._resourceManager = resourceManager;
    this._entityManager = entityManager;
    this._displayGold = 0;
    this._targetGold = 0;
    this._build(container);
    this._subscribe();
  }

  /** @private */
  _build(container) {
    this._el = document.createElement('div');
    this._el.id = 'hud-bar';
    this._el.innerHTML = `
      <div class="hud-item">
        <span class="gold-icon"></span>
        <span class="hud-gold-val" id="hud-gold">0</span>
      </div>
      <div class="hud-item">
        <span class="hud-label">Mana</span>
        <div class="mana-bar-bg"><div class="mana-bar-fill" id="hud-mana-fill"></div></div>
        <span class="hud-mana-val" id="hud-mana-text">0</span>
      </div>
      <div class="hud-item">
        <span class="hud-label">Imps</span>
        <span class="hud-imp-val" id="hud-imp-count">0</span>
      </div>
      <div class="hud-item">
        <span class="hud-label">Wave</span>
        <span class="hud-wave-val" id="hud-wave-timer">---</span>
      </div>
    `;
    container.appendChild(this._el);

    this._goldEl = this._el.querySelector('#hud-gold');
    this._manaFill = this._el.querySelector('#hud-mana-fill');
    this._manaText = this._el.querySelector('#hud-mana-text');
    this._impCountEl = this._el.querySelector('#hud-imp-count');
    this._waveTimerEl = this._el.querySelector('#hud-wave-timer');
  }

  /** @private */
  _subscribe() {
    this._eventBus.subscribe(EVENTS.RESOURCES_CHANGED, (data) => {
      this._targetGold = Math.floor(data.gold);
      const manaPercent = (data.mana / data.manaCap) * 100;
      this._manaFill.style.width = `${manaPercent}%`;
      this._manaText.textContent = `${Math.floor(data.mana)}/${data.manaCap}`;
    });
  }

  /**
   * Called each render frame. Tweens gold display and updates imp count.
   * @param {number} dt - Seconds since last frame.
   */
  update(dt) {
    // Gold tween animation
    if (this._displayGold !== this._targetGold) {
      const diff = this._targetGold - this._displayGold;
      const step = Math.max(1, Math.ceil(Math.abs(diff) * 5 * dt));
      if (Math.abs(diff) <= step) {
        this._displayGold = this._targetGold;
      } else {
        this._displayGold += Math.sign(diff) * step;
      }
      this._goldEl.textContent = this._displayGold;
    }

    // Imp count from EntityManager
    const impCount = this._entityManager.getByType(ENTITY_TYPES.IMP).length;
    this._impCountEl.textContent = impCount;
  }

  /**
   * Update wave timer display.
   * @param {string} text - Timer text (e.g., "45s" or "---").
   */
  setWaveTimer(text) {
    this._waveTimerEl.textContent = text;
  }
}
