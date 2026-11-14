import type { GridSegment } from "./wallCollision.js";
import {
  nearestReachableCell,
  pathCostChebyshev,
  type GridBounds,
} from "./pathfinding.js";

export type GridPoint = { x: number; y: number };

export function chebyshev(a: GridPoint, b: GridPoint): number {
  return Math.max(Math.abs(b.x - a.x), Math.abs(b.y - a.y));
}

export type ApplyMoveInput = {
  from: GridPoint;
  to: GridPoint;
  remainingCells: number;
  turnStart?: GridPoint | null;
  budgetCells?: number | null;
  blockers?: GridSegment[];
  bounds?: GridBounds | null;
};

export type ApplyMoveResult =
  | { ok: true; distance: number; remainingCells: number }
  | { ok: false; reason: string; distance: number; remainingCells: number };

export function applyMove(input: ApplyMoveInput): ApplyMoveResult {
  const blockers = input.blockers ?? [];
  const distance =
    blockers.length > 0
      ? pathCostChebyshev(
          input.from,
          input.to,
          blockers,
          input.bounds,
          input.remainingCells,
        )
      : chebyshev(input.from, input.to);

  if (distance === null) {
    return {
      ok: false,
      reason: "No walkable path within remaining movement",
      distance: chebyshev(input.from, input.to),
      remainingCells: input.remainingCells,
    };
  }

  if (distance <= 0) {
    return { ok: true, distance: 0, remainingCells: input.remainingCells };
  }

  if (
    input.turnStart &&
    input.budgetCells !== null &&
    input.budgetCells !== undefined
  ) {
    const fromStart =
      blockers.length > 0
        ? pathCostChebyshev(
            input.turnStart,
            input.to,
            blockers,
            input.bounds,
            input.budgetCells,
          )
        : chebyshev(input.turnStart, input.to);
    if (fromStart === null || fromStart > input.budgetCells) {
      return {
        ok: false,
        reason: `Outside movement range (${input.budgetCells} from turn start)`,
        distance,
        remainingCells: input.remainingCells,
      };
    }
  }

  if (distance > input.remainingCells) {
    return {
      ok: false,
      reason: `Need ${distance} cells, only ${input.remainingCells} remaining`,
      distance,
      remainingCells: input.remainingCells,
    };
  }

  return {
    ok: true,
    distance,
    remainingCells: input.remainingCells - distance,
  };
}

export function clampToChebyshevRange(
  point: GridPoint,
  origin: GridPoint,
  radius: number,
): GridPoint {
  return {
    x: Math.min(origin.x + radius, Math.max(origin.x - radius, point.x)),
    y: Math.min(origin.y + radius, Math.max(origin.y - radius, point.y)),
  };
}

export function clampMoveToBudget(input: {
  from: GridPoint;
  to: GridPoint;
  remainingCells: number;
  turnStart: GridPoint;
  budgetCells: number;
  blockers?: GridSegment[];
  bounds?: GridBounds | null;
}): GridPoint {
  const blockers = input.blockers ?? [];
  if (blockers.length === 0) {
    const withinStep = clampToChebyshevRange(input.to, input.from, input.remainingCells);
    return clampToChebyshevRange(withinStep, input.turnStart, input.budgetCells);
  }
  return nearestReachableCell(
    input.from,
    input.to,
    input.remainingCells,
    input.turnStart,
    input.budgetCells,
    blockers,
    input.bounds,
  );
}

export function assignSpawnPoints<TPoint extends { assignedCharacterId: string | null }>(
  points: TPoint[],
  characterIds: string[],
): Map<string, TPoint> {
  const assigned = new Map<string, TPoint>();
  const usedCharacters = new Set<string>();

  for (const point of points) {
    if (point.assignedCharacterId && characterIds.includes(point.assignedCharacterId)) {
      if (!usedCharacters.has(point.assignedCharacterId)) {
        assigned.set(point.assignedCharacterId, point);
        usedCharacters.add(point.assignedCharacterId);
      }
    }
  }

  const freePoints = points.filter((point) => point.assignedCharacterId === null);

  let freeIndex = 0;
  for (const characterId of characterIds) {
    if (usedCharacters.has(characterId)) {
      continue;
    }
    const point = freePoints[freeIndex];
    if (!point) {
      break;
    }
    assigned.set(characterId, point);
    usedCharacters.add(characterId);
    freeIndex += 1;
  }

  return assigned;
}

export function mapGridBounds(map: {
  width: number;
  height: number;
  gridPx: number;
  offsetX?: number;
  offsetY?: number;
}): GridBounds {
  const offsetX = map.offsetX ?? 0;
  const offsetY = map.offsetY ?? 0;
  const minX = Math.floor(offsetX / map.gridPx);
  const minY = Math.floor(offsetY / map.gridPx);
  const maxX = Math.max(minX, Math.ceil((map.width - offsetX) / map.gridPx) - 1);
  const maxY = Math.max(minY, Math.ceil((map.height - offsetY) / map.gridPx) - 1);
  return { minX, maxX, minY, maxY };
}
