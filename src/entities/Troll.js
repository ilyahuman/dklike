import { Creature } from './Creature.js';
import { ENTITY_TYPES, TROLL_STATS } from '../constants.js';

/**
 * Troll creature — high HP, slow, melee, high damage.
 * Attracted by Hatchery >= 6 tiles.
 */
export class Troll extends Creature {
  constructor(x, y, world, eventBus, entityManager, roomManager) {
    super(ENTITY_TYPES.TROLL, x, y, TROLL_STATS, world, eventBus, entityManager, roomManager);
  }
}
