import {
  ABOUT_COPY,
  CAP,
  CONTACT,
  DESIGN,
  GLASS,
  IDENTITY,
  LIST,
  NAV,
  type Rect,
} from './design';
import type { Section } from './types';

/**
 * Turns the Figma numbers into screen pixels.
 *
 * Rather than scaling one centred 1440x1024 board — which leaves the whole
 * composition floating in the middle of wide screens — every element keeps the
 * *anchor* it has in the design and only its offset is scaled. The nav stays
 * pinned to the top-left margin, the project list to the right margin, the
 * identity block to the bottom-left, and the card/glass stay centred. So the
 * design scales up on big displays without drifting away from the edges.
 */
export type Box = { left: number; top: number; width: number; height: number };

export type GlassBox = Box & { innerW: number; innerH: number; radius: number };

/**
 * Top of the nav row, in design units. The frame puts it at 90.6 — matching its
 * left margin — which reads as too much air on a shorter viewport, so the row
 * sits tighter to the top edge and its underline follows by the same amount.
 */
const NAV_TOP = 52;

/**
 * The design's gap between the glass frame's right edge (923.31) and the
 * project column (971.04). The frame hangs off the column by this much rather
 * than sitting dead centre, exactly as in the frame.
 */
const LIST_GAP = 971.044 - 923.308;

/**
 * The column has to fit its longest label at the *highlighted* size, which is
 * larger and heavier than the resting size — the design's own node width only
 * covers the resting one, so "Presentations AI" would clip when selected.
 */
const listWidth = (s: number) =>
  LIST.width * (LIST.activeSize / LIST.size) * 1.05 * s;

/**
 * The glass frame takes the clip's own aspect ratio rather than the design's
 * fixed landscape box, so a 9:16 reel isn't letterboxed into a widescreen hole.
 * Area is held constant against the design's inner box so the card carries the
 * same visual weight whichever way round it is, then clamped to the viewport.
 */
export function glassFor(
  aspect: number,
  vw: number,
  vh: number,
  s: number,
  /** Left edge of the project column; the frame must stay clear of it. */
  listLeft = vw,
): GlassBox {
  // Sized from the viewport, not from a fixed design box, so the frame grows and
  // shrinks with the window.
  const gap = LIST_GAP * s;
  const padX = (GLASS.w - GLASS.innerW) * s;
  const padY = (GLASS.h - GLASS.innerH) * s;

  // The right edge is pinned a design-gap short of the column, so the available
  // width is everything between the left margin and that point.
  const boxW = Math.min(vw * 0.42, Math.max(200, listLeft - gap - 24 * s - padX));
  const boxH = vh * 0.62;
  const fit = Math.min(boxW / aspect, boxH);
  const innerH = fit;
  const innerW = fit * aspect;

  const width = innerW + padX;
  const height = innerH + padY;

  return {
    // Hung off the column at the design's spacing rather than centred.
    left: listLeft - gap - width,
    top: vh / 2 - height / 2,
    width,
    height,
    innerW,
    innerH,
    radius: GLASS.radius * s,
  };
}

export type Layout = {
  s: number;
  vw: number;
  vh: number;
  compact: boolean;
  nav: {
    font: number;
    itemW: number;
    itemH: number;
    top: number;
    lefts: number[];
    rules: { left: number; width: number }[];
    ruleTop: number;
  };
  cap: Record<Section, Box>;
  identity: Record<Section, Box> & { name: number; role: number };
  list: {
    left: number;
    width: number;
    height: number;
    centre: number;
    step: number;
    rowH: number;
    size: number;
    activeSize: number;
    /** Mirrored here so the scroll loop can scale its thresholds. */
    s: number;
  };
  glass: GlassBox;
  aboutCopy: { left: number; width: number; font: number };
  contact: {
    card: Box;
    rowFont: number;
    rowH: number;
    rows: number[];
    instaY: number;
    instaMark: number;
    instaInner: number;
    cta: Box & { innerW: number; innerH: number };
    hand: { w: number; h: number };
    left: { cx: number; cy: number; rot: number };
    right: { cx: number; cy: number; rot: number };
  };
};

export function buildLayout(vw: number, vh: number, s: number, compact: boolean): Layout {
  /** Scaled offset from the left edge. */
  const L = (x: number) => x * s;
  /** Scaled offset from the right edge. */
  const R = (x: number) => vw - (DESIGN.w - x) * s;
  /** Scaled offset from the top edge. */
  const T = (y: number) => y * s;
  /** Scaled offset from the bottom edge. */
  const B = (y: number) => vh - (DESIGN.h - y) * s;
  /** Horizontal position relative to the centre. */
  const CX = (x: number) => vw / 2 + (x - DESIGN.w / 2) * s;
  /** Vertical position relative to the centre. */
  const CY = (y: number) => vh / 2 + (y - DESIGN.h / 2) * s;

  /** Bottom-anchored box: keeps the design's gap to the bottom edge. */
  const bottomBox = (r: Rect): Box => ({
    left: L(r.x),
    top: B(r.y + r.h) - r.h * s,
    width: r.w * s,
    height: r.h * s,
  });
  // About: the cap and the name travel together as one block, centred in the
  // accent half rather than pinned to the left margin like on Work.
  const capAboutW = CAP.about.w * s;
  const idAboutH = IDENTITY.about.h * s;
  // The frame's gap between the cap's bottom edge and the name block.
  const capToName = (IDENTITY.about.y - (CAP.about.y + CAP.about.h)) * s;
  const groupH = capAboutW + capToName + idAboutH;
  const groupLeft = vw / 4 - capAboutW / 2;
  const groupTop = vh / 2 - groupH / 2;

  const capAbout: Box = {
    left: groupLeft,
    top: groupTop,
    width: capAboutW,
    height: capAboutW,
  };
  const idAbout: Box = {
    left: groupLeft,
    top: groupTop + capAboutW + capToName,
    width: IDENTITY.about.w * s,
    height: idAboutH,
  };

  const listW = listWidth(s);
  const listLeft = Math.min(
    vw * ((DESIGN.w - LIST.right) / DESIGN.w),
    vw - listW - 32 * s,
  );

  return {
    s,
    vw,
    vh,
    compact,
    nav: {
      font: NAV.size * s,
      itemW: 76.374 * s,
      itemH: 40.915 * s,
      top: T(NAV_TOP),
      lefts: [0, 1, 2].map((i) => L(NAV.x + i * NAV.gap)),
      rules: NAV.rules.map((r) => ({ left: L(r.x), width: r.w * s })),
      // The frame's own gap between the row and its underline.
      ruleTop: T(NAV_TOP + (NAV.ruleY - (NAV.cy - 20.457))),
    },
    cap: {
      work: bottomBox(CAP.work),
      about: capAbout,
      // Slides out to the left of the viewport on Contact.
      contact: { ...capAbout, left: -capAbout.width - 40 },
    },
    identity: {
      work: bottomBox(IDENTITY.work),
      about: idAbout,
      contact: { ...idAbout, top: vh + 40 },
      name: 32 * s,
      role: 20 * s,
    },
    list: {
      // Proportional rather than right-anchored: a fixed scaled gap to the right
      // edge pushes the column too far out as the viewport grows, so hold the
      // design's 67.4% instead — with a floor that keeps the longest label in.
      left: listLeft,
      width: listW,
      height: vh,
      centre: vh / 2,
      step: LIST.step * s,
      rowH: 74 * s,
      size: LIST.size * s,
      activeSize: LIST.activeSize * s,
      s,
    },
    glass: glassFor(GLASS.innerW / GLASS.innerH, vw, vh, s, listLeft),
    aboutCopy: {
      // Centred in the reading half, mirroring the cap block in the accent half.
      left: vw * 0.75 - (ABOUT_COPY.w * s) / 2,
      width: ABOUT_COPY.w * s,
      font: ABOUT_COPY.size * s,
    },
    contact: {
      card: {
        left: CX(DESIGN.w / 2) - (CONTACT.card.w * s) / 2,
        top: CY(DESIGN.h / 2) - (CONTACT.card.h * s) / 2,
        width: CONTACT.card.w * s,
        height: CONTACT.card.h * s,
      },
      rowFont: 20 * s,
      rowH: 53.189 * s,
      rows: CONTACT.rows.map((r) => CY(r.y) - 26.6 * s),
      instaY: CY(CONTACT.instagram.y) - 26.6 * s,
      instaMark: 29.286 * s,
      instaInner: 13.57 * s,
      cta: {
        left: CX(DESIGN.w / 2) - (CONTACT.button.w * s) / 2,
        top: CY(CONTACT.button.y + CONTACT.button.h / 2) - (CONTACT.button.h * s) / 2,
        width: CONTACT.button.w * s,
        height: CONTACT.button.h * s,
        innerW: CONTACT.button.innerW * s,
        innerH: CONTACT.button.innerH * s,
      },
      hand: { w: CONTACT.hand.w * s, h: CONTACT.hand.h * s },
      left: { cx: L(CONTACT.left.cx), cy: CY(CONTACT.left.cy), rot: CONTACT.left.rot },
      right: { cx: R(CONTACT.right.cx), cy: CY(CONTACT.right.cy), rot: CONTACT.right.rot },
    },
  };
}

export const lerpBox = (a: Box, b: Box, t: number): Box => ({
  left: a.left + (b.left - a.left) * t,
  top: a.top + (b.top - a.top) * t,
  width: a.width + (b.width - a.width) * t,
  height: a.height + (b.height - a.height) * t,
});
