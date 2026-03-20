import {
  SPAWN_CHECK_INTERVAL_SEC, TILE_SIZE, ROOM_TYPES, ENTITY_TYPES, EVENTS,
  TROLL_STATS, DARK_MISTRESS_STATS,
} from '../constants.js';
import { Troll } from '../entities/Troll.js';
import { DarkMistress } from '../entities/DarkMistress.js';

export class CreatureSpawner {
  constructor(world, entityManager, eventBus, roomManager) {
    this._world = world;
    this._entityManager = entityManager;
    this._eventBus = eventBus;
    this._roomManager = roomManager;
    this._timer = SPAWN_CHECK_INTERVAL_SEC;
  }

  update(dt) {
    this._timer -= dt;
    if (this._timer > 0) return;
    this._timer = SPAWN_CHECK_INTERVAL_SEC;
    this._checkSpawnConditions();
  }

  _checkSpawnConditions() {
    const hatcheryTiles = this._roomManager.getTotalTilesOfType(ROOM_TYPES.HATCHERY);
    const trollCount = this._entityManager.getByType(ENTITY_TYPES.TROLL).length;
    if (hatcheryTiles >= TROLL_STATS.attractionMinTiles && trollCount < TROLL_STATS.maxCount) {
      this._spawnCreature(ENTITY_TYPES.TROLL, ROOM_TYPES.HATCHERY);
    }

    const trainingTiles = this._roomManager.getTotalTilesOfType(ROOM_TYPES.TRAINING_ROOM);
    const dmCount = this._entityManager.getByType(ENTITY_TYPES.DARK_MISTRESS).length;
    if (trainingTiles >= DARK_MISTRESS_STATS.attractionMinTiles && dmCount < DARK_MISTRESS_STATS.maxCount) {
      this._spawnCreature(ENTITY_TYPES.DARK_MISTRESS, ROOM_TYPES.TRAINING_ROOM);
    }
  }

  _spawnCreature(type, roomType) {
    const tiles = this._roomManager.getRoomTilesOfType(roomType);
    if (tiles.length === 0) return;
    const tile = tiles[Math.floor(Math.random() * tiles.length)];
    const x = tile.x * TILE_SIZE + TILE_SIZE / 2;
    const y = tile.y * TILE_SIZE + TILE_SIZE / 2;

    const creature = type === ENTITY_TYPES.TROLL
      ? new Troll(x, y, this._world, this._eventBus, this._entityManager, this._roomManager)
      : new DarkMistress(x, y, this._world, this._eventBus, this._entityManager, this._roomManager);

    this._entityManager.add(creature);
    this._eventBus.publish(EVENTS.ENTITY_SPAWNED, { entityId: creature.id, type, x, y });
  }
}
