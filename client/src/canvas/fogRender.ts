import { Graphics, type Application, type RenderTexture } from "pixi.js";
import type { FogState, FogStroke, MapState } from "@dms/shared";

export function drawFogStroke(graphics: Graphics, stroke: FogStroke, color: number): void {
  if (stroke.kind === "brush") {
    const points = stroke.points;
    const first = points[0];
    if (!first) {
      return;
    }
    if (points.length === 1) {
      graphics.circle(first.x, first.y, stroke.radius);
      graphics.fill({ color });
      return;
    }
    graphics.moveTo(first.x, first.y);
    for (let i = 1; i < points.length; i += 1) {
      const point = points[i];
      if (point) {
        graphics.lineTo(point.x, point.y);
      }
    }
    graphics.stroke({
      width: stroke.radius * 2,
      color,
      alpha: 1,
      cap: "round",
      join: "round",
    });
    graphics.circle(first.x, first.y, stroke.radius);
    graphics.fill({ color });
    const last = points[points.length - 1];
    if (last) {
      graphics.circle(last.x, last.y, stroke.radius);
      graphics.fill({ color });
    }
    return;
  }

  graphics.rect(stroke.x, stroke.y, stroke.w, stroke.h);
  graphics.fill({ color });
}

export function renderFogMask(
  app: Application,
  target: RenderTexture,
  map: MapState,
  fog: FogState,
): void {
  const brush = new Graphics();
  if (fog.baseCovered) {
    brush.rect(0, 0, map.width, map.height);
    brush.fill({ color: 0xffffff });
  }
  app.renderer.render({
    container: brush,
    target,
    clear: true,
  });

  for (const stroke of fog.strokes) {
    brush.clear();
    brush.blendMode = stroke.mode === "reveal" ? "erase" : "normal";
    drawFogStroke(brush, stroke, 0xffffff);
    app.renderer.render({
      container: brush,
      target,
      clear: false,
    });
  }

  brush.destroy();
}

export function downsamplePoints(
  points: Array<{ x: number; y: number }>,
  minDistance: number,
): Array<{ x: number; y: number }> {
  if (points.length <= 1) {
    return points;
  }
  const result: Array<{ x: number; y: number }> = [];
  const first = points[0];
  if (!first) {
    return result;
  }
  result.push(first);
  let last = first;
  for (let i = 1; i < points.length; i += 1) {
    const point = points[i];
    if (!point) {
      continue;
    }
    const dx = point.x - last.x;
    const dy = point.y - last.y;
    if (Math.hypot(dx, dy) >= minDistance) {
      result.push(point);
      last = point;
    }
  }
  const finalPoint = points[points.length - 1];
  if (finalPoint && result[result.length - 1] !== finalPoint) {
    result.push(finalPoint);
  }
  return result.slice(0, 240);
}
