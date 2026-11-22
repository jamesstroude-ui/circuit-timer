// Shared parts for the non-player screens: top bar, stepper, switch, chips.
// Tap targets are at least 48 px (SPEC 8.4).

import type { ReactNode } from 'react';

export function TopBar({ title, onBack, backLabel = 'Back', right }: {
  title: string;
  onBack?: () => void;
  backLabel?: string;
  right?: ReactNode;
}) {
  return (
    <header className="topbar">
      <div className="topbar-side">
        {onBack && (
          <button className="link-btn" onClick={onBack}>
            ‹ {backLabel}
          </button>
        )}
      </div>
      <h1 className="topbar-title">{title}</h1>
      <div className="topbar-side topbar-right">{right}</div>
    </header>
  );
}

/** A number with − and + buttons. */
export function Stepper({ value, onChange, min, max, step = 5, unit = 's', label }: {
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  label: string;
}) {
  const set = (v: number) => onChange(Math.min(max, Math.max(min, v)));
  return (
    <div className="stepper" role="group" aria-label={label}>
      <button className="step-btn" onClick={() => set(value - step)} disabled={value <= min} aria-label={`${label} minus ${step}`}>
        −
      </button>
      <span className="step-val">
        {value}
        {unit && <small> {unit}</small>}
      </span>
      <button className="step-btn" onClick={() => set(value + step)} disabled={value >= max} aria-label={`${label} plus ${step}`}>
        +
      </button>
    </div>
  );
}

/** An on/off row: label and hint on the left, switch on the right. The whole row is the button. */
export function SwitchRow({ label, hint, on, onChange }: {
  label: string;
  hint?: string;
  on: boolean;
  onChange: (on: boolean) => void;
}) {
  return (
    <button className="switch-row" role="switch" aria-checked={on} aria-label={label} onClick={() => onChange(!on)}>
      <span className="switch-text">
        <span>{label}</span>
        {hint && <small>{hint}</small>}
      </span>
      <span className={`switch ${on ? 'on' : ''}`} aria-hidden="true">
        <span className="knob" />
      </span>
    </button>
  );
}

/** Pick one of a few options. */
export function Chips<T extends string>({ options, value, onChange, label }: {
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div className="chips" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          role="radio"
          aria-checked={o.value === value}
          className={`chip ${o.value === value ? 'on' : ''}`}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: ReactNode }) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {children}
      {hint && <span className="field-hint">{hint}</span>}
    </label>
  );
}
