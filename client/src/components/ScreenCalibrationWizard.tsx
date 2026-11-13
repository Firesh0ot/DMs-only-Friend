import { useEffect, useId, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import {
  pxPerCmFromAuto,
  pxPerCmFromRuler,
  saveCalibration,
  type ScreenCalibration,
} from "../lib/screenCalibration";

type Props = {
  physicalCellCm: number | null;
  onClose: () => void;
  onSaved: (calibration: ScreenCalibration) => void;
};

type Step = 1 | 2 | 3;

export function ScreenCalibrationWizard({ physicalCellCm, onClose, onSaved }: Props) {
  const baseId = useId();
  const [step, setStep] = useState<Step>(1);
  const [diagonalInch, setDiagonalInch] = useState("24");
  const [widthPx, setWidthPx] = useState(() => String(window.screen.width));
  const [heightPx, setHeightPx] = useState(() => String(window.screen.height));
  const [scalePercent, setScalePercent] = useState(() =>
    String(Math.round((window.devicePixelRatio || 1) * 100)),
  );
  const [rulerCm, setRulerCm] = useState("10");
  const [linePx, setLinePx] = useState(360);
  const [fineTuneCm, setFineTuneCm] = useState(physicalCellCm ?? 3);
  const [draftPxPerCm, setDraftPxPerCm] = useState<number | null>(null);
  const [method, setMethod] = useState<"auto" | "ruler">("auto");
  const [message, setMessage] = useState<string | null>(null);
  const dragRef = useRef<{ startX: number; startWidth: number } | null>(null);

  useEffect(() => {
    if (physicalCellCm !== null) {
      setFineTuneCm(physicalCellCm);
    }
  }, [physicalCellCm]);

  function computeAuto(): void {
    try {
      const diagonal = Number(diagonalInch);
      const width = Number(widthPx);
      const height = Number(heightPx);
      const scale = Number(scalePercent) / 100;
      if (!(diagonal > 0 && width > 0 && height > 0 && scale > 0)) {
        setMessage("Enter positive diagonal, resolution, and scale values.");
        return;
      }
      const pxPerCm = pxPerCmFromAuto(width, height, diagonal, scale);
      setDraftPxPerCm(pxPerCm);
      setMethod("auto");
      setMessage(
        `Auto ≈ ${pxPerCm.toFixed(2)} CSS-px/cm. Ruler calibration is more accurate (OS scaling and browser zoom can skew this).`,
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Auto calculation failed");
    }
  }

  function applyRuler(): void {
    try {
      const cm = Number(rulerCm);
      if (!(cm > 0) || !(linePx > 0)) {
        setMessage("Enter a positive ruler length and drag the line.");
        return;
      }
      const pxPerCm = pxPerCmFromRuler(linePx, cm);
      setDraftPxPerCm(pxPerCm);
      setMethod("ruler");
      setMessage(`Ruler → ${pxPerCm.toFixed(2)} CSS-px/cm`);
      setStep(3);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Ruler calibration failed");
    }
  }

  function save(): void {
    if (draftPxPerCm === null || !(draftPxPerCm > 0)) {
      setMessage("Calculate or measure before saving.");
      return;
    }
    let pxPerCm = draftPxPerCm;
    if (physicalCellCm !== null && fineTuneCm > 0) {
      pxPerCm = (draftPxPerCm * physicalCellCm) / fineTuneCm;
    }
    const calibration: ScreenCalibration = {
      pxPerCm,
      calibratedAt: new Date().toISOString(),
      method,
    };
    saveCalibration(calibration);
    onSaved(calibration);
    onClose();
  }

  function onHandlePointerDown(event: ReactPointerEvent<HTMLButtonElement>): void {
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { startX: event.clientX, startWidth: linePx };
  }

  function onHandlePointerMove(event: ReactPointerEvent<HTMLButtonElement>): void {
    const drag = dragRef.current;
    if (!drag) {
      return;
    }
    const next = Math.max(40, Math.round(drag.startWidth + (event.clientX - drag.startX)));
    setLinePx(next);
  }

  function onHandlePointerUp(event: ReactPointerEvent<HTMLButtonElement>): void {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    dragRef.current = null;
  }

  const adjustedPxPerCm =
    draftPxPerCm && physicalCellCm !== null && fineTuneCm > 0
      ? (draftPxPerCm * physicalCellCm) / fineTuneCm
      : draftPxPerCm;
  const previewCellPx =
    adjustedPxPerCm && physicalCellCm ? adjustedPxPerCm * physicalCellCm : null;

  return (
    <div className="screen-modal" role="dialog" aria-modal="true" aria-labelledby={`${baseId}-title`}>
      <div className="screen-modal__card panel stack">
        <header className="row" style={{ justifyContent: "space-between" }}>
          <div>
            <p className="muted">Screen calibration · step {step} of 3</p>
            <h2 id={`${baseId}-title`}>Physical grid size</h2>
          </div>
          <button type="button" className="secondary" onClick={onClose}>
            Close
          </button>
        </header>

        {step === 1 ? (
          <section className="stack">
            <p className="muted">
              Auto estimate from diagonal and resolution. Prefer the ruler step afterward — OS
              scaling and browser zoom make this approximate (often within ~5%).
            </p>
            <label className="stack" htmlFor={`${baseId}-diag`}>
              <span className="muted">Diagonal (inches)</span>
              <input
                id={`${baseId}-diag`}
                inputMode="decimal"
                value={diagonalInch}
                onChange={(event) => setDiagonalInch(event.target.value)}
              />
            </label>
            <div className="row">
              <label className="stack" htmlFor={`${baseId}-w`}>
                <span className="muted">Width (device px)</span>
                <input
                  id={`${baseId}-w`}
                  inputMode="numeric"
                  value={widthPx}
                  onChange={(event) => setWidthPx(event.target.value)}
                />
              </label>
              <label className="stack" htmlFor={`${baseId}-h`}>
                <span className="muted">Height (device px)</span>
                <input
                  id={`${baseId}-h`}
                  inputMode="numeric"
                  value={heightPx}
                  onChange={(event) => setHeightPx(event.target.value)}
                />
              </label>
            </div>
            <label className="stack" htmlFor={`${baseId}-scale`}>
              <span className="muted">OS / browser scale (%)</span>
              <input
                id={`${baseId}-scale`}
                inputMode="numeric"
                value={scalePercent}
                onChange={(event) => setScalePercent(event.target.value)}
              />
            </label>
            <div className="row">
              <button type="button" onClick={computeAuto}>
                Calculate
              </button>
              <button type="button" className="secondary" onClick={() => setStep(2)}>
                Next: ruler
              </button>
            </div>
          </section>
        ) : null}

        {step === 2 ? (
          <section className="stack">
            <p className="muted">
              Lay a ruler on the screen. Drag the handle so the line matches a known length, then
              confirm.
            </p>
            <label className="stack" htmlFor={`${baseId}-ruler-cm`}>
              <span className="muted">Ruler length (cm)</span>
              <input
                id={`${baseId}-ruler-cm`}
                inputMode="decimal"
                value={rulerCm}
                onChange={(event) => setRulerCm(event.target.value)}
              />
            </label>
            <div className="calibration-ruler" aria-label="Calibration ruler line">
              <div className="calibration-ruler__line" style={{ width: `${linePx}px` }}>
                <span className="calibration-ruler__label">{linePx} CSS-px</span>
                <button
                  type="button"
                  className="calibration-ruler__handle"
                  aria-label="Drag to match ruler"
                  onPointerDown={onHandlePointerDown}
                  onPointerMove={onHandlePointerMove}
                  onPointerUp={onHandlePointerUp}
                  onPointerCancel={onHandlePointerUp}
                />
              </div>
            </div>
            <div className="row">
              <button type="button" className="secondary" onClick={() => setStep(1)}>
                Back
              </button>
              <button type="button" onClick={applyRuler}>
                Confirm ruler
              </button>
            </div>
          </section>
        ) : null}

        {step === 3 ? (
          <section className="stack">
            <p className="muted">
              Check one cell against your ruler. Optional fine-tune adjusts the measured px/cm so
              the cell matches what you see.
            </p>
            {physicalCellCm === null ? (
              <p className="error">
                GM has not set a physical cell size yet. You can still save device calibration.
              </p>
            ) : (
              <>
                <div
                  className="calibration-preview-cell"
                  style={{
                    width: previewCellPx ? `${previewCellPx}px` : undefined,
                    height: previewCellPx ? `${previewCellPx}px` : undefined,
                  }}
                  aria-label="Preview cell"
                />
                <label className="stack" htmlFor={`${baseId}-fine`}>
                  <span className="muted">
                    Measured cell edge (cm) · target {physicalCellCm.toFixed(1)} cm
                  </span>
                  <input
                    id={`${baseId}-fine`}
                    type="number"
                    step="0.1"
                    min="0.5"
                    max="30"
                    value={fineTuneCm}
                    onChange={(event) => setFineTuneCm(Number(event.target.value))}
                  />
                </label>
                <div className="row">
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => setFineTuneCm((value) => Math.max(0.5, Number((value - 0.1).toFixed(1))))}
                  >
                    −0.1 cm
                  </button>
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => setFineTuneCm((value) => Math.min(30, Number((value + 0.1).toFixed(1))))}
                  >
                    +0.1 cm
                  </button>
                </div>
              </>
            )}
            <div className="row">
              <button type="button" className="secondary" onClick={() => setStep(2)}>
                Back
              </button>
              <button type="button" onClick={save} disabled={draftPxPerCm === null}>
                Save calibration
              </button>
            </div>
          </section>
        ) : null}

        {message ? <p className="muted">{message}</p> : null}
      </div>
    </div>
  );
}
