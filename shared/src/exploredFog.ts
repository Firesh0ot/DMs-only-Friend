import type { FogState, FogStroke, MapState, TokenState } from "./events.js";
import { mapGridBounds } from "./movement.js";
import type { GridBounds } from "./pathfinding.js";
import {
  mapHasLosGeometry,
  playerVisionPolygons,
  pointInPolygon,
  type LosPoint,
} from "./losVisibility.js";

export type ExploredBitset = {
  bounds: GridBounds;
  cols: number;
  rows: number;
  bits: Uint8Array;
};

export function exploredGridSize(bounds: GridBounds): { cols: number; rows: number } {
  return {
    cols: bounds.maxX - bounds.minX + 1,
    rows: bounds.maxY - bounds.minY + 1,
  };
}

export function createEmptyExplored(map: Pick<MapState, "width" | "height" | "gridPx" | "offsetX" | "offsetY">): ExploredBitset {
  const bounds = mapGridBounds(map);
  const { cols, rows } = exploredGridSize(bounds);
  return {
    bounds,
    cols,
    rows,
    bits: new Uint8Array(Math.ceil((cols * rows) / 8)),
  };
}

export function createFullExplored(map: Pick<MapState, "width" | "height" | "gridPx" | "offsetX" | "offsetY">): ExploredBitset {
  const explored = createEmptyExplored(map);
  explored.bits.fill(0xff);
  return explored;
}

export function encodeExploredBits(bits: Uint8Array): string {
  if (bits.length === 0) {
    return "";
  }
  let any = false;
  let binary = "";
  for (let i = 0; i < bits.length; i += 1) {
    const value = bits[i]!;
    if (value !== 0) {
      any = true;
    }
    binary += String.fromCharCode(value);
  }
  if (!any) {
    return "";
  }
  return btoa(binary);
}

export function decodeExploredBits(encoded: string, byteLength: number): Uint8Array {
  const bits = new Uint8Array(byteLength);
  if (!encoded) {
    return bits;
  }
  try {
    const binary = atob(encoded);
    const limit = Math.min(byteLength, binary.length);
    for (let i = 0; i < limit; i += 1) {
      bits[i] = binary.charCodeAt(i);
    }
  } catch {
    return bits;
  }
  return bits;
}

export function parseExploredCells(
  encoded: string | undefined,
  map: Pick<MapState, "width" | "height" | "gridPx" | "offsetX" | "offsetY">,
): ExploredBitset {
  const empty = createEmptyExplored(map);
  empty.bits = decodeExploredBits(encoded ?? "", empty.bits.length);
  return empty;
}

export function cellBitIndex(explored: ExploredBitset, cellX: number, cellY: number): number | null {
  if (
    cellX < explored.bounds.minX ||
    cellX > explored.bounds.maxX ||
    cellY < explored.bounds.minY ||
    cellY > explored.bounds.maxY
  ) {
    return null;
  }
  const localX = cellX - explored.bounds.minX;
  const localY = cellY - explored.bounds.minY;
  return localY * explored.cols + localX;
}

export function isCellExplored(explored: ExploredBitset, cellX: number, cellY: number): boolean {
  const index = cellBitIndex(explored, cellX, cellY);
  if (index === null) {
    return false;
  }
  const byteIndex = index >> 3;
  const bit = index & 7;
  return ((explored.bits[byteIndex] ?? 0) & (1 << bit)) !== 0;
}

export function markCellExplored(explored: ExploredBitset, cellX: number, cellY: number): boolean {
  const index = cellBitIndex(explored, cellX, cellY);
  if (index === null) {
    return false;
  }
  const byteIndex = index >> 3;
  const bit = index & 7;
  const mask = 1 << bit;
  const prev = explored.bits[byteIndex] ?? 0;
  if ((prev & mask) !== 0) {
    return false;
  }
  explored.bits[byteIndex] = prev | mask;
  return true;
}

export function cellCenterPixel(
  cellX: number,
  cellY: number,
  map: Pick<MapState, "gridPx" | "offsetX" | "offsetY">,
): LosPoint {
  return {
    x: map.offsetX + (cellX + 0.5) * map.gridPx,
    y: map.offsetY + (cellY + 0.5) * map.gridPx,
  };
}

export function pointHitsFogStroke(point: LosPoint, stroke: FogStroke): boolean {
  if (stroke.kind === "rect") {
    return (
      point.x >= stroke.x &&
      point.x <= stroke.x + stroke.w &&
      point.y >= stroke.y &&
      point.y <= stroke.y + stroke.h
    );
  }
  const points = stroke.points;
  if (points.length === 0) {
    return false;
  }
  if (points.length === 1) {
    const only = points[0]!;
    return Math.hypot(point.x - only.x, point.y - only.y) <= stroke.radius;
  }
  for (let i = 1; i < points.length; i += 1) {
    const a = points[i - 1]!;
    const b = points[i]!;
    if (distanceToSegment(point, a, b) <= stroke.radius) {
      return true;
    }
  }
  return false;
}

export function isManuallyClearAt(
  fog: Pick<FogState, "baseCovered" | "strokes">,
  point: LosPoint,
): boolean {
  let covered = fog.baseCovered;
  for (const stroke of fog.strokes) {
    if (pointHitsFogStroke(point, stroke)) {
      covered = stroke.mode === "hide";
    }
  }
  return !covered;
}

export function isLosClearAt(
  fog: Pick<FogState, "losEnabled">,
  map: MapState,
  tokens: TokenState[],
  point: LosPoint,
): boolean {
  if (!fog.losEnabled || !mapHasLosGeometry(map)) {
    return true;
  }
  const polygons = playerVisionPolygons(map, tokens);
  if (polygons.length === 0) {
    return false;
  }
  return polygons.some((polygon) => pointInPolygon(point, polygon));
}

export function isCurrentlyVisibleAt(
  fog: Pick<FogState, "baseCovered" | "strokes" | "losEnabled">,
  map: MapState,
  tokens: TokenState[],
  point: LosPoint,
): boolean {
  return isManuallyClearAt(fog, point) && isLosClearAt(fog, map, tokens, point);
}

export function isCurrentlyVisibleCell(
  fog: Pick<FogState, "baseCovered" | "strokes" | "losEnabled">,
  map: MapState,
  tokens: TokenState[],
  cellX: number,
  cellY: number,
): boolean {
  return isCurrentlyVisibleAt(fog, map, tokens, cellCenterPixel(cellX, cellY, map));
}

export function growExploredFromCurrentVisibility(
  explored: ExploredBitset,
  fog: Pick<FogState, "baseCovered" | "strokes" | "losEnabled">,
  map: MapState,
  tokens: TokenState[],
): boolean {
  let changed = false;
  for (let cellY = explored.bounds.minY; cellY <= explored.bounds.maxY; cellY += 1) {
    for (let cellX = explored.bounds.minX; cellX <= explored.bounds.maxX; cellX += 1) {
      if (!isCurrentlyVisibleCell(fog, map, tokens, cellX, cellY)) {
        continue;
      }
      if (markCellExplored(explored, cellX, cellY)) {
        changed = true;
      }
    }
  }
  return changed;
}

export function growExploredFromStroke(
  explored: ExploredBitset,
  map: Pick<MapState, "gridPx" | "offsetX" | "offsetY">,
  stroke: FogStroke,
): boolean {
  if (stroke.mode !== "reveal") {
    return false;
  }
  let changed = false;
  for (let cellY = explored.bounds.minY; cellY <= explored.bounds.maxY; cellY += 1) {
    for (let cellX = explored.bounds.minX; cellX <= explored.bounds.maxX; cellX += 1) {
      const point = cellCenterPixel(cellX, cellY, map);
      if (!pointHitsFogStroke(point, stroke)) {
        continue;
      }
      if (markCellExplored(explored, cellX, cellY)) {
        changed = true;
      }
    }
  }
  return changed;
}

export type AudienceFogKind = "clear" | "explored" | "unseen";

export function audienceFogKindAtCell(input: {
  fog: Pick<FogState, "baseCovered" | "strokes" | "losEnabled" | "exploredCells">;
  map: MapState;
  tokens: TokenState[];
  cellX: number;
  cellY: number;
}): AudienceFogKind {
  if (isCurrentlyVisibleCell(input.fog, input.map, input.tokens, input.cellX, input.cellY)) {
    return "clear";
  }
  const explored = parseExploredCells(input.fog.exploredCells, input.map);
  if (isCellExplored(explored, input.cellX, input.cellY)) {
    return "explored";
  }
  return "unseen";
}

export function shouldShowTokenForAudience(input: {
  role: "gm" | "screen" | "player";
  token: Pick<TokenState, "x" | "y" | "isPlayer" | "mapId">;
  map: MapState;
  fog: Pick<FogState, "baseCovered" | "strokes" | "losEnabled" | "exploredCells"> | null;
  tokens: TokenState[];
}): boolean {
  if (input.role === "gm") {
    return true;
  }
  if (input.token.mapId !== input.map.id) {
    return false;
  }
  if (!input.fog) {
    return true;
  }
  const cellX = Math.floor(input.token.x);
  const cellY = Math.floor(input.token.y);
  const currentlyVisible = isCurrentlyVisibleCell(
    input.fog,
    input.map,
    input.tokens,
    cellX,
    cellY,
  );
  if (input.token.isPlayer) {
    if (currentlyVisible) {
      return true;
    }
    const explored = parseExploredCells(input.fog.exploredCells, input.map);
    return isCellExplored(explored, cellX, cellY);
  }
  return currentlyVisible;
}

function distanceToSegment(point: LosPoint, a: LosPoint, b: LosPoint): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  if (dx === 0 && dy === 0) {
    return Math.hypot(point.x - a.x, point.y - a.y);
  }
  const t = Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / (dx * dx + dy * dy)));
  const projX = a.x + t * dx;
  const projY = a.y + t * dy;
  return Math.hypot(point.x - projX, point.y - projY);
}
