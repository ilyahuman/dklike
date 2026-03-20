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
import { ResourceManager } from './systems/ResourceManager.js';
import { RoomManager } from './systems/RoomManager.js';
import { Imp } from './entities/Imp.js';
import { HUD } from './ui/HUD.js';
import { Toolbar } from './ui/Toolbar.js';
import { Tooltip } from './ui/Tooltip.js';
import {
  COLORS, EVENTS, TILE_SIZE, TILE_TYPES, ROOM_TYPES,
  ROOM_CONFIG, RESOURCES, ENTITY_TYPES,
} from './constants.js';

// ── Canvas setup ─────────────────────────────────────
/** @type {HTMLCanvasElement} */
const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
const fpsEl = document.getElementById('fps-counter');
const hudOverlay = document.getElementById('hud-overlay');

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

const seed = Math.floor(Math.random() * 1000000);
MapGenerator.generate(world, seed);

const camera = new Camera(window.innerWidth, window.innerHeight);
const roomManager = new RoomManager(eventBus);
const tileRenderer = new TileRenderer(ctx, world, camera, roomManager);
const minimap = new Minimap(ctx, world, camera, eventBus);
const inputManager = new InputManager(canvas, camera, eventBus);

const entityManager = new EntityManager();
const entityRenderer = new EntityRenderer(ctx, entityManager, camera);
const particleSystem = new ParticleSystem(ctx, camera);
const jobQueue = new JobQueue(eventBus);
const resourceManager = new ResourceManager(eventBus);

// UI
const hud = new HUD(hudOverlay, eventBus, resourceManager, entityManager);
const toolbar = new Toolbar(hudOverlay, eventBus);
const tooltip = new Tooltip(hudOverlay, world, roomManager, entityManager);

// ── Register Dungeon Heart room ──────────────────────
const heartCx = Math.floor(world.width / 2);
const heartCy = Math.floor(world.height / 2);
const heartTiles = [];
for (let dy = -1; dy <= 1; dy++) {
  for (let dx = -1; dx <= 1; dx++) {
    heartTiles.push({ x: heartCx + dx, y: heartCy + dy });
  }
}
roomManager.placeRoom(ROOM_TYPES.DUNGEON_HEART, heartTiles);

// ── Spawn initial imp ────────────────────────────────
const heartX = heartCx * TILE_SIZE + TILE_SIZE / 2;
const heartY = heartCy * TILE_SIZE + TILE_SIZE / 2;
const startImp = new Imp(heartX, heartY, world, eventBus, jobQueue, roomManager);
entityManager.add(startImp);

// ── Room placement state ─────────────────────────────
let activeTool = 'dig';
/** @type {Set<string>} "x,y" keys for pending room tiles */
const pendingRoomTiles = new Set();
let hoverTileX = -1;
let hoverTileY = -1;

// Placement info overlay
const placementInfoEl = document.createElement('div');
placementInfoEl.id = 'placement-info';
hudOverlay.appendChild(placementInfoEl);

/** Get room type from tool id (e.g., "room:lair" → "lair"). */
function getRoomTypeFromTool(tool) {
  if (tool.startsWith('room:')) return tool.slice(5);
  return null;
}

/** Check if a tile is valid for the current room placement. */
function isValidRoomTile(tx, ty) {
  const tile = world.getTile(tx, ty);
  if (tile !== TILE_TYPES.CLAIMED_FLOOR) return false;
  if (roomManager.isRoomTile(tx, ty)) return false;
  return true;
}

/** Update placement info display. */
function updatePlacementInfo() {
  const roomType = getRoomTypeFromTool(activeTool);
  if (!roomType || pendingRoomTiles.size === 0) {
    placementInfoEl.style.display = 'none';
    return;
  }
  const config = ROOM_CONFIG[roomType];
  const count = pendingRoomTiles.size;
  const cost = count * config.goldPerTile;
  const minMet = count >= config.minTiles;
  const canAfford = resourceManager.gold >= cost;

  placementInfoEl.style.display = 'block';
  placementInfoEl.innerHTML = `
    <span>${roomType.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</span>:
    <span>${count} tiles</span> |
    <span class="${canAfford ? 'placement-valid' : 'placement-invalid'}">${cost}g</span> |
    <span class="${minMet ? 'placement-valid' : 'placement-invalid'}">Min: ${config.minTiles}</span> |
    <span>Enter=confirm Esc=cancel</span>
  `;
}

// ── Event wiring ─────────────────────────────────────

// Tool selection
eventBus.subscribe(EVENTS.TOOL_SELECTED, (e) => {
  // Cancel any pending room placement if switching tools
  if (activeTool !== e.tool) {
    pendingRoomTiles.clear();
    updatePlacementInfo();
  }
  activeTool = e.tool;
});

// Speed toggle
eventBus.subscribe(EVENTS.SPEED_CHANGED, (e) => {
  gameLoop.setSpeed(e.speed);
});

// Mouse move — update hover tile + tooltip
eventBus.subscribe(EVENTS.INPUT_MOUSE_MOVE, (e) => {
  hoverTileX = e.tileX;
  hoverTileY = e.tileY;
  tooltip.show(e.screenX, e.screenY, e.worldX, e.worldY);
});

// Click handling
eventBus.subscribe(EVENTS.INPUT_CLICK, (e) => {
  // Minimap click first
  if (minimap.handleClick(e.screenX, e.screenY)) return;

  const roomType = getRoomTypeFromTool(activeTool);

  if (roomType) {
    // Room placement mode — toggle tile
    const key = `${e.tileX},${e.tileY}`;
    if (pendingRoomTiles.has(key)) {
      pendingRoomTiles.delete(key);
    } else if (isValidRoomTile(e.tileX, e.tileY)) {
      pendingRoomTiles.add(key);
    }
    updatePlacementInfo();
    return;
  }

  if (activeTool === 'dig') {
    // Dig mode
    const { tileX, tileY } = e;
    if (world.isDiggable(tileX, tileY)) {
      const neighbors = world.getNeighbors(tileX, tileY);
      const hasWalkableNeighbor = neighbors.some(n => world.isWalkable(n.x, n.y));
      if (hasWalkableNeighbor) {
        jobQueue.addDigJob(tileX, tileY);
        Pathfinder.clearCache();
      }
    }
  }
});

// Key handling for room placement confirm/cancel
eventBus.subscribe(EVENTS.INPUT_KEY_DOWN, (e) => {
  const roomType = getRoomTypeFromTool(activeTool);

  if (e.code === 'Enter' && roomType && pendingRoomTiles.size > 0) {
    const config = ROOM_CONFIG[roomType];
    // Re-validate all tiles (state may have changed since they were clicked)
    const tiles = [];
    for (const key of pendingRoomTiles) {
      const [x, y] = key.split(',').map(Number);
      if (isValidRoomTile(x, y)) {
        tiles.push({ x, y });
      }
    }

    // Validate min tiles
    if (tiles.length < config.minTiles) return;

    // Validate cost
    const cost = tiles.length * config.goldPerTile;
    if (!resourceManager.spendGold(cost)) return;

    // Place room
    roomManager.placeRoom(roomType, tiles);

    // If treasury, update gold cap
    if (roomType === ROOM_TYPES.TREASURY) {
      const totalTreasury = roomManager.getTotalTilesOfType(ROOM_TYPES.TREASURY);
      resourceManager.setTreasuryTileCount(totalTreasury);
    }

    pendingRoomTiles.clear();
    updatePlacementInfo();
  }

  if (e.code === 'Escape') {
    pendingRoomTiles.clear();
    updatePlacementInfo();
  }
});

// Gold from digging
eventBus.subscribe(EVENTS.TILE_DUG, (e) => {
  const wx = e.x * TILE_SIZE + TILE_SIZE / 2;
  const wy = e.y * TILE_SIZE + TILE_SIZE / 2;

  if (e.tileType === TILE_TYPES.GOLD_VEIN) {
    resourceManager.earnGold(RESOURCES.GOLD_VEIN_YIELD);
    particleSystem.burst(wx, wy, '#f0c040', 15, { speed: 100, life: 0.8, size: 3 });
  } else if (e.tileType === TILE_TYPES.GEM_SEAM) {
    if (e.goldAmount) {
      // Continuous mining yield (goldAmount = GEM_SEAM_GOLD_PER_SEC)
      resourceManager.earnGold(e.goldAmount);
    } else {
      // Initial dig completion — particles only
      particleSystem.burst(wx, wy, '#aa60e0', 12, { speed: 80, life: 0.6, size: 3 });
    }
  } else {
    particleSystem.burst(wx, wy, '#8a7050', 8, { speed: 60, life: 0.5, size: 2 });
  }
});

// Update treasury cap when rooms change
eventBus.subscribe(EVENTS.ROOM_REMOVED, (e) => {
  if (e.type === ROOM_TYPES.TREASURY) {
    const totalTreasury = roomManager.getTotalTilesOfType(ROOM_TYPES.TREASURY);
    resourceManager.setTreasuryTileCount(totalTreasury);
  }
});

window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// ── Game loop ────────────────────────────────────────
function update(dt) {
  inputManager.update(dt);
  entityManager.update(dt);
  particleSystem.update(dt);
  resourceManager.update(dt);
}

let lastRenderTime = performance.now();

function render(alpha) {
  const now = performance.now();
  const renderDt = (now - lastRenderTime) / 1000;
  lastRenderTime = now;

  const w = window.innerWidth;
  const h = window.innerHeight;
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = COLORS.BG;
  ctx.fillRect(0, 0, w, h);

  tileRenderer.render(alpha);
  entityRenderer.render(alpha);
  particleSystem.render();
  minimap.render();

  // Dig queue highlights
  for (const job of jobQueue.getAllDigJobs()) {
    const [sx, sy] = camera.worldToScreen(job.x * TILE_SIZE, job.y * TILE_SIZE);
    const size = TILE_SIZE * camera.zoom;
    ctx.fillStyle = job.assignedTo ? 'rgba(255, 200, 0, 0.2)' : 'rgba(255, 255, 0, 0.3)';
    ctx.fillRect(sx, sy, size, size);
  }

  // Room placement preview
  const roomType = getRoomTypeFromTool(activeTool);
  if (roomType) {
    const size = TILE_SIZE * camera.zoom;

    // Draw pending tiles (green)
    for (const key of pendingRoomTiles) {
      const [tx, ty] = key.split(',').map(Number);
      const [sx, sy] = camera.worldToScreen(tx * TILE_SIZE, ty * TILE_SIZE);
      ctx.fillStyle = 'rgba(80, 200, 80, 0.3)';
      ctx.fillRect(sx, sy, size, size);
      ctx.strokeStyle = 'rgba(80, 200, 80, 0.6)';
      ctx.lineWidth = 1;
      ctx.strokeRect(sx, sy, size, size);
    }

    // Draw hover tile (green if valid, red if invalid)
    if (hoverTileX >= 0 && hoverTileY >= 0) {
      const key = `${hoverTileX},${hoverTileY}`;
      if (!pendingRoomTiles.has(key)) {
        const valid = isValidRoomTile(hoverTileX, hoverTileY);
        const [sx, sy] = camera.worldToScreen(hoverTileX * TILE_SIZE, hoverTileY * TILE_SIZE);
        ctx.fillStyle = valid ? 'rgba(80, 200, 80, 0.2)' : 'rgba(200, 40, 40, 0.2)';
        ctx.fillRect(sx, sy, size, size);
        ctx.strokeStyle = valid ? 'rgba(80, 200, 80, 0.4)' : 'rgba(200, 40, 40, 0.4)';
        ctx.lineWidth = 1;
        ctx.strokeRect(sx, sy, size, size);
      }
    }
  }

  // HUD update (tween gold, imp count)
  hud.update(renderDt);

  fpsEl.textContent = `FPS: ${gameLoop.fps}`;
}

const gameLoop = new GameLoop(update, render);
gameLoop.start();
