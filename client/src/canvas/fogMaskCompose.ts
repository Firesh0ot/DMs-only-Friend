import {
  isCellExplored,
  parseExploredCells,
  type FogPaintMode,
  type FogState,
  type FogStroke,
  type MapState,
} from "@dms/shared";
import type { LosPoint } from "./losVisibility";

export const AUDIENCE_EXPLORED_FOG_ALPHA = 0.58;

export type FogMaskContext = {
  globalCompositeOperation: GlobalCompositeOperation | string;
  fillStyle: string | CanvasGradient | CanvasPattern;
  strokeStyle: string | CanvasGradient | CanvasPattern;
  lineWidth: number;
  lineCap: CanvasLineCap;
  lineJoin: CanvasLineJoin;
  clearRect(x: number, y: number, w: number, h: number): void;
  fillRect(x: number, y: number, w: number, h: number): void;
  beginPath(): void;
  moveTo(x: number, y: number): void;
  lineTo(x: number, y: number): void;
  closePath?(): void;
  arc(x: number, y: number, radius: number, startAngle: number, endAngle: number): void;
  rect(x: number, y: number, w: number, h: number): void;
  fill(): void;
  stroke(): void;
};

export function fogCompositeOp(mode: FogPaintMode): GlobalCompositeOperation {
  return mode === "reveal" ? "destination-out" : "source-over";
}

export function paintFogStrokeOnContext(ctx: FogMaskContext, stroke: FogStroke): void {
  ctx.globalCompositeOperation = fogCompositeOp(stroke.mode);
  ctx.fillStyle = "#ffffff";
  ctx.strokeStyle = "#ffffff";

  if (stroke.kind === "rect") {
    ctx.beginPath();
    ctx.rect(stroke.x, stroke.y, stroke.w, stroke.h);
    ctx.fill();
    return;
  }

  const points = stroke.points;
  const first = points[0];
  if (!first) {
    return;
  }

  if (points.length === 1) {
    ctx.beginPath();
    ctx.arc(first.x, first.y, stroke.radius, 0, Math.PI * 2);
    ctx.fill();
    return;
  }

  ctx.lineWidth = stroke.radius * 2;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(first.x, first.y);
  for (let i = 1; i < points.length; i += 1) {
    const point = points[i];
    if (point) {
      ctx.lineTo(point.x, point.y);
    }
  }
  ctx.stroke();
}

export function composeFogMask(
  ctx: FogMaskContext,
  width: number,
  height: number,
  fog: Pick<FogState, "baseCovered" | "strokes">,
): void {
  ctx.globalCompositeOperation = "source-over";
  ctx.clearRect(0, 0, width, height);
  if (fog.baseCovered) {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
  }
  for (const stroke of fog.strokes) {
    paintFogStrokeOnContext(ctx, stroke);
  }
}

export function applyLosFogOverlay(
  ctx: FogMaskContext,
  width: number,
  height: number,
  visionPolygons: LosPoint[][],
): void {
  ctx.globalCompositeOperation = "source-over";
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
  ctx.globalCompositeOperation = "destination-out";
  for (const polygon of visionPolygons) {
    const first = polygon[0];
    if (!first || polygon.length < 3) {
      continue;
    }
    ctx.beginPath();
    ctx.moveTo(first.x, first.y);
    for (let index = 1; index < polygon.length; index += 1) {
      const point = polygon[index];
      if (point) {
        ctx.lineTo(point.x, point.y);
      }
    }
    if (ctx.closePath) {
      ctx.closePath();
    } else {
      ctx.lineTo(first.x, first.y);
    }
    ctx.fill();
  }
}

export function composeFogMaskWithLos(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  fog: Pick<FogState, "baseCovered" | "strokes" | "losEnabled">,
  visionPolygons: LosPoint[][],
): void {
  composeFogMask(ctx, width, height, fog);
  if (!fog.losEnabled) {
    return;
  }
  const losCanvas = document.createElement("canvas");
  losCanvas.width = width;
  losCanvas.height = height;
  const losCtx = losCanvas.getContext("2d");
  if (!losCtx) {
    return;
  }
  applyLosFogOverlay(losCtx, width, height, visionPolygons);
  ctx.globalCompositeOperation = "source-over";
  ctx.drawImage(losCanvas, 0, 0);
}

export function applyAudienceExploredFog(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  map: Pick<MapState, "gridPx" | "offsetX" | "offsetY" | "width" | "height">,
  fog: Pick<FogState, "exploredCells">,
): void {
  const explored = parseExploredCells(fog.exploredCells, map);
  const coverCanvas = document.createElement("canvas");
  coverCanvas.width = width;
  coverCanvas.height = height;
  const coverCtx = coverCanvas.getContext("2d");
  if (!coverCtx) {
    return;
  }
  coverCtx.drawImage(ctx.canvas, 0, 0);

  const exploredCanvas = document.createElement("canvas");
  exploredCanvas.width = width;
  exploredCanvas.height = height;
  const exploredCtx = exploredCanvas.getContext("2d");
  if (!exploredCtx) {
    return;
  }
  exploredCtx.fillStyle = "#ffffff";
  for (let cellY = explored.bounds.minY; cellY <= explored.bounds.maxY; cellY += 1) {
    for (let cellX = explored.bounds.minX; cellX <= explored.bounds.maxX; cellX += 1) {
      if (!isCellExplored(explored, cellX, cellY)) {
        continue;
      }
      exploredCtx.fillRect(
        map.offsetX + cellX * map.gridPx,
        map.offsetY + cellY * map.gridPx,
        map.gridPx,
        map.gridPx,
      );
    }
  }

  coverCtx.globalCompositeOperation = "destination-in";
  coverCtx.drawImage(exploredCanvas, 0, 0);

  ctx.globalCompositeOperation = "source-over";
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
  ctx.globalCompositeOperation = "destination-out";
  ctx.drawImage(exploredCanvas, 0, 0);
  ctx.globalCompositeOperation = "source-over";
  ctx.globalAlpha = AUDIENCE_EXPLORED_FOG_ALPHA;
  ctx.drawImage(coverCanvas, 0, 0);
  ctx.globalAlpha = 1;
}
