import { useEffect, useState } from 'react';
import { DESIGN } from './design';

export type Viewport = {
  vw: number;
  vh: number;
  /** Scale from design space to screen space (desktop only). */
  s: number;
  /** Phone-shaped: the anchored desktop composition is replaced by a stack. */
  compact: boolean;
  /** No hover available — drives tap-to-select instead of hover-to-preview. */
  touch: boolean;
  /** Backing-store multiplier for the shader canvases. */
  renderScale: number;
  /** Ship the light media variants and the cheap shader path. */
  lowPower: boolean;
  reducedMotion: boolean;
};

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

const query = (q: string) =>
  typeof window.matchMedia === 'function' ? window.matchMedia(q).matches : false;

const measure = (): Viewport => {
  // visualViewport tracks the area actually visible, so a collapsing address bar
  // doesn't leave the layout believing it has height it can't use.
  const vw = Math.round(window.visualViewport?.width ?? window.innerWidth);
  const vh = Math.round(window.visualViewport?.height ?? window.innerHeight);
  const compact = vw < 760;
  const touch = query('(hover: none)');
  const reducedMotion = query('(prefers-reduced-motion: reduce)');

  // Phone GPUs pay per fragment, and a full-resolution 1-bit screen at DPR 3 is
  // a lot of fragments for a pattern that is deliberately chunky. Rendering the
  // backdrop a little under native and capping the ratio is invisible here and
  // roughly halves the fill cost.
  const dprCap = compact ? 2 : 2;
  const under = compact ? 0.75 : 1;
  const renderScale = Math.min(window.devicePixelRatio || 1, dprCap) * under;

  return {
    vw,
    vh,
    s: compact ? 1 : clamp(Math.min(vw / DESIGN.w, vh / DESIGN.h), 0.5, 2.2),
    compact,
    touch,
    renderScale,
    lowPower: compact,
    reducedMotion,
  };
};

/**
 * On desktop the layout is a 1440x1024 design space, scaled and anchored per
 * element (see layout.ts). Below 760px it becomes a vertical stack sized from
 * the viewport instead. `--s` is published so CSS can scale alongside.
 */
export function useViewport(): Viewport {
  const [vp, setVp] = useState(measure);

  useEffect(() => {
    let frame = 0;
    const onResize = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => setVp(measure()));
    };
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
    window.visualViewport?.addEventListener('resize', onResize);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onResize);
      window.visualViewport?.removeEventListener('resize', onResize);
    };
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--s', String(vp.s));
    root.style.setProperty('--vh', `${vp.vh}px`);
    root.classList.toggle('is-compact', vp.compact);
  }, [vp.s, vp.vh, vp.compact]);

  return vp;
}
