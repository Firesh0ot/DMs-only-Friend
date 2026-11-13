export type CalibrationMethod = "ruler" | "auto";

export type ScreenCalibration = {
  pxPerCm: number;
  calibratedAt: string;
  method: CalibrationMethod;
};

export type ScreenDisplayMode = "fit" | "physical";

export type PhysicalCameraState = {
  x: number;
  y: number;
};

const CALIBRATION_KEY = "dms.screen.calibration.v1";
const DISPLAY_MODE_KEY = "dms.screen.displayMode.v1";
const PHYSICAL_CAMERA_KEY = "dms.screen.physicalCamera.v1";

export function devicePpi(widthPx: number, heightPx: number, diagonalInch: number): number {
  if (widthPx <= 0 || heightPx <= 0 || diagonalInch <= 0) {
    throw new Error("width, height, and diagonal must be positive");
  }
  return Math.sqrt(widthPx * widthPx + heightPx * heightPx) / diagonalInch;
}

export function pxPerCmFromAuto(
  widthPx: number,
  heightPx: number,
  diagonalInch: number,
  devicePixelRatio: number,
): number {
  const dpr = devicePixelRatio > 0 ? devicePixelRatio : 1;
  return devicePpi(widthPx, heightPx, diagonalInch) / (2.54 * dpr);
}

export function pxPerCmFromRuler(pixelLength: number, cmLength: number): number {
  if (pixelLength <= 0 || cmLength <= 0) {
    throw new Error("pixel length and cm length must be positive");
  }
  return pixelLength / cmLength;
}

export function cssPxPerCell(pxPerCm: number, physicalCellCm: number): number {
  if (pxPerCm <= 0 || physicalCellCm <= 0) {
    throw new Error("pxPerCm and physicalCellCm must be positive");
  }
  return pxPerCm * physicalCellCm;
}

export function physicalZoom(pxPerCm: number, physicalCellCm: number, gridPx: number): number {
  if (gridPx <= 0) {
    throw new Error("gridPx must be positive");
  }
  return cssPxPerCell(pxPerCm, physicalCellCm) / gridPx;
}

export function followGmPanOnly(
  gm: { x: number; y: number; zoom: number },
  lockedZoom: number,
  viewWidth: number,
  viewHeight: number,
): { x: number; y: number; zoom: number } {
  const zoom = gm.zoom > 0 ? gm.zoom : 1;
  const worldCx = (viewWidth / 2 - gm.x) / zoom;
  const worldCy = (viewHeight / 2 - gm.y) / zoom;
  return {
    zoom: lockedZoom,
    x: viewWidth / 2 - worldCx * lockedZoom,
    y: viewHeight / 2 - worldCy * lockedZoom,
  };
}

export function loadCalibration(): ScreenCalibration | null {
  try {
    const raw = localStorage.getItem(CALIBRATION_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as Partial<ScreenCalibration>;
    if (
      typeof parsed.pxPerCm !== "number" ||
      !(parsed.pxPerCm > 0) ||
      typeof parsed.calibratedAt !== "string" ||
      (parsed.method !== "ruler" && parsed.method !== "auto")
    ) {
      return null;
    }
    return {
      pxPerCm: parsed.pxPerCm,
      calibratedAt: parsed.calibratedAt,
      method: parsed.method,
    };
  } catch {
    return null;
  }
}

export function saveCalibration(calibration: ScreenCalibration): void {
  localStorage.setItem(CALIBRATION_KEY, JSON.stringify(calibration));
}

export function loadDisplayMode(): ScreenDisplayMode {
  try {
    const raw = localStorage.getItem(DISPLAY_MODE_KEY);
    return raw === "physical" ? "physical" : "fit";
  } catch {
    return "fit";
  }
}

export function saveDisplayMode(mode: ScreenDisplayMode): void {
  localStorage.setItem(DISPLAY_MODE_KEY, mode);
}

export function loadPhysicalCamera(): PhysicalCameraState | null {
  try {
    const raw = localStorage.getItem(PHYSICAL_CAMERA_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as Partial<PhysicalCameraState>;
    if (typeof parsed.x !== "number" || typeof parsed.y !== "number") {
      return null;
    }
    return { x: parsed.x, y: parsed.y };
  } catch {
    return null;
  }
}

export function savePhysicalCamera(camera: PhysicalCameraState): void {
  localStorage.setItem(PHYSICAL_CAMERA_KEY, JSON.stringify(camera));
}

export function initialScreenDisplayMode(): ScreenDisplayMode {
  return loadDisplayMode();
}

export function initialScreenCalibration(): ScreenCalibration | null {
  return loadCalibration();
}
