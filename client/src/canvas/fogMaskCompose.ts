import type { FogPaintMode, FogState, FogStroke } from "@dms/shared";

export type FogMaskContext = {
  globalCompositeOperation: string;
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
