import { EventBus } from './core/EventBus.js';
import { GameLoop } from './core/GameLoop.js';
import { World } from './world/World.js';
import { MapGenerator } from './world/MapGenerator.js';
import { Pathfinder } from './world/Pathfinder.js';
import { Camera } from './rendering/Camera.js';
import { TileRenderer } from './rendering/TileRenderer.js';
import { Minimap } from './rendering/Minimap.js';
import { InputManager } from './input/InputManager.js';
import { EntityManager } from './entities/EntityManager.js';
import { EntityRenderer } from './rendering/EntityRenderer.js';
import { ParticleSystem } from './rendering/ParticleSystem.js';
import { JobQueue } from './systems/JobQueue.js';
import { Imp } from './entities/Imp.js';
import { COLORS, EVENTS, TILE_SIZE, TILE_TYPES } from './constants.js';

// ── Canvas setup ─────────────────────────────────────
/** @type {HTMLCanvasElement} */
const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
const fpsEl = document.getElementById('fps-counter');

function resizeCanvas() {
  const dpr = window.devicePixelRatio || 1;
  canvas.width = window.innerWidth * dpr;
  canvas.height = window.innerHeight * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  if (camera) camera.resize(window.innerWidth, window.innerHeight);
}

// ── Initialize systems ───────────────────────────────
const eventBus = new EventBus();
const world = new World();

// Generate map with random seed
const seed = Math.floor(Math.random() * 1000000);
MapGenerator.generate(world, seed);

const camera = new Camera(window.innerWidth, window.innerHeight);
const tileRenderer = new TileRenderer(ctx, world, camera);
const minimap = new Minimap(ctx, world, camera, eventBus);
const inputManager = new InputManager(canvas, camera, eventBus);

// Phase 2 systems
const entityManager = new EntityManager();
const entityRenderer = new EntityRenderer(ctx, entityManager, camera);
const particleSystem = new ParticleSystem(ctx, camera);
const jobQueue = new JobQueue(eventBus);

// Spawn initial imp at dungeon heart
const heartX = Math.floor(world.width / 2) * TILE_SIZE + TILE_SIZE / 2;
const heartY = Math.floor(world.height / 2) * TILE_SIZE + TILE_SIZE / 2;
const startImp = new Imp(heartX, heartY, world, eventBus, jobQueue);
entityManager.add(startImp);

// ── Event wiring ─────────────────────────────────────
// Handle minimap clicks
eventBus.subscribe(EVENTS.INPUT_CLICK, (e) => {
  if (minimap.handleClick(e.screenX, e.screenY)) return;

  // Click on diggable tile = queue dig job
  const { tileX, tileY } = e;
  if (world.isDiggable(tileX, tileY)) {
    // Check if adjacent to any walkable tile
    const neighbors = world.getNeighbors(tileX, tileY);
    const hasWalkableNeighbor = neighbors.some(n => world.isWalkable(n.x, n.y));
    if (hasWalkableNeighbor) {
      jobQueue.addDigJob(tileX, tileY);
      Pathfinder.clearCache();
    }
  }
});

// Particle effects on dig complete
eventBus.subscribe(EVENTS.TILE_DUG, (e) => {
  const wx = e.x * TILE_SIZE + TILE_SIZE / 2;
  const wy = e.y * TILE_SIZE + TILE_SIZE / 2;
  if (e.tileType === TILE_TYPES.GOLD_VEIN) {
    particleSystem.burst(wx, wy, '#f0c040', 15, { speed: 100, life: 0.8, size: 3 });
  } else {
    particleSystem.burst(wx, wy, '#8a7050', 8, { speed: 60, life: 0.5, size: 2 });
  }
});

window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// ── Game loop ────────────────────────────────────────
function update(dt) {
  inputManager.update(dt);
  entityManager.update(dt);
  particleSystem.update(dt);
}

function render(alpha) {
  const w = window.innerWidth;
  const h = window.innerHeight;
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = COLORS.BG;
  ctx.fillRect(0, 0, w, h);

  tileRenderer.render(alpha);
  entityRenderer.render(alpha);
  particleSystem.render();
  minimap.render();

  // Draw dig queue highlights
  for (const job of jobQueue.getAllDigJobs()) {
    const [sx, sy] = camera.worldToScreen(job.x * TILE_SIZE, job.y * TILE_SIZE);
    const size = TILE_SIZE * camera.zoom;
    ctx.fillStyle = job.assignedTo ? 'rgba(255, 200, 0, 0.2)' : 'rgba(255, 255, 0, 0.3)';
    ctx.fillRect(sx, sy, size, size);
  }

  fpsEl.textContent = `FPS: ${gameLoop.fps}`;
}

const gameLoop = new GameLoop(update, render);
gameLoop.start();
