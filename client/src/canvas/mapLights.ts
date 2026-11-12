import { Texture } from "pixi.js";
import type { LightState, MapState } from "@dms/shared";

const SOFT_LIGHT_SIZE = 256;

export function lightTintFromColor(color: string): number {
  const match = /^([0-9a-fA-F]{6})$/.exec(color.trim());
  if (!match) {
    return 0xfff1c1;
  }
  return Number.parseInt(match[1]!, 16);
}

export function softLightAlpha(intensity: number): number {
  return Math.min(0.72, Math.max(0, intensity) * 0.55);
}

export function lightWorldPosition(
  light: LightState,
  map: MapState,
): { x: number; y: number; diameter: number } {
  return {
    x: map.offsetX + light.position.x * map.gridPx,
    y: map.offsetY + light.position.y * map.gridPx,
    diameter: Math.max(map.gridPx * 0.5, light.range * map.gridPx * 2),
  };
}

export function createSoftLightTexture(): Texture {
  const canvas = document.createElement("canvas");
  canvas.width = SOFT_LIGHT_SIZE;
  canvas.height = SOFT_LIGHT_SIZE;
  const context = canvas.getContext("2d");
  if (!context) {
    return Texture.WHITE;
  }
  const center = SOFT_LIGHT_SIZE / 2;
  const gradient = context.createRadialGradient(center, center, 0, center, center, center);
  gradient.addColorStop(0, "rgba(255,255,255,1)");
  gradient.addColorStop(0.28, "rgba(255,255,255,0.55)");
  gradient.addColorStop(0.65, "rgba(255,255,255,0.18)");
  gradient.addColorStop(1, "rgba(255,255,255,0)");
  context.clearRect(0, 0, SOFT_LIGHT_SIZE, SOFT_LIGHT_SIZE);
  context.fillStyle = gradient;
  context.fillRect(0, 0, SOFT_LIGHT_SIZE, SOFT_LIGHT_SIZE);
  return Texture.from(canvas);
}
