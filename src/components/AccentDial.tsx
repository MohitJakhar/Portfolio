import { useEffect, useRef, useState } from 'react';
import { PRESETS } from '../accent';

type Props = {
  value: string;
  onChange: (hex: string) => void;
};

/** The little accent dial in the bottom-right corner. */
export function AccentDial({ value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('pointerdown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className="dial" ref={root}>
      {open && (
        <div className="dial__panel" role="dialog" aria-label="Accent colour">
          <div className="dial__swatches">
            {PRESETS.map((hex) => (
              <button
                key={hex}
                type="button"
                className="dial__swatch"
                style={{ background: hex }}
                aria-label={`Set accent to ${hex}`}
                aria-pressed={hex.toLowerCase() === value.toLowerCase()}
                onClick={() => onChange(hex)}
              />
            ))}
          </div>
          <button
            type="button"
            className="dial__custom"
            onClick={() => input.current?.click()}
          >
            <span className="dial__custom-chip" style={{ background: value }} />
            {value.toUpperCase()}
          </button>
          <input
            ref={input}
            className="dial__input"
            type="color"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            aria-label="Pick a custom accent colour"
            tabIndex={-1}
          />
        </div>
      )}

      <button
        type="button"
        className="dial__button"
        style={{ background: value }}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label="Change accent colour"
        onClick={() => setOpen((v) => !v)}
      />
    </div>
  );
}
