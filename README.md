# DKLike — 2D Dungeon Keeper

A browser-based 2D dungeon management game inspired by Dungeon Keeper. Dig underground rooms, attract creatures, and defend against invading heroes. All visuals are procedurally drawn on Canvas — zero external image assets.

## Tech Stack

**Vanilla JavaScript (ES Modules) + Vite.** No frameworks, no game engines, no sprite sheets.

Why: 20+ game classes doing procedural Canvas drawing and game logic. Vite provides HMR and production builds with near-zero config. The constants.js enum pattern provides sufficient type structure without TypeScript overhead.

## Getting Started

```bash
npm install
npm run dev       # Start dev server with HMR at http://localhost:5173
npm run build     # Production build to dist/
npm run preview   # Preview production build
npm test          # Run unit tests
npm run test:watch # Run tests in watch mode
```

## Project Structure

- `src/constants.js` — All tuning values, enums, costs, stats. Zero magic numbers elsewhere.
- `src/core/` — GameLoop (fixed-timestep), EventBus (pub/sub), GameStateManager, ObjectPool
- `src/world/` — World (tile grid), MapGenerator (seeded procedural), Pathfinder (A*)
- `src/entities/` — Entity base class, Imp, Troll, Dark Mistress, Knight, Thief, Wizard, Door
- `src/systems/` — JobQueue, ResourceManager, RoomManager, CombatSystem, CreatureSpawner, WaveManager, SpellSystem
- `src/input/` — InputManager (mouse + keyboard → EventBus)
- `src/rendering/` — Camera, TileRenderer, EntityRenderer, ParticleSystem, Minimap, ScreenEffects
- `src/ui/` — HUD, Toolbar, Tooltip, MenuScreens (all HTML overlay, not canvas)
- `tests/` — Mirrors src/ structure. Unit tests via Vitest.

## Architecture

- **EventBus only** — Systems never import each other. All cross-system communication via EventBus pub/sub.
- **Serializable state** — Game state is plain objects/arrays. No circular refs, no DOM refs in state.
- **Read-only rendering** — Render path reads state, never mutates it.
- **Constants centralized** — Every tuning value in `src/constants.js`.
