import type { PortalState, WallPoint, WallPolyline } from "./events.js";

const LINE_SNAP = 0.2;
const INTERVAL_EPS = 1e-6;

type Axis = "x" | "y";

type LineInterval = {
  axis: Axis;
  line: number;
  start: number;
  end: number;
};

export function mergeWallPolylines(
  primary: WallPolyline[],
  secondary: WallPolyline[],
): WallPolyline[] {
  return [...primary, ...secondary].filter((polyline) => polyline.length >= 2);
}

export function snapPortalBoundsToWalls(
  bounds: [{ x: number; y: number }, { x: number; y: number }],
  walls: WallPolyline[],
): [{ x: number; y: number }, { x: number; y: number }] {
  const portal = boundsToInterval(bounds);
  if (!portal) {
    return [
      { x: bounds[0].x, y: bounds[0].y },
      { x: bounds[1].x, y: bounds[1].y },
    ];
  }
  const wallIntervals = wallPolylinesToIntervals(walls);
  let bestLine = portal.line;
  let bestDistance = LINE_SNAP;
  for (const wall of wallIntervals) {
    if (wall.axis !== portal.axis) {
      continue;
    }
    const distance = Math.abs(wall.line - portal.line);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestLine = wall.line;
    }
  }
  if (portal.axis === "x") {
    return [
      { x: bestLine, y: bounds[0].y },
      { x: bestLine, y: bounds[1].y },
    ];
  }
  return [
    { x: bounds[0].x, y: bestLine },
    { x: bounds[1].x, y: bestLine },
  ];
}

export function healWallsAroundPortals(
  walls: WallPolyline[],
  portals: Array<Pick<PortalState, "bounds" | "freestanding">>,
): WallPolyline[] {
  const wallIntervals = wallPolylinesToIntervals(walls);
  if (wallIntervals.length === 0) {
    return walls.map((polyline) => polyline.map((point) => ({ x: point.x, y: point.y })));
  }

  const portalIntervals = portals
    .filter((portal) => portal.freestanding !== true)
    .map((portal) => boundsToInterval(portal.bounds))
    .filter((interval): interval is LineInterval => interval !== null);

  if (portalIntervals.length === 0) {
    return walls.map((polyline) => polyline.map((point) => ({ x: point.x, y: point.y })));
  }

  const lineKeys = new Set<string>();
  for (const interval of [...wallIntervals, ...portalIntervals]) {
    lineKeys.add(lineKey(interval.axis, interval.line));
  }

  const healed: WallPolyline[] = walls.map((polyline) =>
    polyline.map((point) => ({ x: point.x, y: point.y })),
  );

  for (const key of lineKeys) {
    const [axisRaw, lineRaw] = key.split(":");
    const axis = axisRaw as Axis;
    const line = Number(lineRaw);
    const wallsOnLine = wallIntervals.filter(
      (interval) => interval.axis === axis && nearlyEqual(interval.line, line, LINE_SNAP),
    );
    if (wallsOnLine.length === 0) {
      continue;
    }

    const wallLine = average(wallsOnLine.map((interval) => interval.line));
    const portalsOnLine = portalIntervals.filter(
      (interval) => interval.axis === axis && nearlyEqual(interval.line, wallLine, LINE_SNAP),
    );
    if (portalsOnLine.length === 0) {
      continue;
    }

    const covered = mergeIntervals([
      ...wallsOnLine.map((interval) => normalizeInterval(interval.start, interval.end)),
      ...portalsOnLine.map((interval) => normalizeInterval(interval.start, interval.end)),
    ]);
    if (covered.length === 0) {
      continue;
    }

    const spanStart = Math.min(...covered.map((interval) => interval.start));
    const spanEnd = Math.max(...covered.map((interval) => interval.end));
    const gaps = subtractIntervals([{ start: spanStart, end: spanEnd }], covered);

    for (const gap of gaps) {
      if (gap.end - gap.start <= INTERVAL_EPS) {
        continue;
      }
      healed.push(intervalToPolyline(axis, wallLine, gap.start, gap.end));
    }
  }

  return healed;
}

function wallPolylinesToIntervals(walls: WallPolyline[]): LineInterval[] {
  const intervals: LineInterval[] = [];
  for (const polyline of walls) {
    for (let index = 1; index < polyline.length; index += 1) {
      const from = polyline[index - 1];
      const to = polyline[index];
      if (!from || !to) {
        continue;
      }
      const interval = segmentToInterval(from, to);
      if (interval) {
        intervals.push(interval);
      }
    }
  }
  return intervals;
}

function boundsToInterval(
  bounds: [{ x: number; y: number }, { x: number; y: number }],
): LineInterval | null {
  return segmentToInterval(bounds[0], bounds[1]);
}

function segmentToInterval(from: WallPoint, to: WallPoint): LineInterval | null {
  if (nearlyEqual(from.x, to.x, INTERVAL_EPS) && !nearlyEqual(from.y, to.y, INTERVAL_EPS)) {
    return {
      axis: "x",
      line: from.x,
      start: Math.min(from.y, to.y),
      end: Math.max(from.y, to.y),
    };
  }
  if (nearlyEqual(from.y, to.y, INTERVAL_EPS) && !nearlyEqual(from.x, to.x, INTERVAL_EPS)) {
    return {
      axis: "y",
      line: from.y,
      start: Math.min(from.x, to.x),
      end: Math.max(from.x, to.x),
    };
  }
  return null;
}

function intervalToPolyline(
  axis: Axis,
  line: number,
  start: number,
  end: number,
): WallPolyline {
  if (axis === "x") {
    return [
      { x: line, y: start },
      { x: line, y: end },
    ];
  }
  return [
    { x: start, y: line },
    { x: end, y: line },
  ];
}

function normalizeInterval(start: number, end: number): { start: number; end: number } {
  return start <= end ? { start, end } : { start: end, end: start };
}

function mergeIntervals(
  intervals: Array<{ start: number; end: number }>,
): Array<{ start: number; end: number }> {
  if (intervals.length === 0) {
    return [];
  }
  const sorted = [...intervals].sort((left, right) => left.start - right.start);
  const merged: Array<{ start: number; end: number }> = [{ ...sorted[0]! }];
  for (let index = 1; index < sorted.length; index += 1) {
    const current = sorted[index]!;
    const last = merged[merged.length - 1]!;
    if (current.start <= last.end + INTERVAL_EPS) {
      last.end = Math.max(last.end, current.end);
    } else {
      merged.push({ ...current });
    }
  }
  return merged;
}

function subtractIntervals(
  spans: Array<{ start: number; end: number }>,
  covered: Array<{ start: number; end: number }>,
): Array<{ start: number; end: number }> {
  const blocked = mergeIntervals(covered);
  const gaps: Array<{ start: number; end: number }> = [];
  for (const span of spans) {
    let cursor = span.start;
    for (const block of blocked) {
      if (block.end <= cursor + INTERVAL_EPS) {
        continue;
      }
      if (block.start >= span.end - INTERVAL_EPS) {
        break;
      }
      if (block.start > cursor + INTERVAL_EPS) {
        gaps.push({ start: cursor, end: Math.min(block.start, span.end) });
      }
      cursor = Math.max(cursor, block.end);
      if (cursor >= span.end - INTERVAL_EPS) {
        break;
      }
    }
    if (cursor < span.end - INTERVAL_EPS) {
      gaps.push({ start: cursor, end: span.end });
    }
  }
  return gaps;
}

function lineKey(axis: Axis, line: number): string {
  return `${axis}:${snapLine(line)}`;
}

function snapLine(value: number): number {
  return Math.round(value / LINE_SNAP) * LINE_SNAP;
}

function nearlyEqual(left: number, right: number, epsilon: number): boolean {
  return Math.abs(left - right) <= epsilon;
}

function average(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}
