import { WAVE, TILE_SIZE, EVENTS } from '../constants.js';
import { Knight } from '../entities/Knight.js';
import { Thief } from '../entities/Thief.js';
import { Wizard } from '../entities/Wizard.js';

export class WaveManager {
  constructor(world, entityManager, eventBus, roomManager) {
    this._world = world;
    this._entityManager = entityManager;
    this._eventBus = eventBus;
    this._roomManager = roomManager;
    this._timer = WAVE.INTERVAL_SEC;
    this._waveNumber = 0;
    this._activeHeroes = new Set();
  }

  get waveNumber() { return this._waveNumber; }
  get countdown() { return Math.ceil(this._timer); }

  update(dt) {
    this._timer -= dt;

    if (this._activeHeroes.size > 0) {
      for (const heroId of this._activeHeroes) {
        const hero = this._entityManager.getById(heroId);
        if (!hero || !hero.alive) {
          this._activeHeroes.delete(heroId);
        }
      }
      if (this._activeHeroes.size === 0 && this._waveNumber > 0) {
        this._eventBus.publish(EVENTS.WAVE_COMPLETED, { wave: this._waveNumber });
      }
    }

    if (this._timer <= 0) {
      this._timer = WAVE.INTERVAL_SEC;
      this._spawnWave();
    }
  }

  _spawnWave() {
    this._waveNumber++;
    const n = this._waveNumber;

    const knightCount = n * WAVE.KNIGHT_PER_WAVE;
    const thiefCount = Math.ceil(n * WAVE.THIEF_PER_WAVE);
    const wizardCount = Math.ceil(n * WAVE.WIZARD_PER_WAVE);

    const spawnPoint = this._findSpawnPoint();
    if (!spawnPoint) return;

    const spawnX = spawnPoint.x * TILE_SIZE + TILE_SIZE / 2;
    const spawnY = spawnPoint.y * TILE_SIZE + TILE_SIZE / 2;

    const spawn = (Cls, count) => {
      for (let i = 0; i < count; i++) {
        const hero = new Cls(
          spawnX + (Math.random() - 0.5) * TILE_SIZE,
          spawnY + (Math.random() - 0.5) * TILE_SIZE,
          this._world, this._eventBus, this._entityManager, this._roomManager,
        );
        this._entityManager.add(hero);
        this._activeHeroes.add(hero.id);
      }
    };

    spawn(Knight, knightCount);
    spawn(Thief, thiefCount);
    spawn(Wizard, wizardCount);

    this._eventBus.publish(EVENTS.WAVE_STARTED, {
      wave: n,
      knights: knightCount,
      thieves: thiefCount,
      wizards: wizardCount,
    });
  }

  _findSpawnPoint() {
    const edge = Math.floor(Math.random() * 4);
    const w = this._world.width;
    const h = this._world.height;
    let targetX, targetY;

    switch (edge) {
      case 0: targetX = Math.floor(Math.random() * w); targetY = 0; break;
      case 1: targetX = Math.floor(Math.random() * w); targetY = h - 1; break;
      case 2: targetX = 0; targetY = Math.floor(Math.random() * h); break;
      default: targetX = w - 1; targetY = Math.floor(Math.random() * h); break;
    }

    let bestTile = null;
    let bestDist = Infinity;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (this._world.isWalkable(x, y)) {
          const dist = Math.abs(x - targetX) + Math.abs(y - targetY);
          if (dist < bestDist) {
            bestDist = dist;
            bestTile = { x, y };
          }
        }
      }
    }
    return bestTile;
  }
}
