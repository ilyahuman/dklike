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
    const w = this._world.width;
    const h = this._world.height;
    const edge = Math.floor(Math.random() * 4);

    let x, y;
    switch (edge) {
      case 0: x = Math.floor(Math.random() * w); y = 0; break;        // top
      case 1: x = Math.floor(Math.random() * w); y = h - 1; break;    // bottom
      case 2: x = 0; y = Math.floor(Math.random() * h); break;        // left
      default: x = w - 1; y = Math.floor(Math.random() * h); break;   // right
    }
    return { x, y };
  }
}
