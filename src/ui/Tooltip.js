import { TILE_SIZE } from '../constants.js';

/**
 * Floating tooltip showing info about the tile/room/creature under cursor.
 * HTML overlay — reads state, never mutates.
 */
export class Tooltip {
  /**
   * @param {HTMLElement} container - The #hud-overlay element.
   * @param {import('../world/World.js').World} world
   * @param {import('../systems/RoomManager.js').RoomManager} roomManager
   * @param {import('../entities/EntityManager.js').EntityManager} entityManager
   */
  constructor(container, world, roomManager, entityManager) {
    this._world = world;
    this._roomManager = roomManager;
    this._entityManager = entityManager;

    this._el = document.createElement('div');
    this._el.id = 'tooltip';
    container.appendChild(this._el);
  }

  /**
   * Update tooltip for the given cursor position.
   * @param {number} screenX
   * @param {number} screenY
   * @param {number} worldX - World-space X in pixels.
   * @param {number} worldY - World-space Y in pixels.
   */
  show(screenX, screenY, worldX, worldY) {
    const tileX = Math.floor(worldX / TILE_SIZE);
    const tileY = Math.floor(worldY / TILE_SIZE);
    let lines = [];

    // Check entities first (highest priority)
    const entities = this._entityManager.getEntitiesInRadius(worldX, worldY, TILE_SIZE * 0.6);
    if (entities.length > 0) {
      const e = entities[0];
      lines.push(`<div class="tt-title">${this._formatType(e.type)}</div>`);
      lines.push(`<div class="tt-row">HP: ${Math.ceil(e.health)} / ${e.maxHealth}</div>`);
      lines.push(`<div class="tt-row">State: ${e.state}</div>`);
      if (e.hunger !== undefined) {
        lines.push(`<div class="tt-row">Hunger: ${Math.floor(e.hunger)}</div>`);
        lines.push(`<div class="tt-row">Energy: ${Math.floor(e.energy)}</div>`);
      }
    }

    // Room info
    const room = this._roomManager.getRoomAt(tileX, tileY);
    if (room && lines.length === 0) {
      lines.push(`<div class="tt-title">${this._formatType(room.type)}</div>`);
      lines.push(`<div class="tt-row">Tiles: ${room.tiles.length}</div>`);
    }

    // Tile info (fallback)
    const tile = this._world.getTile(tileX, tileY);
    if (tile && lines.length === 0) {
      lines.push(`<div class="tt-title">${this._formatType(tile)}</div>`);
    }

    if (lines.length === 0) {
      this.hide();
      return;
    }

    this._el.innerHTML = lines.join('');
    this._el.style.display = 'block';

    // Position near cursor, keep on screen
    const pad = 16;
    let x = screenX + pad;
    let y = screenY + pad;

    // Need to measure after display is set
    const rect = this._el.getBoundingClientRect();
    if (x + rect.width > window.innerWidth) x = screenX - rect.width - pad;
    if (y + rect.height > window.innerHeight) y = screenY - rect.height - pad;

    this._el.style.left = `${x}px`;
    this._el.style.top = `${y}px`;
  }

  /** Hide the tooltip. */
  hide() {
    this._el.style.display = 'none';
  }

  /**
   * Format type string for display (e.g., "gold_vein" → "Gold Vein").
   * @private
   */
  _formatType(type) {
    return type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  }
}
