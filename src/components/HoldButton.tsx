// A button that acts only after a press and hold (SPEC 6.3: End = hold 1.5 s).
// A fill bar shows the progress. Letting go early cancels.

import { useRef, useState } from 'react';

interface Props {
  label: string;
  hint: string;
  holdMs: number;
  onHold: () => void;
  className?: string;
}

export function HoldButton({ label, hint, holdMs, onHold, className = '' }: Props) {
  const timer = useRef(0);
  const [holding, setHolding] = useState(false);

  const begin = (e: React.PointerEvent) => {
    e.preventDefault();
    setHolding(true);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      setHolding(false);
      onHold();
    }, holdMs);
  };
  const cancel = () => {
    window.clearTimeout(timer.current);
    setHolding(false);
  };

  return (
    <button
      className={`hold ${holding ? 'holding' : ''} ${className}`}
      style={{ '--hold-ms': `${holdMs}ms` } as React.CSSProperties}
      onPointerDown={begin}
      onPointerUp={cancel}
      onPointerLeave={cancel}
      onPointerCancel={cancel}
      onContextMenu={(e) => e.preventDefault()}
      aria-label={`${label} (press and hold)`}
    >
      <span className="hold-fill" aria-hidden="true" />
      <span className="hold-text">
        {label}
        <small>{holding ? 'keep holding' : hint}</small>
      </span>
    </button>
  );
}
