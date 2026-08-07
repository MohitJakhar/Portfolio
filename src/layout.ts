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
 * Desktop keeps the design's composition: rather than scaling one centred
 * 1440x1024 board — which leaves everything floating in the middle of a wide
 * screen — each element keeps the *anchor* it has in the frame and only its
 * offset is scaled. Nav to the top-left margin, the project list to the right,
 * the identity block to the bottom-left, card and frame centred.
 *
 * Below 760px that composition stops working at all, so `compactLayout` replaces
 * it with a vertical stack sized from the viewport. Both branches return the same
 * shape, so no component knows which one it is looking at.
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
const listWidth = (s: number) => LIST.width * (LIST.activeSize / LIST.size) * 1.05 * s;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

// ---------------------------------------------------------------------------
// Compact metrics. Everything the phone layout needs in one place.
// ---------------------------------------------------------------------------
const M = (vw: number) => clamp(vw * 0.055, 16, 26);
const NAV_H = 30;
const NAV_TOP_SM = 18;
/** Reserved height for the clip frame. Fixed, so the list never jumps when a
 *  portrait clip follows a landscape one. */
const CARD_BAND = (vh: number) => vh * 0.3;
const CAP_SM = 84;
const ID_SM = 58;
/** Share of the screen the About accent panel takes on a phone. */
const ABOUT_PANEL = 0.52;

const cardTopSm = () => NAV_TOP_SM + NAV_H + 20;

/**
 * The glass frame takes the clip's own aspect ratio rather than the design's
 * fixed landscape box, so a 9:16 reel isn't letterboxed into a widescreen hole.
 */
export function glassFor(
  aspect: number,
  vw: number,
  vh: number,
  s: number,
  /** Left edge of the project column; the frame must stay clear of it. */
  listLeft = vw,
  compact = false,
): GlassBox {
  if (compact) {
    const m = M(vw);
    const padX = 8;
    const padY = 9;
    const band = CARD_BAND(vh);
    // Fit the clip inside the reserved band, full width where it can be.
    const innerH = Math.min((vw - 2 * m - padX) / aspect, band - padY);
    const innerW = innerH * aspect;
    const width = innerW + padX;
    const height = innerH + padY;
    return {
      left: vw / 2 - width / 2,
      top: cardTopSm() + (band - height) / 2,
      width,
      height,
      innerW,
      innerH,
      radius: 8,
    };
  }

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

  const width = fit * aspect + padX;
  const height = fit + padY;

  return {
    // Hung off the column at the design's spacing rather than centred.
    left: listLeft - gap - width,
    top: vh / 2 - height / 2,
    width,
    height,
    innerW: fit * aspect,
    innerH: fit,
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
    top: number;
    width: number;
    height: number;
    /** Centre line, relative to the list box. */
    centre: number;
    step: number;
    rowH: number;
    size: number;
    activeSize: number;
    /** Mirrored here so the scroll loop can scale its thresholds. */
    s: number;
  };
  glass: GlassBox;
  aboutCopy: { left: number; top: number; width: number; font: number };
  /** Accent panel share of its axis, and which axis the shader splits on. */
  split: { fraction: number; vertical: boolean };
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
  return compact ? compactLayout(vw, vh) : desktopLayout(vw, vh, s);
}

// ---------------------------------------------------------------------------
// Phone: one vertical stack, sized from the viewport.
// ---------------------------------------------------------------------------
function compactLayout(vw: number, vh: number): Layout {
  const m = M(vw);
  const band = CARD_BAND(vh);
  const cardTop = cardTopSm();

  // Work: cap and name sit at the foot, the list fills what is left between them
  // and the clip frame.
  const idTop = vh - m - ID_SM;
  const capTop = idTop - 10 - CAP_SM;
  const listTop = cardTop + band + 16;
  const listH = Math.max(140, capTop - 14 - listTop);

  // About: the panel is a horizontal band across the top, with the cap and name
  // centred in it and the copy on the paper below.
  const panelH = vh * ABOUT_PANEL;
  const capAbout = Math.min(vw - 2 * m, panelH * 0.62);
  const aboutBlockTop = (panelH - (capAbout + 12 + ID_SM)) / 2;

  const glass = glassFor(GLASS.innerW / GLASS.innerH, vw, vh, 1, vw, true);

  // Contact: a full-width card, with the details placed at the design's own
  // proportions inside it so the composition survives the reshape.
  const cardW = vw - 2 * m;
  const cardH = Math.min(vh * 0.5, 400);
  const cardTopC = vh / 2 - cardH / 2;
  const frac = (y: number) => (y - 225.966) / CONTACT.card.h;
  const handW = vw * 0.78;

  const navItemW = 62;
  const navLefts = [0, 1, 2].map((i) => m + i * (navItemW + 6));
  const navTextW = [30, 36, 47];

  return {
    s: 1,
    vw,
    vh,
    compact: true,
    nav: {
      font: 15,
      itemW: navItemW,
      itemH: NAV_H,
      top: NAV_TOP_SM,
      lefts: navLefts,
      rules: navLefts.map((left, i) => ({
        left: left + (navItemW - navTextW[i]) / 2,
        width: navTextW[i],
      })),
      ruleTop: NAV_TOP_SM + NAV_H - 6,
    },
    cap: {
      work: { left: m, top: capTop, width: CAP_SM, height: CAP_SM },
      about: {
        left: vw / 2 - capAbout / 2,
        top: aboutBlockTop,
        width: capAbout,
        height: capAbout,
      },
      contact: {
        left: -capAbout - 40,
        top: aboutBlockTop,
        width: capAbout,
        height: capAbout,
      },
    },
    identity: {
      work: { left: m, top: idTop, width: vw - 2 * m, height: ID_SM },
      about: {
        left: vw / 2 - capAbout / 2,
        top: aboutBlockTop + capAbout + 12,
        width: capAbout,
        height: ID_SM,
      },
      contact: { left: m, top: vh + 40, width: vw - 2 * m, height: ID_SM },
      name: 22,
      role: 13,
    },
    list: {
      left: m,
      top: listTop,
      width: vw - 2 * m,
      height: listH,
      centre: listH / 2,
      step: 44,
      rowH: 40,
      size: 26,
      activeSize: 30,
      s: 1,
    },
    glass,
    aboutCopy: { left: m, top: panelH + 24, width: vw - 2 * m, font: 15 },
    split: { fraction: ABOUT_PANEL, vertical: true },
    contact: {
      card: { left: m, top: cardTopC, width: cardW, height: cardH },
      rowFont: 15,
      rowH: 34,
      rows: CONTACT.rows.map((r) => cardTopC + frac(r.y) * cardH - 17),
      instaY: cardTopC + frac(CONTACT.instagram.y) * cardH - 17,
      instaMark: 20,
      instaInner: 9,
      cta: {
        left: vw / 2 - 84,
        top: cardTopC + frac(CONTACT.button.y) * cardH,
        width: 168,
        height: 56,
        innerW: 158,
        innerH: 47,
      },
      hand: { w: handW, h: handW / (CONTACT.hand.w / CONTACT.hand.h) },
      // Low enough that the fingers reach the card without landing on the CTA.
      left: { cx: vw * 0.04, cy: vh * 0.86, rot: CONTACT.left.rot },
      right: { cx: vw * 0.92, cy: vh * 0.26, rot: CONTACT.right.rot },
    },
  };
}

// ---------------------------------------------------------------------------
// Desktop: the design's own composition, anchored per element.
// ---------------------------------------------------------------------------
function desktopLayout(vw: number, vh: number, s: number): Layout {
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
  const capToName = (IDENTITY.about.y - (CAP.about.y + CAP.about.h)) * s;
  const groupH = capAboutW + capToName + idAboutH;
  const groupLeft = vw / 4 - capAboutW / 2;
  const groupTop = vh / 2 - groupH / 2;

  const capAbout: Box = { left: groupLeft, top: groupTop, width: capAboutW, height: capAboutW };
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
    compact: false,
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
      top: 0,
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
      top: 0,
      width: ABOUT_COPY.w * s,
      font: ABOUT_COPY.size * s,
    },
    split: { fraction: 0.5, vertical: false },
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
