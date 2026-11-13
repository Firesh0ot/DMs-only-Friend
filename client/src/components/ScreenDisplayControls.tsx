import { useEffect, useState } from "react";
import { ServerEvents, type RoomSettings } from "@dms/shared";
import {
  saveDisplayMode,
  type ScreenCalibration,
  type ScreenDisplayMode,
} from "../lib/screenCalibration";
import { getSocket } from "../socket/socket";
import { ScreenCalibrationWizard } from "./ScreenCalibrationWizard";

type Props = {
  settings: RoomSettings;
  mode: ScreenDisplayMode;
  calibration: ScreenCalibration | null;
  onModeChange: (mode: ScreenDisplayMode) => void;
  onCalibrationChange: (calibration: ScreenCalibration) => void;
};

export function ScreenDisplayControls({
  settings,
  mode,
  calibration,
  onModeChange,
  onCalibrationChange,
}: Props) {
  const [wizardOpen, setWizardOpen] = useState(false);
  const [confirmPhysical, setConfirmPhysical] = useState(false);

  useEffect(() => {
    const socket = getSocket();
    function onCommand(payload: { type: string }) {
      if (payload.type === "open-calibration") {
        setWizardOpen(true);
      }
    }
    socket.on(ServerEvents.ScreenCommand, onCommand);
    return () => {
      socket.off(ServerEvents.ScreenCommand, onCommand);
    };
  }, []);

  useEffect(() => {
    if (mode === "physical" && !calibration) {
      setWizardOpen(true);
    }
  }, [mode, calibration]);

  function requestPhysical(): void {
    if (settings.physicalCellCm === null) {
      return;
    }
    setConfirmPhysical(true);
  }

  function confirmEnablePhysical(): void {
    setConfirmPhysical(false);
    saveDisplayMode("physical");
    onModeChange("physical");
    if (!calibration) {
      setWizardOpen(true);
    }
  }

  function enableFit(): void {
    saveDisplayMode("fit");
    onModeChange("fit");
    setConfirmPhysical(false);
  }

  return (
    <>
      <div className="screen-display-controls row">
        {mode === "physical" && settings.physicalCellCm !== null ? (
          <span className="screen-display-controls__status muted">
            1 cell = {settings.physicalCellCm.toFixed(1)} cm
          </span>
        ) : null}
        {mode === "fit" ? (
          <button
            type="button"
            className="secondary"
            disabled={settings.physicalCellCm === null}
            title={
              settings.physicalCellCm === null
                ? "GM must set physical cell size in Settings first"
                : "Switch to physical cell size"
            }
            onClick={requestPhysical}
          >
            Physical size
          </button>
        ) : (
          <button type="button" className="secondary" onClick={enableFit}>
            Fit mode
          </button>
        )}
        <button type="button" className="secondary" onClick={() => setWizardOpen(true)}>
          Calibrate
        </button>
      </div>

      {confirmPhysical ? (
        <div className="screen-modal" role="dialog" aria-modal="true" aria-label="Confirm physical mode">
          <div className="screen-modal__card panel stack">
            <h2>Enable physical size?</h2>
            <p className="muted">
              Zoom locks to the calibrated cell size. Pan stays available; GM zoom follow is paused.
            </p>
            <div className="row">
              <button type="button" className="secondary" onClick={() => setConfirmPhysical(false)}>
                Cancel
              </button>
              <button type="button" onClick={confirmEnablePhysical}>
                Enable
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {wizardOpen ? (
        <ScreenCalibrationWizard
          physicalCellCm={settings.physicalCellCm}
          onClose={() => setWizardOpen(false)}
          onSaved={(next) => onCalibrationChange(next)}
        />
      ) : null}
    </>
  );
}
