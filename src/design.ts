/**
 * Geometry lifted straight out of the Figma frames (1440 x 1024 design space).
 * Everything on screen is expressed in these numbers and multiplied by the
 * runtime scale `--s`, so the layout stays proportional to the design at any
 * viewport size.
 */
export const DESIGN = { w: 1440, h: 1024 } as const;

export type Rect = { x: number; y: number; w: number; h: number };

export const NAV = {
  /** Left edge of "Work". */
  x: 87.18,
  /** Vertical centre of the row. */
  cy: 111.04,
  gap: 106.54,
  size: 20,
  /** Underline geometry per item, straight from the Vector 1 nodes. */
  rules: [
    { x: 95.32, w: 60.106 },
    { x: 196.16, w: 71.509 },
    { x: 297.19, w: 82.535 },
  ],
  ruleY: 124.6,
} as const;

/** The cap photo — the element shared between Work and About. */
export const CAP: Record<'work' | 'about' | 'contact', Rect> = {
  work: { x: 89.93, y: 687.51, w: 220.944, h: 220.944 },
  about: { x: 87.18, y: 230.242, w: 563.516, h: 563.516 },
  // Not in the Contact frame: it exits to the left, same size as About.
  contact: { x: -640, y: 230.242, w: 563.516, h: 563.516 },
};

/** "Mohit Jakhar / Motion Graphics Designer" — also shared. */
export const IDENTITY: Record<'work' | 'about' | 'contact', Rect> = {
  work: { x: 89.93, y: 896.033, w: 351.867, h: 106.378 },
  about: { x: 87.18, y: 805.896, w: 351.867, h: 106.378 },
  contact: { x: 87.18, y: 1080, w: 351.867, h: 106.378 },
};

/** Work: the right-hand project list. */
export const LIST = {
  /** Left edge of the labels, measured from the right edge of the frame. */
  right: DESIGN.w - 971.044,
  width: 426.877,
  /** Vertical rhythm between rows. */
  step: 83.19,
  size: 56,
  activeSize: 60,
} as const;

/** Work: the glass card that appears on hover. */
export const GLASS = {
  /** Centre offset from frame centre. */
  cx: -79.04,
  cy: 0,
  w: 564.702,
  h: 364.944,
  innerW: 552.073,
  innerH: 349.82,
  radius: 10,
} as const;

/** About: the body copy column. */
export const ABOUT_COPY = {
  /** Offset from the panel edge (which sits at 50vw). */
  dx: 775.682 - DESIGN.w / 2,
  w: 582.954,
  size: 24,
} as const;

/** Contact. */
export const CONTACT = {
  card: { w: 804.471, h: 572.069 },
  /** Rows are centred on the frame's horizontal centre. */
  rows: [
    { label: 'Mohitjakhar@msn.com', y: 381.19, href: 'mailto:Mohitjakhar@msn.com' },
    { label: '+91 9958013963', y: 434.38, href: 'tel:+919958013963' },
  ],
  instagram: { y: 485.41, handle: '/Neq_uam', href: 'https://instagram.com/Neq_uam' },
  button: { y: 670.96, w: 204.768, h: 75.404, innerW: 192.656, innerH: 62.516 },
  hand: { w: 670.654, h: 840.953 },
  /** Resting placement of each hand: centre point + rotation, design space. */
  left: { cx: 163.56, cy: 619.57, rot: -25.84 },
  right: { cx: 1194.43, cy: 228.56, rot: -23.33 },
} as const;

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export const lerpRect = (a: Rect, b: Rect, t: number): Rect => ({
  x: lerp(a.x, b.x, t),
  y: lerp(a.y, b.y, t),
  w: lerp(a.w, b.w, t),
  h: lerp(a.h, b.h, t),
});

/** Smooth, symmetric ease used for every section transition. */
export const easeInOut = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
