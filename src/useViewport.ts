import { useEffect, useState } from 'react';
import { DESIGN } from './design';

export type Viewport = {
  vw: number;
  vh: number;
  /** Scale from design space to screen space. */
  s: number;
  /** Below this width the design-space stage is abandoned for a flow layout. */
  compact: boolean;
};

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

const measure = (): Viewport => {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const compact = vw < 640;
  // Scales up on large displays, down to half size on small windows. Positions
  // stay anchored to the viewport edges, so only the size changes.
  const s = compact ? 1 : clamp(Math.min(vw / DESIGN.w, vh / DESIGN.h), 0.5, 2.2);
  return { vw, vh, s, compact };
};

/**
 * The desktop layout is a 1440x1024 stage scaled to fit and centred, which lets
 * every component position itself in raw Figma coordinates. `--s` is published
 * so CSS can un-scale things (like the accent dial) that should stay 1:1.
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
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onResize);
    };
  }, []);

  useEffect(() => {
    document.documentElement.style.setProperty('--s', String(vp.s));
    document.documentElement.classList.toggle('is-compact', vp.compact);
  }, [vp.s, vp.compact]);

  return vp;
}
