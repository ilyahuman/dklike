import { EVENTS, ROOM_TYPES, ROOM_CONFIG } from '../constants.js';

/**
 * Bottom toolbar with room/spell/door tools, speed toggle, and hotkeys.
 * Publishes TOOL_SELECTED and SPEED_CHANGED events on EventBus.
 */
export class Toolbar {
  /**
   * @param {HTMLElement} container - The #hud-overlay element.
   * @param {import('../core/EventBus.js').EventBus} eventBus
   */
  constructor(container, eventBus) {
    this._eventBus = eventBus;
    this._activeTool = 'dig';
    this._speed = 1;
    this._build(container);
    this._bindKeys();
  }

  /** @returns {string} Current active tool id. */
  get activeTool() { return this._activeTool; }

  /** @private */
  _build(container) {
    this._el = document.createElement('div');
    this._el.id = 'toolbar';

    const tools = [
      { id: 'dig', label: 'Dig', hotkey: '1' },
      { id: `room:${ROOM_TYPES.LAIR}`, label: 'Lair', hotkey: '2', cost: `${ROOM_CONFIG[ROOM_TYPES.LAIR].goldPerTile}g` },
      { id: `room:${ROOM_TYPES.HATCHERY}`, label: 'Hatchery', hotkey: '3', cost: `${ROOM_CONFIG[ROOM_TYPES.HATCHERY].goldPerTile}g` },
      { id: `room:${ROOM_TYPES.TREASURY}`, label: 'Treasury', hotkey: '4', cost: `${ROOM_CONFIG[ROOM_TYPES.TREASURY].goldPerTile}g` },
      { id: `room:${ROOM_TYPES.TRAINING_ROOM}`, label: 'Training', hotkey: '5', cost: `${ROOM_CONFIG[ROOM_TYPES.TRAINING_ROOM].goldPerTile}g` },
    ];

    const disabledTools = [
      { id: 'spell:create_imp', label: 'Imp', hotkey: '6', cost: '200m' },
      { id: 'spell:lightning', label: 'Lightning', hotkey: '7', cost: '150m' },
      { id: 'spell:possess', label: 'Possess', hotkey: '8', cost: '100m' },
      { id: 'door', label: 'Door', hotkey: '9', cost: '100g' },
    ];

    for (const t of tools) {
      this._el.appendChild(this._createButton(t, false));
    }

    // Divider
    const div = document.createElement('div');
    div.className = 'toolbar-divider';
    this._el.appendChild(div);

    for (const t of disabledTools) {
      this._el.appendChild(this._createButton(t, true));
    }

    // Another divider
    const div2 = document.createElement('div');
    div2.className = 'toolbar-divider';
    this._el.appendChild(div2);

    // Speed toggle
    this._speedBtn = document.createElement('button');
    this._speedBtn.className = 'tool-btn';
    this._speedBtn.id = 'speed-toggle';
    this._speedBtn.innerHTML = '<span class="tool-name">1×</span>';
    this._speedBtn.addEventListener('click', () => this._toggleSpeed());
    this._el.appendChild(this._speedBtn);

    container.appendChild(this._el);

    // Set initial active state
    this._updateActiveState();
  }

  /** @private */
  _createButton(tool, disabled) {
    const btn = document.createElement('button');
    btn.className = `tool-btn${disabled ? ' disabled' : ''}`;
    btn.dataset.toolId = tool.id;

    let html = `<span class="tool-name">${tool.label}</span>`;
    if (tool.cost) html += `<span class="tool-cost">${tool.cost}</span>`;
    html += `<span class="tool-hotkey">${tool.hotkey}</span>`;
    btn.innerHTML = html;

    if (!disabled) {
      btn.addEventListener('click', () => this._selectTool(tool.id));
    }
    return btn;
  }

  /** @private */
  _bindKeys() {
    this._eventBus.subscribe(EVENTS.INPUT_KEY_DOWN, (e) => {
      const map = {
        'Digit1': 'dig',
        'Digit2': `room:${ROOM_TYPES.LAIR}`,
        'Digit3': `room:${ROOM_TYPES.HATCHERY}`,
        'Digit4': `room:${ROOM_TYPES.TREASURY}`,
        'Digit5': `room:${ROOM_TYPES.TRAINING_ROOM}`,
        'Digit6': 'spell:create_imp',
        'Digit7': 'spell:lightning',
        'Digit8': 'spell:possess',
        'Digit9': 'door',
      };
      const tool = map[e.code];
      if (tool) {
        // Only select if not disabled (tools 6-9 are disabled in Phase 3)
        const btn = this._el.querySelector(`[data-tool-id="${tool}"]`);
        if (btn && !btn.classList.contains('disabled')) {
          this._selectTool(tool);
        }
      }
    });
  }

  /** @private */
  _selectTool(toolId) {
    this._activeTool = toolId;
    this._updateActiveState();
    this._eventBus.publish(EVENTS.TOOL_SELECTED, { tool: toolId });
  }

  /** @private */
  _updateActiveState() {
    for (const btn of this._el.querySelectorAll('.tool-btn')) {
      btn.classList.toggle('active', btn.dataset.toolId === this._activeTool);
    }
  }

  /** @private */
  _toggleSpeed() {
    this._speed = this._speed === 1 ? 2 : 1;
    this._speedBtn.querySelector('.tool-name').textContent = `${this._speed}×`;
    this._eventBus.publish(EVENTS.SPEED_CHANGED, { speed: this._speed });
  }
}
