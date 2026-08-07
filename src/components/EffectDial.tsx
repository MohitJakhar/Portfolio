import { useEffect, useRef, useState } from 'react';
import { EFFECTS, type EffectId } from '../effects';

type Props = {
  value: EffectId;
  onChange: (id: EffectId) => void;
};

/** Sits above the accent dial and switches the surface treatment. */
export function EffectDial({ value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

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

  const current = EFFECTS.find((e) => e.id === value) ?? EFFECTS[0];

  return (
    <div className="dial" ref={root}>
      {open && (
        <div className="dial__panel" role="dialog" aria-label="Surface effect">
          <ul className="dial__list">
            {EFFECTS.map((e) => (
              <li key={e.id}>
                <button
                  type="button"
                  className="dial__option"
                  aria-pressed={e.id === value}
                  onClick={() => {
                    onChange(e.id);
                    setOpen(false);
                  }}
                >
                  <span className={`dial__chip dial__chip--${e.id}`} aria-hidden />
                  <span className="dial__option-text">
                    {e.label}
                    <em>{e.hint}</em>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <button
        type="button"
        className="dial__button dial__button--effect"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`Surface effect: ${current.label}`}
        title={current.label}
        onClick={() => setOpen((v) => !v)}
      >
        <span className={`dial__chip dial__chip--${current.id}`} aria-hidden />
      </button>
    </div>
  );
}
