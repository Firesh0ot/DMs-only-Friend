import type { PortalState, WallPolyline } from "./events.js";
import type { GridPoint } from "./movement.js";

export type GridSegment = { a: GridPoint; b: GridPoint };

const EPS = 1e-9;

export function wallPolylinesToGridSegments(walls: WallPolyline[]): GridSegment[] {
  const segments: GridSegment[] = [];
  for (const polyline of walls) {
    for (let index = 1; index < polyline.length; index += 1) {
      const from = polyline[index - 1];
      const to = polyline[index];
      if (!from || !to) {
        continue;
      }
      if (from.x === to.x && from.y === to.y) {
        continue;
      }
      segments.push({ a: { x: from.x, y: from.y }, b: { x: to.x, y: to.y } });
    }
  }
  return segments;
}

export function closedPortalsToGridSegments(
  portals: Array<Pick<PortalState, "bounds" | "closed">>,
): GridSegment[] {
  const segments: GridSegment[] = [];
  for (const portal of portals) {
    if (!portal.closed) {
      continue;
    }
    const [a, b] = portal.bounds;
    if (a.x === b.x && a.y === b.y) {
      continue;
    }
    segments.push({ a: { x: a.x, y: a.y }, b: { x: b.x, y: b.y } });
  }
  return segments;
}

export function movementBlockerSegments(
  walls: WallPolyline[],
  portals: Array<Pick<PortalState, "bounds" | "closed">> = [],
): GridSegment[] {
  return [...wallPolylinesToGridSegments(walls), ...closedPortalsToGridSegments(portals)];
}

export function cellCenter(point: GridPoint): GridPoint {
  return { x: point.x + 0.5, y: point.y + 0.5 };
}

export function segmentsProperlyIntersect(left: GridSegment, right: GridSegment): boolean {
  const o1 = orientation(left.a, left.b, right.a);
  const o2 = orientation(left.a, left.b, right.b);
  const o3 = orientation(right.a, right.b, left.a);
  const o4 = orientation(right.a, right.b, left.b);

  if (o1 === 0 && o2 === 0 && o3 === 0 && o4 === 0) {
    return false;
  }

  return o1 !== o2 && o3 !== o4;
}

export function moveBlockedByWalls(
  from: GridPoint,
  to: GridPoint,
  blockers: GridSegment[],
): boolean {
  if (from.x === to.x && from.y === to.y) {
    return false;
  }
  if (blockers.length === 0) {
    return false;
  }
  const path: GridSegment = { a: cellCenter(from), b: cellCenter(to) };
  return blockers.some((segment) => segmentsProperlyIntersect(path, segment));
}

function orientation(a: GridPoint, b: GridPoint, c: GridPoint): -1 | 0 | 1 {
  const value = (b.y - a.y) * (c.x - b.x) - (b.x - a.x) * (c.y - b.y);
  if (Math.abs(value) <= EPS) {
    return 0;
  }
  return value > 0 ? 1 : -1;
}
