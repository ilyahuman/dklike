# 2D Dungeon Keeper — Web Game Design Spec

## Overview

A browser-based 2D dungeon management game inspired by Dungeon Keeper. The player digs out underground rooms, attracts creatures, and defends against waves of invading heroes. All visuals are procedurally drawn on Canvas — zero external image assets. Dark fantasy aesthetic throughout.

**Win condition:** Survive 10 waves AND accumulate 5000+ gold.
**Lose condition:** Dungeon Heart HP reaches 0.

---

## Tech Stack

**Vanilla JavaScript (ES Modules) + Vite**

- **Runtime:** Modern browser, Canvas 2D API
- **Build:** Vite (single dev dependency) — HMR, ES module bundling, production minification
- **Fonts:** MedievalSharp (Google Fonts) for display/HUD, Inter for tooltips/body
- **No frameworks, no game engines, no external sprite assets**

**Justification:** 20+ game classes doing procedural Canvas drawing and game logic. TypeScript adds friction for Canvas 2D code without proportional safety. Vite provides HMR and production builds with near-zero config. The constants.js enum pattern provides sufficient type structure.

---

## Project Structure

```
dklike/
├── index.html                  # Entry point, canvas + HUD overlay
├── vite.config.js              # Vite config (minimal)
├── package.json
├── src/
│   ├── main.js                 # Bootstrap: init systems, start game loop
│   ├── constants.js            # ALL tuning values, enums, costs, stats
│   │
│   ├── core/
│   │   ├── GameLoop.js         # Fixed-timestep update (60 UPS) + interpolated render
│   │   ├── EventBus.js         # Pub/sub for all cross-system communication
│   │   ├── GameStateManager.js # MENU / PLAYING / PAUSED / GAME_OVER / VICTORY
│   │   └── ObjectPool.js       # Generic pre-allocated pool for particles, text, etc.
│   │
│   ├── world/
│   │   ├── World.js            # 2D tile array, getTile/setTile/neighbors/walkable
│   │   ├── MapGenerator.js     # Seeded procedural map generation
│   │   └── Pathfinder.js       # A* with caching, diagonal (no corner-cutting)
│   │
│   ├── entities/
│   │   ├── Entity.js           # Base: id, position, velocity, health, state
│   │   ├── EntityManager.js    # Update loop, spatial queries (spatial hash)
│   │   ├── Imp.js              # Worker AI: dig, carry, eat, sleep, flee
│   │   ├── Troll.js            # Tank creature: high HP, slow, heavy melee
│   │   ├── DarkMistress.js     # Fast creature: whip, multi-target, slow debuff
│   │   ├── Knight.js           # Hero: melee tank, attacks doors + creatures
│   │   ├── Thief.js            # Hero: fast, bypasses combat, targets Treasury
│   │   ├── Wizard.js           # Hero: ranged, kites melee attackers
│   │   └── Door.js             # Placeable barrier: 200 HP, blocks heroes
│   │
│   ├── systems/
│   │   ├── JobQueue.js         # Dig/carry job assignment, one imp per job
│   │   ├── ResourceManager.js  # Gold, mana, imp count tracking
│   │   ├── RoomManager.js      # Room placement, tile sets, room queries
│   │   ├── CombatSystem.js     # Tick-based (200ms): targeting, damage, debuffs, death
│   │   ├── CreatureSpawner.js  # Room-condition checks → spawn creatures
│   │   ├── WaveManager.js      # Timed hero wave spawning + escalation
│   │   └── SpellSystem.js      # Spell selection, mana cost, targeting, effects
│   │
│   ├── input/
│   │   └── InputManager.js     # Mouse + keyboard capture → EventBus events
│   │
│   ├── rendering/
│   │   ├── Camera.js           # Pan (WASD, middle-mouse), zoom (scroll), clamping
│   │   ├── TileRenderer.js     # Viewport-culled tile drawing, procedural tile art
│   │   ├── EntityRenderer.js   # Procedural creature/hero sprites, animations
│   │   ├── ParticleSystem.js   # Pooled particles: gold burst, debris, sparks
│   │   ├── Minimap.js          # 120×90px overlay, clickable pan
│   │   └── ScreenEffects.js    # Screen shake, flash, vignette, slow-motion
│   │
│   └── ui/
│       ├── HUD.js              # Top bar: gold, mana bar, imp count, wave timer
│       ├── Toolbar.js          # Bottom bar: room/spell/door tools, speed toggle, hotkeys
│       ├── Tooltip.js          # Hover info: tile/room/creature stats
│       └── MenuScreens.js      # Main menu, pause overlay, game over, victory
│
├── docs/
│   └── superpowers/
│       └── specs/
│           └── 2026-03-20-dungeon-keeper-design.md  # This file
│
└── CLAUDE.md
```

---

## Architecture

### Core Principles

1. **Strict separation:** Game Logic / Rendering / Input / UI never mixed
2. **EventBus only:** Systems never import each other — all cross-system communication via EventBus
3. **Serializable state:** Game state is plain objects/arrays — no circular refs, no DOM refs in state
4. **Read-only rendering:** Render path reads state, never mutates it
5. **Single source of truth:** Each piece of data lives in exactly one system
6. **Constants centralized:** All tuning values in `constants.js` — zero magic numbers elsewhere

### Data Flow

```
InputManager → EventBus → Game Systems → State Changes → EventBus → Renderers
                              ↑                                         ↓
                         GameLoop.update(dt)                    GameLoop.render(interp)
```

- `GameLoop` drives fixed-timestep updates at 60 UPS with interpolated rendering
- `InputManager` converts raw DOM events to world-space coordinates via Camera, publishes to EventBus
- Game systems (JobQueue, ResourceManager, RoomManager, CombatSystem, etc.) subscribe to events, update state
- Renderers subscribe to state-change events or read state directly each frame
- HUD/Toolbar/Tooltip are HTML overlay elements, not canvas-drawn

### Game Loop

Fixed timestep (16.67ms) with accumulator pattern. Render interpolates between states for smooth visuals at any refresh rate. `setSpeed(multiplier)` scales the timestep for 2× speed mode.

```
while (accumulator >= timestep):
    update(timestep)
    accumulator -= timestep
render(accumulator / timestep)  // interpolation alpha
```

---

## Game Mechanics

### Map Generation (Seeded)

- Solid rock border (impassable)
- Interior: mostly diggable dirt
- Center: pre-cleared 3×3 Dungeon Heart room (claimed floor)
- Scattered resources: 8–12 gold veins, 3–5 gem seams
- Hazards: 2–3 lava pools, 1–2 water channels
- Same seed = same map (reproducible)

### Tile Types

| Type | Walkable | Diggable | Notes |
|------|----------|----------|-------|
| ROCK | No | No | Border/impassable |
| DIRT | No | Yes | Main dig target |
| UNCLAIMED_FLOOR | Yes | No | Freshly dug, unowned |
| CLAIMED_FLOOR | Yes | No | Player territory |
| GOLD_VEIN | No | Yes | Yields gold when dug |
| GEM_SEAM | No | Yes | Yields gems/gold, infinite |
| LAVA | No | No | Hazard, animated shimmer |
| WATER | No | No | Hazard, animated ripple |

### Rooms

| Room | Gold/tile | Min tiles | Effect |
|------|-----------|-----------|--------|
| Dungeon Heart | Pre-placed | 1 | +2 mana/sec. Game over if destroyed. |
| Lair | 50 | 4 | Creatures sleep here. +10 energy/sec/creature. |
| Hatchery | 60 | 4 | Creatures eat here. -1 hunger/sec/creature nearby. |
| Treasury | 40 | 4 | Each tile stores 500 gold. Base cap: 1000. |
| Training Room | 80 | 6 | Creatures gain 1 XP/sec while training. |

**Placement flow:** Select room from toolbar → paint mode (cursor changes) → hover shows green/red validity → drag to paint tiles → live cost preview → Enter to confirm / Escape to cancel.

### Digging

- Click a diggable tile adjacent to claimed floor → queues dig job
- Queued tiles show yellow highlight
- Imp walks to tile, plays 3-stage crack animation (33%/66%/100%)
- Tile converts to unclaimed floor → Imp claims adjacent floor tiles
- Gold veins produce gold + particle burst when dug

### Creatures

**Imp** (worker, summoned via spell):
- States: IDLE, MOVING, DIGGING, CARRYING, EATING, SLEEPING, FLEEING
- Needs: hunger (0–100), energy (0–100), happiness (0–100)
- AI priority: dig job (if energy > 20) → eat (if hunger < 30) → sleep (if energy < 20) → flee (if health < 20) → idle wander

**Troll** (attracted by Hatchery ≥ 6 tiles):
- HP: 120, slow speed, melee, 15 damage/hit
- States: IDLE, MOVING, ATTACKING, EATING, SLEEPING, FLEEING

**Dark Mistress** (attracted by Training Room ≥ 6 tiles):
- HP: 80, fast speed, whip (hits 2 targets), applies slow debuff
- States: same as Troll + TRAINING

**Creature spawning:** Check room conditions every 30s. If met and count < cap, spawn near qualifying room with "creature attracted" floating text + particle burst.

**Leveling:** XP gained at 1/sec in Training Room. Thresholds: 100/250/500/900 for levels 2/3/4/5. Per level: +10% HP, +10% damage, +5% speed. Level badge on sprite.

### Heroes (Enemies)

| Hero | HP | Speed | Behavior |
|------|-----|-------|----------|
| Knight | 150 | Slow | Melee. Attacks doors and creatures on path to Dungeon Heart. |
| Thief | 60 | Fast | Bypasses creatures if possible, targets Treasury first. |
| Wizard | 80 | Medium | Ranged (3-tile). Kites melee attackers. |

**Wave system:** Waves every 90 seconds from random map-edge entry. Wave N: N Knights + ceil(N×0.5) Thieves + ceil(N×0.3) Wizards. Screen flash + "INTRUDERS" overlay on arrival. Heroes pathfind to Dungeon Heart via A*, re-path every 3s or when blocked.

### Combat

Tick-based at 200ms intervals. Each attacker finds nearest enemy in range, deals damage, applies debuffs. On death: entity removed, death animation plays. Heroes drop gold; creatures leave corpse sprite. Floating damage numbers (pooled) float upward and fade.

### Spells

| Spell | Mana Cost | Effect |
|-------|-----------|--------|
| Create Imp | 200 | Spawn Imp at Dungeon Heart. Magic circle animation 0.5s. |
| Lightning Strike | 150 | Click to target visible tile. 3×3 AoE, 80 damage. Screen flash + shake + spark particles. Cannot target own creatures. |
| Possess Creature | 100 | Click owned creature. Camera locks to it. WASD direct movement, left-click attack. ESC to unpossess. Red vignette overlay. |

### Door

- Placed on single-tile corridors (exactly 2 opposing walkable neighbors)
- HP: 200, cost: 100 gold
- Heroes stop and attack (10 dmg/sec) until broken
- Owned creatures pass through freely (open/close animation)
- HP bar shown when damaged

### Resources

- **Gold:** Earned from digging gold veins and killing heroes. Base cap 1000 + 500 per Treasury tile. Overflow lost (HUD warning flash).
- **Mana:** Float. Regenerates at +2/sec from Dungeon Heart. Spent on spells.

---

## Rendering

### Visual Identity

- **Palette:** Dark fantasy. Deep stone grays, earth browns, blood reds, gold accents. No pastels, no bright chrome.
- **Sprites:** 100% procedural Canvas primitives. Zero external images.
- **UI theme:** Stone textures via CSS gradients, medieval feel. No generic UI kits.
- **Fonts:** MedievalSharp (headers/HUD), Inter (tooltips/body) — both from Google Fonts.

### Procedural Tile Art

Each tile type has distinct procedural drawing:
- **Rock:** Dark irregular stone pattern with subtle noise
- **Dirt:** Brown with speckled texture, lighter edges
- **Claimed floor:** Smooth gray stone with subtle grid lines
- **Gold vein:** Glittering yellow flecks on rock base
- **Gem seam:** Cyan/purple crystal facets on rock
- **Lava:** Animated orange/red shimmer, slow pulse
- **Water:** Animated blue ripple effect

Tile edges blend naturally with neighbors (marching-squares-style edge detection).

### Procedural Entity Sprites

All entities drawn with Canvas paths/arcs/fills:
- **Imp:** Small hunched figure, 4-frame walk bob, direction-aware (horizontal flip)
- **Troll:** Large hulking silhouette, heavy footstep bob
- **Dark Mistress:** Tall lithe figure with whip trail
- **Knight:** Armored figure with shield silhouette
- **Thief:** Small crouched figure, fast leg movement
- **Wizard:** Robed figure with staff, particle trail
- **Door:** Wooden plank texture with iron bands

### Camera

- Pan: WASD keys + middle-mouse drag
- Zoom: scroll wheel (min/max clamped)
- Clamped to world bounds
- `worldToScreen()` and `screenToWorld()` for coordinate conversion
- Minimap: 120×90px top-right overlay, shows full map, clickable to pan

### Screen Effects

- **Screen shake:** Parameterized duration + magnitude (used by Lightning Strike)
- **Screen flash:** Full-screen color overlay with fade (white for lightning, red for damage)
- **Vignette:** Red overlay during Possess mode
- **Slow-motion:** Time scale reduction for dramatic moments (Dungeon Heart death)

### Performance

- 60fps target, <8ms frame time under wave-10 load
- Viewport culling: only draw tiles/entities within camera bounds
- Object pools: 500 pre-allocated particles, pooled floating text
- Zero per-frame heap allocations after Phase 2 warmup
- Spatial hash for `getEntitiesInRadius()` (Phase 6)
- Dirty-flag or spatial partitioning for render culling by Phase 4

---

## UI (HTML Overlay)

### HUD (top bar)
- Gold count with coin icon (animated tween on change)
- Mana bar (animated smooth fill)
- Imp count
- Wave countdown timer

### Toolbar (bottom bar)
- Buttons: all 5 room types, 3 spells, door tool, speed toggle (1×/2×)
- Active tool highlighted
- Hotkeys 1–9

### Tooltip (floating)
- Appears on hover over any tile/creature/room
- Shows: tile type, room name+level+stats, creature name+health+state+level
- Repositions to stay on screen

### Menu Screens
- **Main menu:** Game title, "BEGIN" button, thematic flavor text
- **Pause (P or Esc):** Overlay with Resume/Restart/Quit
- **Game Over:** Dark overlay, "YOUR DUNGEON FALLS", stats panel (waves survived, gold earned, creatures lost, heroes killed, time elapsed), Restart button
- **Victory:** Gold overlay, "THE REALM IS YOURS", same stats panel, Restart button

---

## Phased Build Plan

### Phase 0 — Foundation
README, project scaffold, constants.js (all enums + tuning values), GameLoop (fixed-timestep + interpolated render), EventBus (pub/sub), blank canvas + FPS counter.

### Phase 1 — World & Camera
World (tile array), MapGenerator (seeded procedural), Camera (pan/zoom/clamp), TileRenderer (culled procedural tiles), Minimap (clickable), InputManager (mouse+keyboard → EventBus).

### Phase 2 — Pathfinding & Imps
Pathfinder (A* with cache), Entity base class, Imp (full AI state machine), EntityManager (spatial queries), JobQueue (dig/carry), digging mechanic (3-stage animation), ParticleSystem + ParticlePool (500 pre-allocated).

### Phase 3 — Resources, Rooms & UI
ResourceManager, RoomManager, all 5 room types with procedural floor art, room placement flow (paint mode), HUD, Toolbar (hotkeys), Tooltip system, Treasury gold cap scaling.

### Phase 4 — Creatures & Combat
Troll + Dark Mistress (room-attraction spawning), leveling system, CombatSystem (200ms tick), Knight + Thief + Wizard heroes, WaveManager (90s escalating waves), floating combat text.

### Phase 5 — Spells & Doors
SpellSystem (Create Imp, Lightning Strike, Possess Creature), Door entity (corridor placement, hero blocking), screen effects (shake, flash, vignette).

### Phase 6 — Polish & Integration
GameStateManager (menu/play/pause/gameover/victory), win/lose conditions, EventBus leak audit, performance pass (spatial hash, allocation audit), visual polish (animations, lava/water effects, Dungeon Heart glow), main menu, full integration test.

---

## Cross-Phase Rules

1. Never break a passing checklist item in a later phase — refactor carefully
2. Constants only in constants.js — zero magic numbers elsewhere
3. EventBus only for cross-system communication — systems never reference each other
4. State is always plain data — renderer reads, logic writes, never mixed
5. One source of truth per piece of data
6. Each phase ends with a working, playable (if incomplete) build
