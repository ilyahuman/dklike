# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `npm run dev` — Start Vite dev server with HMR (http://localhost:5173)
- `npm run build` — Production build to dist/
- `npm test` — Run all tests (vitest)
- `npm run test:watch` — Run tests in watch mode
- `npx vitest run tests/core/EventBus.test.js` — Run a single test file
- `npx vitest run -t "test name"` — Run a single test by name

## Architecture

Vanilla JS + Vite game with Canvas 2D rendering. No frameworks or game engines.

**Core pattern:** Systems communicate exclusively via EventBus pub/sub — they never import each other directly. GameLoop drives fixed-timestep updates (60 UPS) with interpolated rendering. All game state is plain serializable objects.

**Data flow:** InputManager → EventBus → Game Systems → State Changes → EventBus → Renderers

**Key rule:** All tuning values, enums, and magic numbers live in `src/constants.js`. Zero magic numbers anywhere else.

## Project Layout

- `src/constants.js` — Single source of truth for all game numbers
- `src/core/` — GameLoop, EventBus, GameStateManager, ObjectPool
- `src/world/` — World (tile grid), MapGenerator, Pathfinder (A*)
- `src/entities/` — Entity base + all creature/hero/door classes
- `src/systems/` — JobQueue, ResourceManager, RoomManager, CombatSystem, CreatureSpawner, WaveManager, SpellSystem
- `src/input/` — InputManager (captures DOM events, emits on EventBus)
- `src/rendering/` — Camera, TileRenderer, EntityRenderer, ParticleSystem, Minimap, ScreenEffects
- `src/ui/` — HUD, Toolbar, Tooltip, MenuScreens (HTML overlay, not canvas)
- `tests/` — Mirrors src/ structure, uses Vitest

## Conventions

- One class per file, one responsibility per class
- JSDoc on all public methods
- No commented-out dead code
- Rendering reads state but never mutates it
- Test files mirror source paths: `src/core/Foo.js` → `tests/core/Foo.test.js`
- Procedural Canvas drawing only — zero external image files
- Dark fantasy palette (see COLORS in constants.js)
