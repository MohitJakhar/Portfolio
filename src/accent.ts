/**
 * The site has a single accent hue (the Figma red, #ff3939). It drives the
 * About panel, the Contact card, the cap overlay and the dither tint, so it
 * lives in one place and is published both as CSS custom properties and as a
 * shader uniform.
 */
export const DEFAULT_ACCENT = '#ff3939';
const STORAGE_KEY = 'mj.accent';

export type Rgb = [number, number, number];

export const hexToRgb = (hex: string): Rgb => {
  const h = hex.replace('#', '').trim();
  const full =
    h.length === 3
      ? h
          .split('')
          .map((c) => c + c)
          .join('')
      : h;
  const n = parseInt(full.slice(0, 6), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
};

const toByte = (v: number) => Math.max(0, Math.min(255, Math.round(v * 255)));
const rgbToHex = ([r, g, b]: Rgb) =>
  '#' + [r, g, b].map((v) => toByte(v).toString(16).padStart(2, '0')).join('');

/** Mix towards white — used for the lighter card / on-paper text variants. */
const lighten = (rgb: Rgb, amount: number): Rgb =>
  rgb.map((v) => v + (1 - v) * amount) as Rgb;

export function applyAccent(hex: string) {
  const rgb = hexToRgb(hex);
  const soft = lighten(rgb, 0.14);
  const root = document.documentElement.style;
  root.setProperty('--accent', hex);
  root.setProperty('--accent-soft', rgbToHex(soft));
  root.setProperty('--accent-veil', `rgba(${toByte(rgb[0])}, ${toByte(rgb[1])}, ${toByte(rgb[2])}, 0.23)`);
  root.setProperty('--accent-rgb', `${toByte(rgb[0])} ${toByte(rgb[1])} ${toByte(rgb[2])}`);
  return rgb;
}

export const loadAccent = () => {
  try {
    return localStorage.getItem(STORAGE_KEY) || DEFAULT_ACCENT;
  } catch {
    return DEFAULT_ACCENT;
  }
};

export const saveAccent = (hex: string) => {
  try {
    localStorage.setItem(STORAGE_KEY, hex);
  } catch {
    /* private mode — accent simply won't persist */
  }
};

/** A handful of presets next to the eyedropper, so it's usable in one click. */
export const PRESETS = [
  DEFAULT_ACCENT,
  '#ff7a18',
  '#ffd23f',
  '#3ddc84',
  '#2f9bff',
  '#8b5cf6',
  '#ff5ea8',
  '#e8e8e8',
];
