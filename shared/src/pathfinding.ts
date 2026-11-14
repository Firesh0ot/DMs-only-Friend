import type { GridSegment } from "./wallCollision.js";
import { moveBlockedByWalls } from "./wallCollision.js";

export type PathPoint = { x: number; y: number };

export type GridBounds = {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
};

function chebyshev(a: PathPoint, b: PathPoint): number {
  return Math.max(Math.abs(b.x - a.x), Math.abs(b.y - a.y));
}

const NEIGHBORS: ReadonlyArray<PathPoint> = [
  { x: -1, y: -1 },
  { x: 0, y: -1 },
  { x: 1, y: -1 },
  { x: -1, y: 0 },
  { x: 1, y: 0 },
  { x: -1, y: 1 },
  { x: 0, y: 1 },
  { x: 1, y: 1 },
];

export function cellKey(point: PathPoint): string {
  return `${point.x},${point.y}`;
}

export function parseCellKey(key: string): PathPoint {
  const [xRaw, yRaw] = key.split(",");
  return { x: Number(xRaw), y: Number(yRaw) };
}

export function pathCostChebyshev(
  from: PathPoint,
  to: PathPoint,
  blockers: GridSegment[],
  bounds?: GridBounds | null,
  maxCost?: number | null,
): number | null {
  if (from.x === to.x && from.y === to.y) {
    return 0;
  }
  if (blockers.length === 0) {
    const distance = chebyshev(from, to);
    if (maxCost !== null && maxCost !== undefined && distance > maxCost) {
      return null;
    }
    if (bounds && !inBounds(to, bounds)) {
      return null;
    }
    return distance;
  }

  const limit =
    maxCost !== null && maxCost !== undefined ? maxCost : Number.POSITIVE_INFINITY;
  if (chebyshev(from, to) > limit) {
    return null;
  }

  const costs = new Map<string, number>();
  const queue: PathPoint[] = [{ x: from.x, y: from.y }];
  costs.set(cellKey(from), 0);

  while (queue.length > 0) {
    const current = queue.shift()!;
    const currentKey = cellKey(current);
    const currentCost = costs.get(currentKey) ?? 0;
    if (current.x === to.x && current.y === to.y) {
      return currentCost;
    }
    if (currentCost >= limit) {
      continue;
    }

    for (const step of NEIGHBORS) {
      const next = { x: current.x + step.x, y: current.y + step.y };
      if (bounds && !inBounds(next, bounds)) {
        continue;
      }
      if (chebyshev(from, next) > limit) {
        continue;
      }
      if (moveBlockedByWalls(current, next, blockers)) {
        continue;
      }
      const nextKey = cellKey(next);
      const nextCost = currentCost + 1;
      const known = costs.get(nextKey);
      if (known !== undefined && known <= nextCost) {
        continue;
      }
      if (nextCost > limit) {
        continue;
      }
      costs.set(nextKey, nextCost);
      queue.push(next);
    }
  }

  return null;
}

export function reachableCells(
  origin: PathPoint,
  budgetCells: number,
  blockers: GridSegment[],
  bounds?: GridBounds | null,
): PathPoint[] {
  if (budgetCells < 0) {
    return [];
  }
  if (blockers.length === 0) {
    const cells: PathPoint[] = [];
    for (let y = origin.y - budgetCells; y <= origin.y + budgetCells; y += 1) {
      for (let x = origin.x - budgetCells; x <= origin.x + budgetCells; x += 1) {
        const point = { x, y };
        if (bounds && !inBounds(point, bounds)) {
          continue;
        }
        if (chebyshev(origin, point) <= budgetCells) {
          cells.push(point);
        }
      }
    }
    return cells;
  }

  const costs = new Map<string, number>();
  const queue: PathPoint[] = [{ x: origin.x, y: origin.y }];
  costs.set(cellKey(origin), 0);

  while (queue.length > 0) {
    const current = queue.shift()!;
    const currentCost = costs.get(cellKey(current)) ?? 0;
    if (currentCost >= budgetCells) {
      continue;
    }
    for (const step of NEIGHBORS) {
      const next = { x: current.x + step.x, y: current.y + step.y };
      if (bounds && !inBounds(next, bounds)) {
        continue;
      }
      if (chebyshev(origin, next) > budgetCells) {
        continue;
      }
      if (moveBlockedByWalls(current, next, blockers)) {
        continue;
      }
      const nextKey = cellKey(next);
      const nextCost = currentCost + 1;
      const known = costs.get(nextKey);
      if (known !== undefined && known <= nextCost) {
        continue;
      }
      if (nextCost > budgetCells) {
        continue;
      }
      costs.set(nextKey, nextCost);
      queue.push(next);
    }
  }

  return [...costs.keys()].map(parseCellKey);
}

export function nearestReachableCell(
  from: PathPoint,
  to: PathPoint,
  remainingCells: number,
  turnStart: PathPoint,
  budgetCells: number,
  blockers: GridSegment[],
  bounds?: GridBounds | null,
): PathPoint {
  const fromCosts = bfsCosts(from, remainingCells, blockers, bounds);
  const startCosts = bfsCosts(turnStart, budgetCells, blockers, bounds);
  let best: PathPoint | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (const [key, stepCost] of fromCosts) {
    if (stepCost > remainingCells) {
      continue;
    }
    const fromStart = startCosts.get(key);
    if (fromStart === undefined || fromStart > budgetCells) {
      continue;
    }
    const point = parseCellKey(key);
    const distance = chebyshev(point, to);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = point;
    }
  }

  return best ?? { x: from.x, y: from.y };
}

function bfsCosts(
  origin: PathPoint,
  budgetCells: number,
  blockers: GridSegment[],
  bounds?: GridBounds | null,
): Map<string, number> {
  const costs = new Map<string, number>();
  if (budgetCells < 0) {
    return costs;
  }
  const queue: PathPoint[] = [{ x: origin.x, y: origin.y }];
  costs.set(cellKey(origin), 0);

  if (blockers.length === 0) {
    for (let y = origin.y - budgetCells; y <= origin.y + budgetCells; y += 1) {
      for (let x = origin.x - budgetCells; x <= origin.x + budgetCells; x += 1) {
        const point = { x, y };
        if (bounds && !inBounds(point, bounds)) {
          continue;
        }
        const distance = chebyshev(origin, point);
        if (distance <= budgetCells) {
          costs.set(cellKey(point), distance);
        }
      }
    }
    return costs;
  }

  while (queue.length > 0) {
    const current = queue.shift()!;
    const currentCost = costs.get(cellKey(current)) ?? 0;
    if (currentCost >= budgetCells) {
      continue;
    }
    for (const step of NEIGHBORS) {
      const next = { x: current.x + step.x, y: current.y + step.y };
      if (bounds && !inBounds(next, bounds)) {
        continue;
      }
      if (chebyshev(origin, next) > budgetCells) {
        continue;
      }
      if (moveBlockedByWalls(current, next, blockers)) {
        continue;
      }
      const nextKey = cellKey(next);
      const nextCost = currentCost + 1;
      const known = costs.get(nextKey);
      if (known !== undefined && known <= nextCost) {
        continue;
      }
      if (nextCost > budgetCells) {
        continue;
      }
      costs.set(nextKey, nextCost);
      queue.push(next);
    }
  }

  return costs;
}

function inBounds(point: PathPoint, bounds: GridBounds): boolean {
  return (
    point.x >= bounds.minX &&
    point.x <= bounds.maxX &&
    point.y >= bounds.minY &&
    point.y <= bounds.maxY
  );
}
