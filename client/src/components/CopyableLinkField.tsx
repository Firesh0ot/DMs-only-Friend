import { useEffect, useRef, useState } from "react";
import { copyText } from "../lib/clipboard";

type Props = {
  id: string;
  label: string;
  value: string;
};

export function CopyableLinkField({ id, label, value }: Props) {
  const [copied, setCopied] = useState(false);
  const resetTimer = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (resetTimer.current !== null) {
        window.clearTimeout(resetTimer.current);
      }
    };
  }, []);

  async function onCopy() {
    const ok = await copyText(value);
    if (!ok) {
      return;
    }
    setCopied(true);
    if (resetTimer.current !== null) {
      window.clearTimeout(resetTimer.current);
    }
    resetTimer.current = window.setTimeout(() => {
      setCopied(false);
      resetTimer.current = null;
    }, 1600);
  }

  const labelId = `${id}-label`;
  const statusId = `${id}-copy-status`;

  return (
    <div className="stack settings-link-field">
      <span className="muted" id={labelId}>
        {label}
      </span>
      <div className="row settings-link-row">
        <input
          id={id}
          readOnly
          value={value}
          aria-labelledby={labelId}
          onFocus={(event) => event.target.select()}
        />
        <button
          type="button"
          className="secondary"
          onClick={() => void onCopy()}
          aria-label={copied ? `${label} copied` : `Copy ${label}`}
          aria-describedby={statusId}
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <span id={statusId} className="visually-hidden" role="status" aria-live="polite">
        {copied ? "Copied" : ""}
      </span>
    </div>
  );
}
