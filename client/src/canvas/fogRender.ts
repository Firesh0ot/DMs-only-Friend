import { Sprite, type Application, type Graphics, type RenderTexture } from "pixi.js";
import type { FogState, FogStroke, MapState, Role, TokenState } from "@dms/shared";
import {
  applyAudienceExploredFog,
  composeFogMask,
  composeFogMaskWithLos,
} from "./fogMaskCompose";
import { mapHasLosGeometry, playerVisionPolygons } from "./losVisibility";

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
  tokens: TokenState[] = [],
  role: Role = "gm",
): void {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.floor(map.width));
  canvas.height = Math.max(1, Math.floor(map.height));
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return;
  }
  if (fog.losEnabled && mapHasLosGeometry(map)) {
    const polygons = playerVisionPolygons(map, tokens);
    composeFogMaskWithLos(ctx, canvas.width, canvas.height, fog, polygons);
  } else {
    composeFogMask(ctx, canvas.width, canvas.height, fog);
  }
  if (role !== "gm") {
    applyAudienceExploredFog(ctx, canvas.width, canvas.height, map, fog);
  }
  const sprite = Sprite.from(canvas);
  app.renderer.render({
    container: sprite,
    target,
    clear: true,
  });
  sprite.destroy({ texture: true, textureSource: true });
}
