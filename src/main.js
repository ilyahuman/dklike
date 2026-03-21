import { EventBus } from './core/EventBus.js';
import { GameLoop } from './core/GameLoop.js';
import { GameStateManager, GAME_STATES } from './core/GameStateManager.js';
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
import { MenuScreen } from './ui/MenuScreen.js';
import { CombatSystem } from './systems/CombatSystem.js';
import { CreatureSpawner } from './systems/CreatureSpawner.js';
import { WaveManager } from './systems/WaveManager.js';
import { FloatingText } from './rendering/FloatingText.js';
import { SpellSystem } from './systems/SpellSystem.js';
import { Door } from './entities/Door.js';
import {
  COLORS, EVENTS, TILE_SIZE, TILE_TYPES, ROOM_TYPES,
  ROOM_CONFIG, RESOURCES, ENTITY_TYPES,
  SPELL_TYPES, SPELL_CONFIG, DOOR_COST,
  WIN_GOLD_THRESHOLD, WIN_WAVE_THRESHOLD, DUNGEON_HEART_HP,
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

// Phase 4 systems
const combatSystem = new CombatSystem(entityManager, eventBus);
const creatureSpawner = new CreatureSpawner(world, entityManager, eventBus, roomManager);
const waveManager = new WaveManager(world, entityManager, eventBus, roomManager);
const floatingText = new FloatingText(ctx, camera);

// Phase 5 systems
const spellSystem = new SpellSystem(world, entityManager, eventBus, resourceManager, roomManager, jobQueue);

// Phase 6 systems
const gameStateManager = new GameStateManager(eventBus);
const menuScreen = new MenuScreen(hudOverlay, eventBus);

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
  if (gameStateManager.state === GAME_STATES.PLAYING) {
    tooltip.show(e.screenX, e.screenY, e.worldX, e.worldY);
  } else {
    tooltip.hide();
  }
});

// Click handling
eventBus.subscribe(EVENTS.INPUT_CLICK, (e) => {
  // Possess mode: click = attack
  if (spellSystem.isPossessing) {
    spellSystem.possessedAttack();
    return;
  }

  // Minimap click first
  if (minimap.handleClick(e.screenX, e.screenY)) return;

  // Spell: Create Imp
  if (activeTool === 'spell:create_imp') {
    spellSystem.castCreateImp();
    return;
  }

  // Spell: Lightning Strike
  if (activeTool === 'spell:lightning') {
    spellSystem.castLightningStrike(e.worldX, e.worldY);
    return;
  }

  // Spell: Possess Creature
  if (activeTool === 'spell:possess') {
    const entities = entityManager.getEntitiesInRadius(e.worldX, e.worldY, TILE_SIZE / 2);
    const creature = entities.find(ent => ent.team === 'player' && ent.type !== ENTITY_TYPES.IMP && ent.type !== ENTITY_TYPES.DOOR);
    if (creature) {
      spellSystem.castPossess(creature.id);
      camera.lockTo(creature);
    }
    return;
  }

  // Door placement
  if (activeTool === 'door') {
    if (Door.isValidDoorPlacement(world, e.tileX, e.tileY)) {
      const existing = entityManager.getAll().find(ent =>
        ent.type === ENTITY_TYPES.DOOR && ent.tileX === e.tileX && ent.tileY === e.tileY
      );
      if (!existing && resourceManager.spendGold(DOOR_COST)) {
        const door = new Door(e.tileX, e.tileY, entityManager);
        entityManager.add(door);
        Pathfinder.clearCache();
      }
    }
    return;
  }

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

// Key handling for room placement confirm/cancel + possess ESC
eventBus.subscribe(EVENTS.INPUT_KEY_DOWN, (e) => {
  // Pause toggle (P key or Escape, only when NOT possessing)
  if (!spellSystem.isPossessing && (e.code === 'KeyP' || e.code === 'Escape')) {
    if (gameStateManager.state === 'playing') {
      gameStateManager.pause();
      gameLoop.pause();
      menuScreen.showPause();
      return;
    } else if (gameStateManager.state === 'paused') {
      gameStateManager.resume();
      gameLoop.resume();
      menuScreen.hidePause();
      return;
    }
  }

  // Possess mode: ESC exits
  if (e.code === 'Escape' && spellSystem.isPossessing) {
    spellSystem.unpossess();
    camera.unlock();
    return;
  }

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

// Floating damage text
eventBus.subscribe(EVENTS.ENTITY_DAMAGED, (e) => {
  floatingText.add(e.x, e.y - TILE_SIZE / 2, `-${e.damage}`, '#ff4040');
});

// Entity death — particles + gold drop
eventBus.subscribe(EVENTS.ENTITY_DIED, (e) => {
  const color = e.team === 'enemy' ? '#f0f0a0' : '#a04040';
  particleSystem.burst(e.x, e.y, color, 12, { speed: 80, life: 0.6, size: 2 });
  if (e.goldDrop > 0) {
    resourceManager.earnGold(e.goldDrop);
    floatingText.add(e.x, e.y - TILE_SIZE, `+${e.goldDrop}g`, '#f0c040');
  }
});

// Wave started — screen flash
let waveFlashTimer = 0;
eventBus.subscribe(EVENTS.WAVE_STARTED, () => {
  waveFlashTimer = 2.0;
});

// Creature spawned — floating text + particles
eventBus.subscribe(EVENTS.ENTITY_SPAWNED, (e) => {
  floatingText.add(e.x, e.y - TILE_SIZE, 'Creature attracted!', '#80ff80');
  particleSystem.burst(e.x, e.y, '#80ff80', 10, { speed: 60, life: 0.5, size: 2 });
});

// ── Phase 5 VFX ──────────────────────────────────────
let screenShakeTimer = 0;
let screenShakeMagnitude = 0;
let lightningFlashTimer = 0;
let possessDeathFlashTimer = 0;
let gameOverFlashTimer = 0;

// ── Menu events ───────────────────────────────────────
eventBus.subscribe('menu:start', () => {
  gameStateManager.startGame();
  menuScreen.hideAll();
  gameLoop.resume();
});

eventBus.subscribe('menu:resume', () => {
  gameStateManager.resume();
  menuScreen.hidePause();
  gameLoop.resume();
});

eventBus.subscribe('menu:restart', () => {
  // Full restart — reload page for clean state (simplest way to guarantee no ghost state)
  window.location.reload();
});

eventBus.subscribe('menu:quit', () => {
  // Quit returns to main menu — also reload for clean state
  window.location.reload();
});

// Spell cast VFX
eventBus.subscribe(EVENTS.SPELL_CAST, (e) => {
  if (e.spell === SPELL_TYPES.LIGHTNING_STRIKE) {
    screenShakeTimer = SPELL_CONFIG[SPELL_TYPES.LIGHTNING_STRIKE].shakeDuration;
    screenShakeMagnitude = SPELL_CONFIG[SPELL_TYPES.LIGHTNING_STRIKE].shakeMagnitude;
    lightningFlashTimer = 0.1;
    particleSystem.burst(e.x, e.y, '#ffffff', 20, { speed: 120, life: 0.5, size: 3 });
    particleSystem.burst(e.x, e.y, '#ffff80', 15, { speed: 80, life: 0.4, size: 2 });
  }
  if (e.spell === SPELL_TYPES.CREATE_IMP) {
    particleSystem.burst(e.x, e.y, '#8060ff', 12, { speed: 40, life: 0.5, size: 3 });
  }
});

// Possess death: camera shake + red flash
eventBus.subscribe(EVENTS.POSSESS_END, (e) => {
  if (e.reason === 'death') {
    screenShakeTimer = 0.5;
    screenShakeMagnitude = 6;
    possessDeathFlashTimer = 0.5;
  }
  camera.unlock();
});

// Door debris on destruction
eventBus.subscribe(EVENTS.ENTITY_DIED, (e) => {
  if (e.type === ENTITY_TYPES.DOOR) {
    particleSystem.burst(e.x, e.y, '#6a4a2a', 15, { speed: 80, life: 0.6, size: 3 });
    particleSystem.burst(e.x, e.y, '#4a3a1a', 10, { speed: 60, life: 0.4, size: 2 });
  }
});

// Game over / victory screens
eventBus.subscribe(EVENTS.GAME_OVER, (e) => {
  // Dramatic effects: screen shake + red flash
  screenShakeTimer = 1.0;
  screenShakeMagnitude = 6;
  gameOverFlashTimer = 1.0; // 1s red flash overlay
  // After 1 second of slow-motion, fully pause and show screen
  setTimeout(() => {
    gameLoop.pause();
    gameLoop.setSpeed(1); // Reset speed for when they restart
    menuScreen.showGameOver({ ...e.stats, elapsedTime: e.elapsedTime });
  }, 1000);
});

eventBus.subscribe(EVENTS.GAME_VICTORY, (e) => {
  gameLoop.pause();
  menuScreen.showVictory({ ...e.stats, elapsedTime: e.elapsedTime });
});

// Track stats for game session
eventBus.subscribe(EVENTS.ENTITY_DIED, (e) => {
  if (e.team === 'enemy') {
    gameStateManager.addStat('heroesKilled', 1);
  }
  if (e.team === 'player' && e.type !== ENTITY_TYPES.DOOR) {
    gameStateManager.addStat('creaturesLost', 1);
  }
});

// Track gold earned via RESOURCES_CHANGED delta
let lastGold = RESOURCES.STARTING_GOLD;
eventBus.subscribe(EVENTS.RESOURCES_CHANGED, (data) => {
  if (data.gold > lastGold) {
    gameStateManager.addStat('goldEarned', data.gold - lastGold);
  }
  lastGold = data.gold;
});

// Track waves survived + check win condition on wave completion
eventBus.subscribe(EVENTS.WAVE_COMPLETED, (e) => {
  gameStateManager.addStat('wavesSurvived', 1);
  // Win condition: survived 10 waves AND have 5000+ gold
  if (gameStateManager.getStat('wavesSurvived') >= WIN_WAVE_THRESHOLD
      && resourceManager.gold >= WIN_GOLD_THRESHOLD
      && gameStateManager.state === 'playing') {
    gameStateManager.victory();
  }
});

window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// ── Game loop ────────────────────────────────────────
function update(dt) {
  // Possess mode: WASD moves creature, skip camera pan
  if (spellSystem.isPossessing) {
    let dx = 0, dy = 0;
    if (inputManager.isKeyDown('KeyW') || inputManager.isKeyDown('ArrowUp')) dy = -1;
    if (inputManager.isKeyDown('KeyS') || inputManager.isKeyDown('ArrowDown')) dy = 1;
    if (inputManager.isKeyDown('KeyA') || inputManager.isKeyDown('ArrowLeft')) dx = -1;
    if (inputManager.isKeyDown('KeyD') || inputManager.isKeyDown('ArrowRight')) dx = 1;
    if (dx !== 0 || dy !== 0) {
      spellSystem.movePossessed(dx, dy, dt);
    }
  } else {
    inputManager.update(dt);
  }

  entityManager.update(dt);
  particleSystem.update(dt);
  resourceManager.update(dt);
  combatSystem.update(dt);
  creatureSpawner.update(dt);
  waveManager.update(dt);
  floatingText.update(dt);
  spellSystem.update(dt);

  // Check if any hero has reached the Dungeon Heart
  const heartCenterX = heartCx * TILE_SIZE + TILE_SIZE / 2;
  const heartCenterY = heartCy * TILE_SIZE + TILE_SIZE / 2;
  const heroesAtHeart = entityManager.getEntitiesInRadius(heartCenterX, heartCenterY, TILE_SIZE * 2);
  for (const hero of heroesAtHeart) {
    if (hero.team === 'enemy' && hero.alive) {
      resourceManager.damageHeart(hero.damage * dt);
    }
  }

  // Track elapsed time
  gameStateManager.updateTime(dt);

  // Lose condition: Dungeon Heart destroyed
  if (resourceManager.isHeartDestroyed && gameStateManager.state === 'playing') {
    gameStateManager.gameOver();
    // Slow-motion for 1 second, then pause (see GAME_OVER event handler)
    gameLoop.setSpeed(0.2);
    return;
  }
}

let lastRenderTime = performance.now();

function render(alpha) {
  const now = performance.now();
  const renderDt = (now - lastRenderTime) / 1000;
  lastRenderTime = now;

  // Camera lock tracking for possess mode
  if (camera.isLocked) {
    camera.updateLock();
    camera.clampToWorld();
  }

  const w = window.innerWidth;
  const h = window.innerHeight;
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = COLORS.BG;
  ctx.fillRect(0, 0, w, h);

  // Screen shake (apply before all rendering)
  let shaking = screenShakeTimer > 0;
  if (shaking) {
    screenShakeTimer -= renderDt;
    const shakeX = (Math.random() - 0.5) * screenShakeMagnitude * 2;
    const shakeY = (Math.random() - 0.5) * screenShakeMagnitude * 2;
    ctx.save();
    ctx.translate(shakeX, shakeY);
  }

  tileRenderer.render(alpha);
  entityRenderer.render(alpha);
  particleSystem.render();
  floatingText.render();
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

  // Create Imp magic circle animation
  const castAnim = spellSystem.getCastAnimState();
  if (castAnim.timer > 0 && castAnim.position) {
    const [cx, cy] = camera.worldToScreen(castAnim.position.x, castAnim.position.y);
    const radius = TILE_SIZE * camera.zoom * 1.5;
    const progress = 1 - (castAnim.timer / SPELL_CONFIG[SPELL_TYPES.CREATE_IMP].castTime);
    ctx.save();
    ctx.globalAlpha = 1 - progress;
    ctx.strokeStyle = '#8060ff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, radius * progress, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx, cy, radius * 0.6 * progress, progress * Math.PI * 4, progress * Math.PI * 4 + Math.PI * 1.5);
    ctx.stroke();
    ctx.restore();
  }

  // Red cursor feedback for Lightning targeting friendlies
  if (activeTool === 'spell:lightning' && hoverTileX >= 0 && hoverTileY >= 0) {
    const hoverWX = hoverTileX * TILE_SIZE + TILE_SIZE / 2;
    const hoverWY = hoverTileY * TILE_SIZE + TILE_SIZE / 2;
    const nearbyEnts = entityManager.getEntitiesInRadius(hoverWX, hoverWY, TILE_SIZE);
    const onlyFriendly = nearbyEnts.length > 0 && nearbyEnts.every(e => e.team === 'player');
    if (onlyFriendly) {
      const [hsx, hsy] = camera.worldToScreen(hoverTileX * TILE_SIZE, hoverTileY * TILE_SIZE);
      const sz = TILE_SIZE * camera.zoom;
      ctx.fillStyle = 'rgba(200, 40, 40, 0.3)';
      ctx.fillRect(hsx, hsy, sz, sz);
      ctx.strokeStyle = 'rgba(200, 40, 40, 0.6)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(hsx + sz * 0.2, hsy + sz * 0.2);
      ctx.lineTo(hsx + sz * 0.8, hsy + sz * 0.8);
      ctx.moveTo(hsx + sz * 0.8, hsy + sz * 0.2);
      ctx.lineTo(hsx + sz * 0.2, hsy + sz * 0.8);
      ctx.stroke();
    }
  }

  // End screen shake
  if (shaking) {
    ctx.restore();
  }

  // HUD update (tween gold, imp count)
  hud.update(renderDt);

  // Wave flash overlay
  if (waveFlashTimer > 0) {
    waveFlashTimer -= renderDt;
    const flashAlpha = Math.min(1, waveFlashTimer / 2) * 0.3;
    ctx.fillStyle = `rgba(255, 0, 0, ${flashAlpha})`;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 48px MedievalSharp, cursive';
    ctx.textAlign = 'center';
    ctx.globalAlpha = Math.min(1, waveFlashTimer);
    ctx.fillText('INTRUDERS!', w / 2, h / 2);
    ctx.globalAlpha = 1;
    ctx.textAlign = 'start';
  }

  // Lightning flash overlay (white)
  if (lightningFlashTimer > 0) {
    lightningFlashTimer -= renderDt;
    ctx.fillStyle = `rgba(255, 255, 255, ${Math.min(1, lightningFlashTimer / 0.1) * 0.5})`;
    ctx.fillRect(0, 0, w, h);
  }

  // Possess death flash overlay (red)
  if (possessDeathFlashTimer > 0) {
    possessDeathFlashTimer -= renderDt;
    ctx.fillStyle = `rgba(255, 0, 0, ${Math.min(1, possessDeathFlashTimer / 0.5) * 0.4})`;
    ctx.fillRect(0, 0, w, h);
  }

  // Game over red flash overlay
  if (gameOverFlashTimer > 0) {
    gameOverFlashTimer -= renderDt;
    ctx.fillStyle = `rgba(200, 0, 0, ${Math.min(1, gameOverFlashTimer) * 0.5})`;
    ctx.fillRect(0, 0, w, h);
  }

  // Update HUD wave timer
  hud.setWaveTimer(`${waveManager.countdown}s`);

  fpsEl.textContent = `FPS: ${gameLoop.fps}`;
}

const gameLoop = new GameLoop(update, render);
gameLoop.start();
gameLoop.pause(); // Start paused at menu
menuScreen.showMenu();
