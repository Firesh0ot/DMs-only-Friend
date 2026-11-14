import {
  healWallsAroundPortals,
  snapPortalBoundsToWalls,
  type MapState,
  type PortalState,
  type TokenState,
  type WallPolyline,
} from "@dms/shared";

export type LosPoint = { x: number; y: number };
export type LosSegment = { a: LosPoint; b: LosPoint };

const ANGLE_EPS = 1e-6;
const RAY_EPS = 1e-4;

export function mapHasLosGeometry(map: Pick<MapState, "walls" | "portals">): boolean {
  return map.walls.length > 0 || map.portals.length > 0;
}

export function wallPolylinesToSegments(
  walls: WallPolyline[],
  map: Pick<MapState, "gridPx" | "offsetX" | "offsetY">,
): LosSegment[] {
  const segments: LosSegment[] = [];
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
      segments.push({
        a: wallPointToPixel(from, map),
        b: wallPointToPixel(to, map),
      });
    }
  }
  return segments;
}

export function closedPortalSegments(
  portals: PortalState[],
  map: Pick<MapState, "gridPx" | "offsetX" | "offsetY" | "walls" | "portals">,
): LosSegment[] {
  const wallGuide = healWallsAroundPortals(map.walls, map.portals ?? portals);
  const segments: LosSegment[] = [];
  for (const portal of portals) {
    if (!portal.closed) {
      continue;
    }
    const bounds = snapPortalBoundsToWalls(portal.bounds, wallGuide);
    segments.push({
      a: wallPointToPixel(bounds[0], map),
      b: wallPointToPixel(bounds[1], map),
    });
  }
  return segments;
}

export function losBlockingSegments(
  map: Pick<MapState, "walls" | "portals" | "gridPx" | "offsetX" | "offsetY" | "width" | "height">,
): LosSegment[] {
  const healedWalls = healWallsAroundPortals(map.walls, map.portals);
  return [
    ...wallPolylinesToSegments(healedWalls, map),
    ...closedPortalSegments(map.portals, map),
    ...mapBoundarySegments(map.width, map.height),
  ];
}

export function mapBoundarySegments(width: number, height: number): LosSegment[] {
  return [
    { a: { x: 0, y: 0 }, b: { x: width, y: 0 } },
    { a: { x: width, y: 0 }, b: { x: width, y: height } },
    { a: { x: width, y: height }, b: { x: 0, y: height } },
    { a: { x: 0, y: height }, b: { x: 0, y: 0 } },
  ];
}

export function tokenVisionOrigin(
  token: Pick<TokenState, "x" | "y">,
  map: Pick<MapState, "gridPx" | "offsetX" | "offsetY">,
): LosPoint {
  return {
    x: map.offsetX + (token.x + 0.5) * map.gridPx,
    y: map.offsetY + (token.y + 0.5) * map.gridPx,
  };
}

export function visibilityPolygon(
  origin: LosPoint,
  segments: LosSegment[],
  bounds: { width: number; height: number },
): LosPoint[] {
  const unique = uniqueEndpoints(segments);
  unique.push(
    { x: 0, y: 0 },
    { x: bounds.width, y: 0 },
    { x: bounds.width, y: bounds.height },
    { x: 0, y: bounds.height },
  );

  const angles: number[] = [];
  for (const point of unique) {
    const base = Math.atan2(point.y - origin.y, point.x - origin.x);
    angles.push(base - RAY_EPS, base, base + RAY_EPS);
  }
  angles.sort((left, right) => left - right);

  const hits: Array<LosPoint & { angle: number }> = [];
  for (const angle of angles) {
    const hit = closestRayHit(origin, angle, segments);
    if (hit) {
      hits.push({ ...hit, angle });
    }
  }

  const polygon: LosPoint[] = [];
  for (const hit of hits) {
    const previous = polygon[polygon.length - 1];
    if (previous && nearlySame(previous, hit)) {
      continue;
    }
    polygon.push({ x: hit.x, y: hit.y });
  }
  return polygon.length >= 3 ? polygon : [];
}

export function playerVisionPolygons(
  map: MapState,
  tokens: TokenState[],
): LosPoint[][] {
  if (!mapHasLosGeometry(map)) {
    return [];
  }
  const segments = losBlockingSegments(map);
  const polygons: LosPoint[][] = [];
  for (const token of tokens) {
    if (!token.isPlayer || token.mapId !== map.id) {
      continue;
    }
    const origin = tokenVisionOrigin(token, map);
    const polygon = visibilityPolygon(origin, segments, {
      width: map.width,
      height: map.height,
    });
    if (polygon.length >= 3) {
      polygons.push(polygon);
    }
  }
  return polygons;
}

export function pointInPolygon(point: LosPoint, polygon: LosPoint[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const a = polygon[i]!;
    const b = polygon[j]!;
    const intersects =
      a.y > point.y !== b.y > point.y &&
      point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y + Number.EPSILON) + a.x;
    if (intersects) {
      inside = !inside;
    }
  }
  return inside;
}

function wallPointToPixel(
  point: { x: number; y: number },
  map: Pick<MapState, "gridPx" | "offsetX" | "offsetY">,
): LosPoint {
  return {
    x: map.offsetX + point.x * map.gridPx,
    y: map.offsetY + point.y * map.gridPx,
  };
}

function uniqueEndpoints(segments: LosSegment[]): LosPoint[] {
  const seen = new Set<string>();
  const points: LosPoint[] = [];
  for (const segment of segments) {
    for (const point of [segment.a, segment.b]) {
      const key = `${point.x.toFixed(4)}:${point.y.toFixed(4)}`;
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      points.push(point);
    }
  }
  return points;
}

function closestRayHit(origin: LosPoint, angle: number, segments: LosSegment[]): LosPoint | null {
  const direction = { x: Math.cos(angle), y: Math.sin(angle) };
  let bestT = Number.POSITIVE_INFINITY;
  let best: LosPoint | null = null;
  for (const segment of segments) {
    const hit = raySegmentIntersection(origin, direction, segment);
    if (hit && hit.t > ANGLE_EPS && hit.t < bestT) {
      bestT = hit.t;
      best = hit.point;
    }
  }
  return best;
}

function raySegmentIntersection(
  origin: LosPoint,
  direction: LosPoint,
  segment: LosSegment,
): { t: number; point: LosPoint } | null {
  const sx = segment.b.x - segment.a.x;
  const sy = segment.b.y - segment.a.y;
  const denominator = direction.x * sy - direction.y * sx;
  if (Math.abs(denominator) < 1e-10) {
    return null;
  }
  const dx = segment.a.x - origin.x;
  const dy = segment.a.y - origin.y;
  const t = (dx * sy - dy * sx) / denominator;
  const u = (dx * direction.y - dy * direction.x) / denominator;
  if (t < 0 || u < -1e-8 || u > 1 + 1e-8) {
    return null;
  }
  return {
    t,
    point: {
      x: origin.x + direction.x * t,
      y: origin.y + direction.y * t,
    },
  };
}

function nearlySame(a: LosPoint, b: LosPoint): boolean {
  return Math.hypot(a.x - b.x, a.y - b.y) < 0.05;
}
