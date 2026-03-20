import { Hero } from './Hero.js';
import { ENTITY_TYPES, THIEF_STATS, ROOM_TYPES, TILE_SIZE } from '../constants.js';

/**
 * Thief hero — low HP, fast. Bypasses creatures when possible, targets Treasury.
 */
export class Thief extends Hero {
  constructor(x, y, world, eventBus, entityManager, roomManager) {
    super(ENTITY_TYPES.THIEF, x, y, THIEF_STATS, world, eventBus, entityManager, roomManager);
  }

  /** @override - Target Treasury first, fallback to Dungeon Heart. */
  _repath() {
    if (this._roomManager) {
      const treasuryTiles = this._roomManager.getRoomTilesOfType(ROOM_TYPES.TREASURY);
      if (treasuryTiles.length > 0) {
        const { tx, ty } = this.getTile(TILE_SIZE);
        let best = null;
        let bestDist = Infinity;
        for (const t of treasuryTiles) {
          const dist = Math.abs(t.x - tx) + Math.abs(t.y - ty);
          if (dist < bestDist) {
            bestDist = dist;
            best = t;
          }
        }
        if (best) {
          this._pathToTile(best.x, best.y);
          if (this._path) return;
        }
      }
    }
    this._pathToDungeonHeart();
  }
}
