import { useState } from "react";
import type {
  CameraState,
  FogPaintMode,
  FogState,
  FogStrokeInput,
  MapState,
  MovementBudget,
  Role,
  SpawnPoint,
  TokenState,
} from "@dms/shared";
import type { ScreenDisplayMode } from "../lib/screenCalibration";
import { useMapScene, type FogToolMode } from "./useMapScene";

type Props = {
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
  screenDisplayMode?: ScreenDisplayMode;
  lockedZoom?: number | null;
  initialPhysicalCamera?: { x: number; y: number } | null;
  onTokenMove: (tokenId: string, x: number, y: number) => void;
  onCameraChange: (camera: CameraState) => void;
  onPhysicalCameraChange?: (camera: { x: number; y: number }) => void;
  onFogPaint: (stroke: FogStrokeInput) => void;
  onPortalToggle?: (portalId: string, closed: boolean) => void;
  spawnTool?: boolean;
  spawnPoints?: SpawnPoint[];
  onSpawnPlace?: (x: number, y: number) => void;
  movement?: MovementBudget | null;
};

export function MapCanvas(props: Props) {
  const [host, setHost] = useState<HTMLDivElement | null>(null);
  useMapScene(host, props);

  return (
    <div
      className="canvas-host"
      ref={setHost}
      aria-label={props.map ? "Battle map" : "Waiting for map upload"}
    />
  );
}
