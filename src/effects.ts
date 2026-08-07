/**
 * The surface treatment applied to the backdrop and the hands. One shader
 * branch each, selected by the `uMode` uniform.
 */
export type EffectId = 'dither' | 'halftone';

export const EFFECTS: { id: EffectId; label: string; mode: number; hint: string }[] = [
  { id: 'dither', label: 'Dither', mode: 0, hint: '1-bit ordered Bayer' },
  { id: 'halftone', label: 'Halftone', mode: 1, hint: 'rotated dot screen' },
];

export const DEFAULT_EFFECT: EffectId = 'dither';

const STORAGE_KEY = 'mj.effect';

export const modeOf = (id: EffectId) =>
  EFFECTS.find((e) => e.id === id)?.mode ?? 0;

export const loadEffect = (): EffectId => {
  try {
    const v = localStorage.getItem(STORAGE_KEY) as EffectId | null;
    return v && EFFECTS.some((e) => e.id === v) ? v : DEFAULT_EFFECT;
  } catch {
    return DEFAULT_EFFECT;
  }
};

export const saveEffect = (id: EffectId) => {
  try {
    localStorage.setItem(STORAGE_KEY, id);
  } catch {
    /* private mode — the choice simply won't persist */
  }
};
