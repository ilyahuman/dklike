import { Hero } from './Hero.js';
import { ENTITY_TYPES, KNIGHT_STATS } from '../constants.js';

/**
 * Knight hero — high HP, slow, melee. Attacks creatures and doors on path.
 */
export class Knight extends Hero {
  constructor(x, y, world, eventBus, entityManager, roomManager) {
    super(ENTITY_TYPES.KNIGHT, x, y, KNIGHT_STATS, world, eventBus, entityManager, roomManager);
  }
}
