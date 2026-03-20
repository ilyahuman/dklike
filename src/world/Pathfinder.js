/**
 * A* pathfinder on the World tile grid.
 * Supports diagonal movement with no corner-cutting.
 * Caches paths — call clearCache() when world changes.
 */
export class Pathfinder {
  /** @type {Map<string, Array<{x:number,y:number}>|null>} */
  static _cache = new Map();

  /**
   * Find a path from (sx,sy) to (dx,dy) on walkable tiles.
   * @param {import('./World.js').World} world
   * @param {number} sx - Start tile X.
   * @param {number} sy - Start tile Y.
   * @param {number} dx - Destination tile X.
   * @param {number} dy - Destination tile Y.
   * @returns {Array<{x:number,y:number}>|null} Path tiles (excluding start), or null if unreachable.
   */
  static findPath(world, sx, sy, dx, dy) {
    if (sx === dx && sy === dy) return [];

    const key = `${sx},${sy}-${dx},${dy}`;
    if (Pathfinder._cache.has(key)) {
      const cached = Pathfinder._cache.get(key);
      return cached ? cached.map(p => ({ x: p.x, y: p.y })) : cached;
    }

    const result = Pathfinder._astar(world, sx, sy, dx, dy);
    Pathfinder._cache.set(key, result);
    return result ? result.map(p => ({ x: p.x, y: p.y })) : result;
  }

  /** Clear the path cache. Call when tiles change. */
  static clearCache() {
    Pathfinder._cache.clear();
  }

  /**
   * A* implementation.
   * @private
   */
  static _astar(world, sx, sy, dx, dy) {
    const DIRS = [
      [1, 0], [-1, 0], [0, 1], [0, -1],   // Cardinal
      [1, 1], [1, -1], [-1, 1], [-1, -1],  // Diagonal
    ];
    const SQRT2 = Math.SQRT2;

    const w = world.width;
    const openSet = [];
    const gScore = new Map();
    const fScore = new Map();
    const cameFrom = new Map();
    const closedSet = new Set();

    const toKey = (x, y) => y * w + x;
    const heuristic = (x, y) => {
      // Octile distance
      const adx = Math.abs(x - dx);
      const ady = Math.abs(y - dy);
      return Math.max(adx, ady) + (SQRT2 - 1) * Math.min(adx, ady);
    };

    const startKey = toKey(sx, sy);
    gScore.set(startKey, 0);
    fScore.set(startKey, heuristic(sx, sy));
    openSet.push({ x: sx, y: sy, f: fScore.get(startKey) });

    while (openSet.length > 0) {
      // Find node with lowest fScore (simple linear scan — fine for grid sizes up to 80x60)
      let bestIdx = 0;
      for (let i = 1; i < openSet.length; i++) {
        if (openSet[i].f < openSet[bestIdx].f) bestIdx = i;
      }
      const current = openSet.splice(bestIdx, 1)[0];
      const cx = current.x;
      const cy = current.y;
      const cKey = toKey(cx, cy);

      if (cx === dx && cy === dy) {
        return Pathfinder._reconstructPath(cameFrom, cKey, sx, sy, w);
      }

      closedSet.add(cKey);

      for (const [ddx, ddy] of DIRS) {
        const nx = cx + ddx;
        const ny = cy + ddy;

        if (!world.isInBounds(nx, ny)) continue;
        if (!world.isWalkable(nx, ny)) continue;

        const nKey = toKey(nx, ny);
        if (closedSet.has(nKey)) continue;

        // No corner-cutting: for diagonal moves, both adjacent cardinal tiles must be walkable
        if (ddx !== 0 && ddy !== 0) {
          if (!world.isWalkable(cx + ddx, cy) || !world.isWalkable(cx, cy + ddy)) {
            continue;
          }
        }

        const moveCost = (ddx !== 0 && ddy !== 0) ? SQRT2 : 1;
        const tentG = gScore.get(cKey) + moveCost;

        if (!gScore.has(nKey) || tentG < gScore.get(nKey)) {
          cameFrom.set(nKey, cKey);
          gScore.set(nKey, tentG);
          const f = tentG + heuristic(nx, ny);
          fScore.set(nKey, f);

          // Check if already in open set
          const existing = openSet.findIndex(n => toKey(n.x, n.y) === nKey);
          if (existing !== -1) {
            openSet[existing].f = f;
          } else {
            openSet.push({ x: nx, y: ny, f });
          }
        }
      }
    }

    return null; // No path found
  }

  /**
   * Reconstruct path from cameFrom map.
   * @private
   */
  static _reconstructPath(cameFrom, endKey, sx, sy, w) {
    const path = [];
    let current = endKey;
    const startKey = sy * w + sx;

    while (current !== startKey) {
      const x = current % w;
      const y = Math.floor(current / w);
      path.unshift({ x, y });
      current = cameFrom.get(current);
      if (current === undefined) break;
    }

    return path;
  }
}
