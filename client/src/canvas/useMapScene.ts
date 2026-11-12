import {
  Application,
  Assets,
  Container,
  Graphics,
  Rectangle,
  RenderTexture,
  Sprite,
  Text,
  type Texture,
} from "pixi.js";
import { useEffect, useRef } from "react";
import type {
  CameraState,
  FogPaintMode,
  FogState,
  FogStroke,
  FogStrokeInput,
  MapState,
  Role,
  TokenState,
} from "@dms/shared";
import { downsamplePoints, drawFogStroke, renderFogMask } from "./fogRender";

export type FogToolMode = "off" | "brush" | "rect";

export type MapSceneProps = {
  map: MapState | null;
  tokens: TokenState[];
  camera: CameraState | null;
  role: Role;
  characterId: string | null;
  activeTokenId: string | null;
  fog: FogState | null;
  fogTool: FogToolMode;
  fogPaintMode: FogPaintMode;
  fogBrushRadius: number;
  onTokenMove: (tokenId: string, x: number, y: number) => void;
  onCameraChange: (camera: CameraState) => void;
  onFogPaint: (stroke: FogStrokeInput) => void;
};

type TokenView = {
  root: Container;
  body: Graphics;
  label: Text;
  ring: Graphics;
  tokenId: string;
};

const DEFAULT_CAMERA: CameraState = { x: 0, y: 0, zoom: 1 };
const FOG_TINT = 0x140e0a;

export function useMapScene(host: HTMLDivElement | null, props: MapSceneProps): void {
  const propsRef = useRef(props);
  propsRef.current = props;

  const appRef = useRef<Application | null>(null);
  const worldRef = useRef<Container | null>(null);
  const mapLayerRef = useRef<Container | null>(null);
  const gridLayerRef = useRef<Graphics | null>(null);
  const wallLayerRef = useRef<Graphics | null>(null);
  const tokenLayerRef = useRef<Container | null>(null);
  const fogLayerRef = useRef<Container | null>(null);
  const fogSpriteRef = useRef<Sprite | null>(null);
  const fogTextureRef = useRef<RenderTexture | null>(null);
  const fogPreviewRef = useRef<Graphics | null>(null);
  const tokenViewsRef = useRef<Map<string, TokenView>>(new Map());
  const cameraRef = useRef<CameraState>(props.camera ?? DEFAULT_CAMERA);
  const lastCameraEmitRef = useRef(0);
  const dragRef = useRef<{
    mode: "pan" | "token" | "fog-brush" | "fog-rect";
    tokenId?: string;
    lastX: number;
    lastY: number;
    points?: Array<{ x: number; y: number }>;
    startWorld?: { x: number; y: number };
  } | null>(null);

  useEffect(() => {
    if (!host) {
      return;
    }

    let destroyed = false;
    const app = new Application();
    const world = new Container();
    const mapLayer = new Container();
    const gridLayer = new Graphics();
    const wallLayer = new Graphics();
    const tokenLayer = new Container();
    const fogLayer = new Container();
    const fogPreview = new Graphics();
    fogPreview.eventMode = "none";
    world.addChild(mapLayer);
    world.addChild(gridLayer);
    world.addChild(wallLayer);
    world.addChild(tokenLayer);
    world.addChild(fogLayer);
    world.addChild(fogPreview);

    void (async () => {
      await app.init({
        backgroundAlpha: 0,
        antialias: true,
        resizeTo: host,
        autoDensity: true,
        resolution: Math.min(window.devicePixelRatio || 1, 2),
      });
      if (destroyed) {
        app.destroy(true);
        return;
      }

      host.appendChild(app.canvas);
      app.stage.addChild(world);
      app.stage.eventMode = "static";
      app.stage.hitArea = app.screen;

      appRef.current = app;
      worldRef.current = world;
      mapLayerRef.current = mapLayer;
      gridLayerRef.current = gridLayer;
      wallLayerRef.current = wallLayer;
      tokenLayerRef.current = tokenLayer;
      fogLayerRef.current = fogLayer;
      fogPreviewRef.current = fogPreview;

      applyCamera(world, cameraRef.current);
      void syncMap(propsRef.current.map);
      syncTokens(propsRef.current.tokens, propsRef.current.activeTokenId);
      syncFog(propsRef.current.fog, propsRef.current.map, propsRef.current.role);

      app.stage.on("pointerdown", (event) => {
        if (propsRef.current.role !== "gm") {
          return;
        }
        if (dragRef.current?.mode === "token") {
          return;
        }

        const fogTool = propsRef.current.fogTool;
        const map = propsRef.current.map;
        if (fogTool !== "off" && map && event.button === 0) {
          const worldPoint = screenToWorld(event.global.x, event.global.y);
          if (fogTool === "brush") {
            dragRef.current = {
              mode: "fog-brush",
              lastX: event.global.x,
              lastY: event.global.y,
              points: [worldPoint],
            };
            drawBrushPreview(worldPoint, propsRef.current.fogBrushRadius, propsRef.current.fogPaintMode);
            return;
          }
          dragRef.current = {
            mode: "fog-rect",
            lastX: event.global.x,
            lastY: event.global.y,
            startWorld: worldPoint,
          };
          return;
        }

        dragRef.current = {
          mode: "pan",
          lastX: event.global.x,
          lastY: event.global.y,
        };
      });

      app.stage.on("pointermove", (event) => {
        const drag = dragRef.current;
        const currentWorld = worldRef.current;
        if (!drag || !currentWorld) {
          return;
        }
        const dx = event.global.x - drag.lastX;
        const dy = event.global.y - drag.lastY;
        drag.lastX = event.global.x;
        drag.lastY = event.global.y;

        if (drag.mode === "pan") {
          const next = {
            ...cameraRef.current,
            x: cameraRef.current.x + dx,
            y: cameraRef.current.y + dy,
          };
          cameraRef.current = next;
          applyCamera(currentWorld, next);
          emitCamera(next, false);
          return;
        }

        if (drag.mode === "token" && drag.tokenId) {
          const view = tokenViewsRef.current.get(drag.tokenId);
          if (!view) {
            return;
          }
          view.root.x += dx / cameraRef.current.zoom;
          view.root.y += dy / cameraRef.current.zoom;
          return;
        }

        if (drag.mode === "fog-brush" && drag.points) {
          const worldPoint = screenToWorld(event.global.x, event.global.y);
          drag.points.push(worldPoint);
          drawBrushPreviewTrail(drag.points, propsRef.current.fogBrushRadius, propsRef.current.fogPaintMode);
          return;
        }

        if (drag.mode === "fog-rect" && drag.startWorld) {
          const worldPoint = screenToWorld(event.global.x, event.global.y);
          drawRectPreview(drag.startWorld, worldPoint, propsRef.current.fogPaintMode);
        }
      });

      const endDrag = () => {
        const drag = dragRef.current;
        if (!drag) {
          return;
        }
        if (drag.mode === "token" && drag.tokenId) {
          const map = propsRef.current.map;
          const view = tokenViewsRef.current.get(drag.tokenId);
          if (map && view) {
            const cell = pixelToCell(view.root.x, view.root.y, map);
            const snapped = {
              x: Math.round(cell.x),
              y: Math.round(cell.y),
            };
            const pixel = cellToPixel(snapped.x, snapped.y, map);
            view.root.position.set(pixel.x, pixel.y);
            propsRef.current.onTokenMove(drag.tokenId, snapped.x, snapped.y);
          }
        } else if (drag.mode === "pan") {
          emitCamera(cameraRef.current, true);
        } else if (drag.mode === "fog-brush" && drag.points && drag.points.length > 0) {
          const points = downsamplePoints(drag.points, Math.max(4, propsRef.current.fogBrushRadius * 0.35));
          propsRef.current.onFogPaint({
            kind: "brush",
            mode: propsRef.current.fogPaintMode,
            radius: propsRef.current.fogBrushRadius,
            points,
          });
          clearFogPreview();
        } else if (drag.mode === "fog-rect" && drag.startWorld) {
          const end = screenToWorld(drag.lastX, drag.lastY);
          const x = Math.min(drag.startWorld.x, end.x);
          const y = Math.min(drag.startWorld.y, end.y);
          const w = Math.abs(end.x - drag.startWorld.x);
          const h = Math.abs(end.y - drag.startWorld.y);
          clearFogPreview();
          if (w >= 1 && h >= 1) {
            propsRef.current.onFogPaint({
              kind: "rect",
              mode: propsRef.current.fogPaintMode,
              x,
              y,
              w,
              h,
            });
          }
        }
        dragRef.current = null;
      };

      app.stage.on("pointerup", endDrag);
      app.stage.on("pointerupoutside", endDrag);
    })();

    const onWheel = (event: WheelEvent) => {
      if (propsRef.current.role !== "gm") {
        return;
      }
      event.preventDefault();
      const worldNode = worldRef.current;
      const application = appRef.current;
      if (!worldNode || !application) {
        return;
      }
      const scaleFactor = event.deltaY < 0 ? 1.1 : 0.9;
      const nextZoom = clamp(cameraRef.current.zoom * scaleFactor, 0.2, 4);
      const rect = host.getBoundingClientRect();
      const localX = event.clientX - rect.left;
      const localY = event.clientY - rect.top;
      const worldX = (localX - cameraRef.current.x) / cameraRef.current.zoom;
      const worldY = (localY - cameraRef.current.y) / cameraRef.current.zoom;
      const next: CameraState = {
        zoom: nextZoom,
        x: localX - worldX * nextZoom,
        y: localY - worldY * nextZoom,
      };
      cameraRef.current = next;
      applyCamera(worldNode, next);
      emitCamera(next, true);
    };

    host.addEventListener("wheel", onWheel, { passive: false });
    const tokenViews = tokenViewsRef.current;

    return () => {
      destroyed = true;
      host.removeEventListener("wheel", onWheel);
      tokenViews.clear();
      fogTextureRef.current?.destroy(true);
      fogTextureRef.current = null;
      fogSpriteRef.current = null;
      if (appRef.current) {
        appRef.current.destroy(true);
        appRef.current = null;
      }
      host.replaceChildren();
    };
    // Scene bootstrap binds once per host; sync helpers read latest props via refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [host]);

  useEffect(() => {
    if (props.role === "gm") {
      return;
    }
    if (!props.camera || !worldRef.current) {
      return;
    }
    cameraRef.current = props.camera;
    applyCamera(worldRef.current, props.camera);
  }, [props.camera, props.role]);

  useEffect(() => {
    void syncMap(props.map);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.map]);

  useEffect(() => {
    syncTokens(props.tokens, props.activeTokenId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.tokens, props.activeTokenId]);

  useEffect(() => {
    syncFog(props.fog, props.map, props.role);
  }, [props.fog, props.map, props.role]);

  useEffect(() => {
    if (!host) {
      return;
    }
    host.classList.toggle("canvas-host--fog-tool", props.role === "gm" && props.fogTool !== "off");
  }, [host, props.fogTool, props.role]);

  async function syncMap(map: MapState | null): Promise<void> {
    const mapLayer = mapLayerRef.current;
    const gridLayer = gridLayerRef.current;
    const wallLayer = wallLayerRef.current;
    if (!mapLayer || !gridLayer || !wallLayer) {
      return;
    }

    mapLayer.removeChildren();
    gridLayer.clear();
    wallLayer.clear();

    if (!map) {
      clearFogLayer();
      return;
    }

    const texture = (await Assets.load(`/uploads/${map.filename}`)) as Texture;
    if (mapLayerRef.current !== mapLayer) {
      return;
    }
    const sprite = new Sprite(texture);
    sprite.width = map.width;
    sprite.height = map.height;
    mapLayer.addChild(sprite);
    drawGrid(gridLayer, map);
    if (propsRef.current.role === "gm") {
      drawWalls(wallLayer, map);
    }
    ensureFogTexture(map);
    syncFog(propsRef.current.fog, map, propsRef.current.role);

    if (propsRef.current.role === "gm" && !propsRef.current.camera) {
      const application = appRef.current;
      if (application) {
        const zoom = clamp(
          Math.min(application.screen.width / map.width, application.screen.height / map.height) *
            0.92,
          0.2,
          2,
        );
        const next = {
          zoom,
          x: (application.screen.width - map.width * zoom) / 2,
          y: (application.screen.height - map.height * zoom) / 2,
        };
        cameraRef.current = next;
        if (worldRef.current) {
          applyCamera(worldRef.current, next);
        }
        emitCamera(next, true);
      }
    }
  }

  function syncTokens(tokens: TokenState[], activeTokenId: string | null): void {
    const tokenLayer = tokenLayerRef.current;
    const map = propsRef.current.map;
    if (!tokenLayer || !map) {
      for (const [, view] of tokenViewsRef.current) {
        view.root.destroy({ children: true });
      }
      tokenViewsRef.current.clear();
      return;
    }

    const seen = new Set<string>();
    for (const token of tokens) {
      seen.add(token.id);
      let view = tokenViewsRef.current.get(token.id);
      if (!view) {
        const created = createTokenView(token.id, token.label);
        view = created;
        tokenViewsRef.current.set(token.id, created);
        tokenLayer.addChild(created.root);
        created.root.eventMode = "static";
        const tokenId = created.tokenId;
        created.root.on("pointerdown", (event) => {
          if (propsRef.current.fogTool !== "off") {
            return;
          }
          const current = propsRef.current.tokens.find((entry) => entry.id === tokenId);
          if (!current || !canDragToken(current)) {
            return;
          }
          event.stopPropagation();
          dragRef.current = {
            mode: "token",
            tokenId,
            lastX: event.global.x,
            lastY: event.global.y,
          };
        });
      }

      const dragging = dragRef.current?.mode === "token" && dragRef.current.tokenId === token.id;
      if (!dragging) {
        const pixel = cellToPixel(token.x, token.y, map);
        view.root.position.set(pixel.x, pixel.y);
      }
      const radius = (map.gridPx * token.sizeCells) / 2 - 2;
      redrawToken(view, token.label, radius, token.id === activeTokenId);
      view.root.hitArea = new Rectangle(-radius, -radius, radius * 2, radius * 2);
      view.root.cursor =
        propsRef.current.fogTool === "off" && canDragToken(token) ? "grab" : "default";
    }

    for (const [id, view] of tokenViewsRef.current) {
      if (!seen.has(id)) {
        tokenLayer.removeChild(view.root);
        view.root.destroy({ children: true });
        tokenViewsRef.current.delete(id);
      }
    }
  }

  function ensureFogTexture(map: MapState): void {
    const fogLayer = fogLayerRef.current;
    const app = appRef.current;
    if (!fogLayer || !app) {
      return;
    }
    const existing = fogTextureRef.current;
    if (existing && existing.width === map.width && existing.height === map.height) {
      return;
    }
    existing?.destroy(true);
    fogLayer.removeChildren();
    const texture = RenderTexture.create({
      width: map.width,
      height: map.height,
      antialias: true,
    });
    const sprite = new Sprite(texture);
    sprite.eventMode = "none";
    sprite.tint = FOG_TINT;
    fogLayer.addChild(sprite);
    fogTextureRef.current = texture;
    fogSpriteRef.current = sprite;
  }

  function clearFogLayer(): void {
    fogTextureRef.current?.destroy(true);
    fogTextureRef.current = null;
    fogSpriteRef.current = null;
    fogLayerRef.current?.removeChildren();
    clearFogPreview();
  }

  function syncFog(fog: FogState | null, map: MapState | null, role: Role): void {
    const app = appRef.current;
    const texture = fogTextureRef.current;
    const sprite = fogSpriteRef.current;
    if (!app || !texture || !sprite || !map || !fog || fog.mapId !== map.id) {
      if (!map || !fog) {
        if (sprite) {
          sprite.visible = false;
        }
      }
      return;
    }
    renderFogMask(app, texture, map, fog);
    sprite.visible = true;
    sprite.alpha = role === "gm" ? 0.58 : 1;
  }

  function clearFogPreview(): void {
    fogPreviewRef.current?.clear();
  }

  function drawBrushPreview(point: { x: number; y: number }, radius: number, mode: FogPaintMode): void {
    const preview = fogPreviewRef.current;
    if (!preview) {
      return;
    }
    preview.clear();
    preview.circle(point.x, point.y, radius);
    preview.fill({ color: mode === "reveal" ? 0xc4a574 : 0x1a120b, alpha: 0.35 });
    preview.stroke({ width: 2, color: mode === "reveal" ? 0xe8d5a3 : 0x6b4f2e, alpha: 0.9 });
  }

  function drawBrushPreviewTrail(
    points: Array<{ x: number; y: number }>,
    radius: number,
    mode: FogPaintMode,
  ): void {
    const preview = fogPreviewRef.current;
    if (!preview || points.length === 0) {
      return;
    }
    preview.clear();
    const stroke: FogStroke = {
      id: "preview",
      kind: "brush",
      mode,
      radius,
      points,
    };
    drawFogStroke(preview, stroke, mode === "reveal" ? 0xc4a574 : 0x1a120b);
    preview.alpha = 0.4;
  }

  function drawRectPreview(
    start: { x: number; y: number },
    end: { x: number; y: number },
    mode: FogPaintMode,
  ): void {
    const preview = fogPreviewRef.current;
    if (!preview) {
      return;
    }
    const x = Math.min(start.x, end.x);
    const y = Math.min(start.y, end.y);
    const w = Math.abs(end.x - start.x);
    const h = Math.abs(end.y - start.y);
    preview.clear();
    preview.alpha = 1;
    preview.rect(x, y, w, h);
    preview.fill({ color: mode === "reveal" ? 0xc4a574 : 0x1a120b, alpha: 0.28 });
    preview.stroke({ width: 2, color: mode === "reveal" ? 0xe8d5a3 : 0x8a6234, alpha: 0.95 });
  }

  function screenToWorld(screenX: number, screenY: number): { x: number; y: number } {
    return {
      x: (screenX - cameraRef.current.x) / cameraRef.current.zoom,
      y: (screenY - cameraRef.current.y) / cameraRef.current.zoom,
    };
  }

  function canDragToken(token: TokenState): boolean {
    const { role, characterId } = propsRef.current;
    if (role === "gm") {
      return true;
    }
    if (role === "player") {
      return Boolean(characterId && token.characterId && token.characterId === characterId);
    }
    return false;
  }

  function emitCamera(camera: CameraState, force: boolean): void {
    const now = Date.now();
    if (!force && now - lastCameraEmitRef.current < 100) {
      return;
    }
    lastCameraEmitRef.current = now;
    propsRef.current.onCameraChange(camera);
  }
}

function applyCamera(world: Container, camera: CameraState): void {
  world.position.set(camera.x, camera.y);
  world.scale.set(camera.zoom);
}

function drawGrid(graphics: Graphics, map: MapState): void {
  graphics.clear();
  graphics.setStrokeStyle({ width: 1, color: 0xffffff, alpha: 0.22 });
  for (let x = map.offsetX; x <= map.width; x += map.gridPx) {
    graphics.moveTo(x, 0);
    graphics.lineTo(x, map.height);
  }
  for (let y = map.offsetY; y <= map.height; y += map.gridPx) {
    graphics.moveTo(0, y);
    graphics.lineTo(map.width, y);
  }
  graphics.stroke();
}

function drawWalls(graphics: Graphics, map: MapState): void {
  graphics.clear();
  if (map.walls.length === 0) {
    return;
  }
  graphics.setStrokeStyle({ width: 2, color: 0xd97706, alpha: 0.85 });
  for (const polyline of map.walls) {
    const first = polyline[0];
    if (!first) {
      continue;
    }
    graphics.moveTo(map.offsetX + first.x * map.gridPx, map.offsetY + first.y * map.gridPx);
    for (let index = 1; index < polyline.length; index += 1) {
      const point = polyline[index]!;
      graphics.lineTo(map.offsetX + point.x * map.gridPx, map.offsetY + point.y * map.gridPx);
    }
  }
  graphics.stroke();
}

function createTokenView(tokenId: string, label: string): TokenView {
  const root = new Container();
  const ring = new Graphics();
  const body = new Graphics();
  const text = new Text({
    text: label.slice(0, 3).toUpperCase(),
    style: {
      fill: 0xffffff,
      fontSize: 14,
      fontFamily: "IBM Plex Sans, sans-serif",
      fontWeight: "700",
    },
  });
  text.anchor.set(0.5);
  root.addChild(ring);
  root.addChild(body);
  root.addChild(text);
  return { root, body, label: text, ring, tokenId };
}

function redrawToken(view: TokenView, label: string, radius: number, active: boolean): void {
  view.body.clear();
  view.ring.clear();
  if (active) {
    view.ring.circle(0, 0, radius + 5);
    view.ring.stroke({ width: 3, color: 0xc45c26, alpha: 1 });
  }
  view.body.circle(0, 0, radius);
  view.body.fill({ color: 0x1f6b5c });
  view.body.stroke({ width: 2, color: 0xffffff, alpha: 0.9 });
  view.label.text = label.slice(0, 3).toUpperCase();
  view.label.scale.set(Math.max(0.7, radius / 24));
}

function cellToPixel(x: number, y: number, map: MapState): { x: number; y: number } {
  return {
    x: map.offsetX + (x + 0.5) * map.gridPx,
    y: map.offsetY + (y + 0.5) * map.gridPx,
  };
}

function pixelToCell(x: number, y: number, map: MapState): { x: number; y: number } {
  return {
    x: (x - map.offsetX) / map.gridPx - 0.5,
    y: (y - map.offsetY) / map.gridPx - 0.5,
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
