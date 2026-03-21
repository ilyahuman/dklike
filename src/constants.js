/**
 * Central source of truth for all game constants.
 * Zero magic numbers elsewhere — every tuning value lives here.
 */

// ── Map ──────────────────────────────────────────────
export const TILE_SIZE = 32;
export const MAP_WIDTH = 80;
export const MAP_HEIGHT = 60;

// ── Tile Types ───────────────────────────────────────
export const TILE_TYPES = Object.freeze({
  ROCK: 'rock',
  DIRT: 'dirt',
  UNCLAIMED_FLOOR: 'unclaimed_floor',
  CLAIMED_FLOOR: 'claimed_floor',
  GOLD_VEIN: 'gold_vein',
  GEM_SEAM: 'gem_seam',
  LAVA: 'lava',
  WATER: 'water',
});

export const WALKABLE_TILES = Object.freeze([
  TILE_TYPES.UNCLAIMED_FLOOR,
  TILE_TYPES.CLAIMED_FLOOR,
]);

export const DIGGABLE_TILES = Object.freeze([
  TILE_TYPES.DIRT,
  TILE_TYPES.GOLD_VEIN,
  TILE_TYPES.GEM_SEAM,
]);

// ── Map Generation ───────────────────────────────────
export const MAP_GEN = Object.freeze({
  GOLD_VEIN_MIN: 8,
  GOLD_VEIN_MAX: 12,
  GEM_SEAM_MIN: 3,
  GEM_SEAM_MAX: 5,
  LAVA_POOL_MIN: 2,
  LAVA_POOL_MAX: 3,
  WATER_CHANNEL_MIN: 1,
  WATER_CHANNEL_MAX: 2,
  DUNGEON_HEART_SIZE: 3,
});

// ── Entity Types ─────────────────────────────────────
export const ENTITY_TYPES = Object.freeze({
  IMP: 'imp',
  TROLL: 'troll',
  DARK_MISTRESS: 'dark_mistress',
  KNIGHT: 'knight',
  THIEF: 'thief',
  WIZARD: 'wizard',
  DOOR: 'door',
});

// ── Creature States ──────────────────────────────────
export const CREATURE_STATES = Object.freeze({
  IDLE: 'idle',
  MOVING: 'moving',
  DIGGING: 'digging',
  CARRYING: 'carrying',
  EATING: 'eating',
  SLEEPING: 'sleeping',
  FLEEING: 'fleeing',
  ATTACKING: 'attacking',
  TRAINING: 'training',
});

// ── Hero Types ───────────────────────────────────────
export const HERO_TYPES = Object.freeze({
  KNIGHT: 'knight',
  THIEF: 'thief',
  WIZARD: 'wizard',
});

// ── Room Types ───────────────────────────────────────
export const ROOM_TYPES = Object.freeze({
  DUNGEON_HEART: 'dungeon_heart',
  LAIR: 'lair',
  HATCHERY: 'hatchery',
  TREASURY: 'treasury',
  TRAINING_ROOM: 'training_room',
});

// ── Room Costs & Requirements ────────────────────────
export const ROOM_CONFIG = Object.freeze({
  [ROOM_TYPES.DUNGEON_HEART]: { goldPerTile: 0, minTiles: 1, manaPerSec: 2 },
  [ROOM_TYPES.LAIR]: { goldPerTile: 50, minTiles: 4, energyPerSec: 10 },
  [ROOM_TYPES.HATCHERY]: { goldPerTile: 60, minTiles: 4, hungerPerSec: -1 },
  [ROOM_TYPES.TREASURY]: { goldPerTile: 40, minTiles: 4, goldStoragePerTile: 500 },
  [ROOM_TYPES.TRAINING_ROOM]: { goldPerTile: 80, minTiles: 6, xpPerSec: 1 },
});

// ── Spell Types ──────────────────────────────────────
export const SPELL_TYPES = Object.freeze({
  CREATE_IMP: 'create_imp',
  LIGHTNING_STRIKE: 'lightning_strike',
  POSSESS_CREATURE: 'possess_creature',
});

export const SPELL_CONFIG = Object.freeze({
  [SPELL_TYPES.CREATE_IMP]: { manaCost: 200, castTime: 0.5 },
  [SPELL_TYPES.LIGHTNING_STRIKE]: { manaCost: 150, aoeRadius: 3, damage: 80, shakeDuration: 0.3, shakeMagnitude: 4 },
  [SPELL_TYPES.POSSESS_CREATURE]: { manaCost: 100 },
});

// ── Resources ────────────────────────────────────────
export const RESOURCES = Object.freeze({
  GOLD_BASE_CAP: 1000,
  GOLD_PER_TREASURY_TILE: 500,
  MANA_CAP: 500,
  MANA_REGEN_PER_SEC: 2,
  GOLD_VEIN_YIELD: 200,
  GEM_SEAM_GOLD_PER_SEC: 5,
  STARTING_GOLD: 500,
  STARTING_MANA: 200,
});

// ── Creature Stats ───────────────────────────────────
export const IMP_STATS = Object.freeze({
  hp: 30,
  speed: 80,
  digTime: 3,
  hungerThreshold: 30,
  energyThreshold: 20,
  fleeHealthThreshold: 20,
  maxHunger: 100,
  maxEnergy: 100,
  maxHappiness: 100,
});

export const TROLL_STATS = Object.freeze({
  hp: 120,
  speed: 40,
  damage: 15,
  attackRange: 1.2,
  attackCooldown: 1.0,
  attractionRoom: ROOM_TYPES.HATCHERY,
  attractionMinTiles: 6,
  maxCount: 3,
});

export const DARK_MISTRESS_STATS = Object.freeze({
  hp: 80,
  speed: 100,
  damage: 10,
  attackRange: 1.5,
  attackCooldown: 0.8,
  maxTargets: 2,
  slowDebuffDuration: 3,
  slowDebuffFactor: 0.5,
  attractionRoom: ROOM_TYPES.TRAINING_ROOM,
  attractionMinTiles: 6,
  maxCount: 3,
});

// ── Hero Stats ───────────────────────────────────────
export const KNIGHT_STATS = Object.freeze({
  hp: 150,
  speed: 40,
  damage: 12,
  attackRange: 1.2,
  attackCooldown: 1.0,
  goldDrop: 50,
});

export const THIEF_STATS = Object.freeze({
  hp: 60,
  speed: 120,
  damage: 8,
  attackRange: 1.0,
  attackCooldown: 0.6,
  goldDrop: 30,
});

export const WIZARD_STATS = Object.freeze({
  hp: 80,
  speed: 70,
  damage: 18,
  attackRange: 3.0,
  attackCooldown: 1.5,
  goldDrop: 75,
});

// ── Leveling ─────────────────────────────────────────
export const LEVEL_THRESHOLDS = Object.freeze([0, 100, 250, 500, 900]);
export const LEVEL_HP_BONUS = 0.10;
export const LEVEL_DAMAGE_BONUS = 0.10;
export const LEVEL_SPEED_BONUS = 0.05;
export const MAX_LEVEL = 5;

// ── Wave System ──────────────────────────────────────
export const WAVE = Object.freeze({
  INTERVAL_SEC: 90,
  KNIGHT_PER_WAVE: 1,
  THIEF_PER_WAVE: 0.5,
  WIZARD_PER_WAVE: 0.3,
  REPATH_INTERVAL_SEC: 3,
  TOTAL_WAVES: 10,
});

// ── Combat ───────────────────────────────────────────
export const COMBAT_TICK_MS = 200;
export const DOOR_HP = 200;
export const DOOR_COST = 100;
export const HERO_DOOR_DAMAGE_PER_SEC = 10;

// ── Creature Spawning ────────────────────────────────
export const SPAWN_CHECK_INTERVAL_SEC = 30;

// ── Dungeon Heart ────────────────────────────────────
export const DUNGEON_HEART_HP = 500;

// ── Game Loop ────────────────────────────────────────
export const TARGET_UPS = 60;
export const TIMESTEP_MS = 1000 / TARGET_UPS;
export const TIMESTEP_SEC = 1 / TARGET_UPS;
export const MAX_FRAME_SKIP = 5;

// ── Camera ───────────────────────────────────────────
export const CAMERA = Object.freeze({
  PAN_SPEED: 400,
  ZOOM_MIN: 0.5,
  ZOOM_MAX: 2.0,
  ZOOM_STEP: 0.1,
});

// ── Win/Lose ─────────────────────────────────────────
export const WIN_GOLD_THRESHOLD = 5000;
export const WIN_WAVE_THRESHOLD = 10;

// ── Particles ────────────────────────────────────────
export const PARTICLE_POOL_SIZE = 500;

// ── UI ───────────────────────────────────────────────
export const MINIMAP_WIDTH = 120;
export const MINIMAP_HEIGHT = 90;

// ── Colors (dark fantasy palette) ────────────────────
export const COLORS = Object.freeze({
  BG: '#0a0a0a',
  ROCK: '#2a2a2e',
  DIRT: '#5a4633',
  UNCLAIMED_FLOOR: '#4a4a4e',
  CLAIMED_FLOOR: '#5a5a60',
  GOLD_VEIN: '#b8962e',
  GEM_SEAM: '#6a2ea0',
  LAVA: '#c04020',
  WATER: '#2040a0',
  UI_TEXT: '#c0b090',
  UI_GOLD: '#f0c040',
  UI_MANA: '#4080f0',
  UI_HEALTH_BAR: '#c02020',
  UI_HEALTH_BG: '#2a0808',
  MINIMAP_CAMERA: 'rgba(255, 255, 255, 0.4)',
});

// ── EventBus Events ──────────────────────────────────
export const EVENTS = Object.freeze({
  TILE_CHANGED: 'tile:changed',
  TILE_DIG_QUEUED: 'tile:dig_queued',
  TILE_DUG: 'tile:dug',
  ENTITY_SPAWNED: 'entity:spawned',
  ENTITY_DIED: 'entity:died',
  ENTITY_DAMAGED: 'entity:damaged',
  RESOURCES_CHANGED: 'resources:changed',
  ROOM_PLACED: 'room:placed',
  ROOM_REMOVED: 'room:removed',
  JOB_UPDATED: 'job:updated',
  WAVE_STARTED: 'wave:started',
  WAVE_COMPLETED: 'wave:completed',
  SPELL_CAST: 'spell:cast',
  GAME_STATE_CHANGED: 'game:state_changed',
  GAME_OVER: 'game:over',
  GAME_VICTORY: 'game:victory',
  INPUT_CLICK: 'input:click',
  INPUT_RIGHT_CLICK: 'input:right_click',
  INPUT_KEY_DOWN: 'input:key_down',
  INPUT_KEY_UP: 'input:key_up',
  INPUT_MOUSE_MOVE: 'input:mouse_move',
  INPUT_SCROLL: 'input:scroll',
  INPUT_DRAG: 'input:drag',
  INPUT_MOUSE_UP: 'input:mouse_up',
  CAMERA_MOVED: 'camera:moved',
  SPEED_CHANGED: 'speed:changed',
  TOOL_SELECTED: 'tool:selected',
  POSSESS_START: 'possess:start',
  POSSESS_END: 'possess:end',
});
