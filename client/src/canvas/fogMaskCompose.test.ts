import { describe, expect, it } from "vitest";
import {
  applyLosFogOverlay,
  composeFogMask,
  fogCompositeOp,
  paintFogStrokeOnContext,
  type FogMaskContext,
} from "./fogMaskCompose";

function createRecordingContext(): FogMaskContext & {
  ops: Array<Record<string, unknown>>;
} {
  const ops: Array<Record<string, unknown>> = [];
  return {
    ops,
    globalCompositeOperation: "source-over",
    fillStyle: "#000000",
    strokeStyle: "#000000",
    lineWidth: 1,
    lineCap: "butt",
    lineJoin: "miter",
    clearRect(x, y, w, h) {
      ops.push({ type: "clearRect", x, y, w, h });
    },
    fillRect(x, y, w, h) {
      ops.push({
        type: "fillRect",
        x,
        y,
        w,
        h,
        fillStyle: this.fillStyle,
        op: this.globalCompositeOperation,
      });
    },
    beginPath() {
      ops.push({ type: "beginPath" });
    },
    moveTo(x, y) {
      ops.push({ type: "moveTo", x, y });
    },
    lineTo(x, y) {
      ops.push({ type: "lineTo", x, y });
    },
    arc(x, y, radius, startAngle, endAngle) {
      ops.push({ type: "arc", x, y, radius, startAngle, endAngle });
    },
    rect(x, y, w, h) {
      ops.push({ type: "rect", x, y, w, h });
    },
    fill() {
      ops.push({ type: "fill", fillStyle: this.fillStyle, op: this.globalCompositeOperation });
    },
    stroke() {
      ops.push({
        type: "stroke",
        strokeStyle: this.strokeStyle,
        lineWidth: this.lineWidth,
        op: this.globalCompositeOperation,
      });
    },
  };
}

describe("fogMaskCompose", () => {
  it("maps reveal to destination-out and hide to source-over", () => {
    expect(fogCompositeOp("reveal")).toBe("destination-out");
    expect(fogCompositeOp("hide")).toBe("source-over");
  });

  it("reveals with destination-out and hides with source-over on the same mask", () => {
    const ctx = createRecordingContext();
    composeFogMask(ctx, 200, 100, {
      baseCovered: true,
      strokes: [
        {
          id: "reveal-1",
          kind: "rect",
          mode: "reveal",
          x: 10,
          y: 10,
          w: 40,
          h: 30,
        },
        {
          id: "hide-1",
          kind: "brush",
          mode: "hide",
          radius: 12,
          points: [{ x: 80, y: 50 }],
        },
      ],
    });

    expect(ctx.ops[0]).toEqual({ type: "clearRect", x: 0, y: 0, w: 200, h: 100 });
    expect(ctx.ops[1]).toMatchObject({
      type: "fillRect",
      w: 200,
      h: 100,
      op: "source-over",
    });

    const revealFill = ctx.ops.find(
      (op) => op.type === "fill" && op.op === "destination-out",
    );
    expect(revealFill).toBeTruthy();

    const hideFill = ctx.ops.find((op) => op.type === "fill" && op.op === "source-over");
    expect(hideFill).toBeTruthy();
  });

  it("paints brush trails with reveal composite op", () => {
    const ctx = createRecordingContext();
    paintFogStrokeOnContext(ctx, {
      id: "brush-1",
      kind: "brush",
      mode: "reveal",
      radius: 8,
      points: [
        { x: 0, y: 0 },
        { x: 20, y: 10 },
      ],
    });
    const stroke = ctx.ops.find((op) => op.type === "stroke");
    expect(stroke).toMatchObject({
      op: "destination-out",
      lineWidth: 16,
    });
  });

  it("covers the map then punches LoS vision polygons", () => {
    const ctx = createRecordingContext();
    applyLosFogOverlay(ctx, 100, 80, [
      [
        { x: 10, y: 10 },
        { x: 40, y: 10 },
        { x: 25, y: 40 },
      ],
    ]);
    expect(ctx.ops[0]).toMatchObject({ type: "fillRect", w: 100, h: 80, op: "source-over" });
    const punch = ctx.ops.find((op) => op.type === "fill" && op.op === "destination-out");
    expect(punch).toBeTruthy();
  });

  it("skips base cover fill when baseCovered is false", () => {
    const ctx = createRecordingContext();
    composeFogMask(ctx, 50, 40, { baseCovered: false, strokes: [] });
    expect(ctx.ops).toEqual([{ type: "clearRect", x: 0, y: 0, w: 50, h: 40 }]);
  });

  it("ignores brush strokes with no points", () => {
    const ctx = createRecordingContext();
    paintFogStrokeOnContext(ctx, {
      id: "empty-brush",
      kind: "brush",
      mode: "hide",
      radius: 10,
      points: [],
    });
    expect(ctx.ops).toEqual([]);
  });
});
