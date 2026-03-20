import { Creature } from './Creature.js';
import { ENTITY_TYPES, DARK_MISTRESS_STATS } from '../constants.js';

/**
 * Dark Mistress — medium HP, fast, melee+whip, hits 2 targets, applies slow debuff.
 * Attracted by Training Room >= 6 tiles.
 */
export class DarkMistress extends Creature {
  constructor(x, y, world, eventBus, entityManager, roomManager) {
    super(ENTITY_TYPES.DARK_MISTRESS, x, y, DARK_MISTRESS_STATS, world, eventBus, entityManager, roomManager);
    this.maxTargets = DARK_MISTRESS_STATS.maxTargets;
    this.debuffOnHit = {
      type: 'slow',
      duration: DARK_MISTRESS_STATS.slowDebuffDuration,
      factor: DARK_MISTRESS_STATS.slowDebuffFactor,
    };
  }
}
