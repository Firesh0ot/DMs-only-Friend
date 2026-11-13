import { isFloor } from "./bsp.js";

export type Point = { x: number; y: number };

export function extractWallPolylines(
  cells: Uint8Array,
  width: number,
  height: number,
): Point[][] {
  const edges: Array<[Point, Point]> = [];
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (!isFloor(cells, width, x, y)) {
        continue;
      }
      if (!isFloor(cells, width, x, y - 1)) {
        edges.push([
          { x, y },
          { x: x + 1, y },
        ]);
      }
      if (!isFloor(cells, width, x, y + 1)) {
        edges.push([
          { x, y: y + 1 },
          { x: x + 1, y: y + 1 },
        ]);
      }
      if (!isFloor(cells, width, x - 1, y)) {
        edges.push([
          { x, y },
          { x, y: y + 1 },
        ]);
      }
      if (!isFloor(cells, width, x + 1, y)) {
        edges.push([
          { x: x + 1, y },
          { x: x + 1, y: y + 1 },
        ]);
      }
    }
  }
  return mergeEdges(edges);
}

function mergeEdges(edges: Array<[Point, Point]>): Point[][] {
  const unused = edges.map((edge) => [...edge] as [Point, Point]);
  const polylines: Point[][] = [];

  while (unused.length > 0) {
    const [start, next] = unused.pop()!;
    const line: Point[] = [start, next];
    let extended = true;
    while (extended) {
      extended = false;
      const head = line[0]!;
      const tail = line[line.length - 1]!;
      for (let i = unused.length - 1; i >= 0; i -= 1) {
        const [a, b] = unused[i]!;
        if (samePoint(a, tail)) {
          line.push(b);
          unused.splice(i, 1);
          extended = true;
          break;
        }
        if (samePoint(b, tail)) {
          line.push(a);
          unused.splice(i, 1);
          extended = true;
          break;
        }
        if (samePoint(a, head)) {
          line.unshift(b);
          unused.splice(i, 1);
          extended = true;
          break;
        }
        if (samePoint(b, head)) {
          line.unshift(a);
          unused.splice(i, 1);
          extended = true;
          break;
        }
      }
    }
    if (line.length >= 2) {
      polylines.push(simplifyCollinear(line));
    }
  }
  return polylines;
}

function simplifyCollinear(points: Point[]): Point[] {
  if (points.length <= 2) {
    return points;
  }
  const out: Point[] = [points[0]!];
  for (let i = 1; i < points.length - 1; i += 1) {
    const prev = out[out.length - 1]!;
    const cur = points[i]!;
    const next = points[i + 1]!;
    const colinear =
      (prev.x === cur.x && cur.x === next.x) || (prev.y === cur.y && cur.y === next.y);
    if (!colinear) {
      out.push(cur);
    }
  }
  out.push(points[points.length - 1]!);
  return out;
}

function samePoint(a: Point, b: Point): boolean {
  return a.x === b.x && a.y === b.y;
}
