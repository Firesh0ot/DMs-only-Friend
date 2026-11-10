import { useState } from "react";
import type { CameraState, MapState, Role, TokenState } from "@dms/shared";
import { useMapScene } from "./useMapScene";

type Props = {
  map: MapState | null;
  tokens: TokenState[];
  camera: CameraState | null;
  role: Role;
  playerName: string | null;
  activeTokenId: string | null;
  onTokenMove: (tokenId: string, x: number, y: number) => void;
  onCameraChange: (camera: CameraState) => void;
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
