import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AccentDial } from './components/AccentDial';
import { EffectDial } from './components/EffectDial';
import { Nav } from './components/Nav';
import { SharedLayer } from './components/SharedLayer';
import { About } from './sections/About';
import { Contact } from './sections/Contact';
import { Work } from './sections/Work';
import { Backdrop } from './gl/Backdrop';
import { Hands } from './gl/Hands';
import { applyAccent, hexToRgb, loadAccent, saveAccent } from './accent';
import { loadEffect, modeOf, saveEffect, type EffectId } from './effects';
import { easeInOut } from './design';
import { buildLayout } from './layout';
import { bestSrc, plate, poster, projects } from './data/projects';
import { useViewport } from './useViewport';
import type { Section, Weights } from './types';

const ORDER: Section[] = ['work', 'about', 'contact'];
const DURATION = 900;
/** The frame keeps the hands neutral grey; a touch of accent just warms them. */
const HAND_TINT = 0.12;

export default function App() {
  const vp = useViewport();
  const layout = useMemo(
    () => buildLayout(vp.vw, vp.vh, vp.s, vp.compact),
    [vp.vw, vp.vh, vp.s, vp.compact],
  );

  const bgCanvas = useRef<HTMLCanvasElement>(null);
  const bgVideo = useRef<HTMLVideoElement>(null);
  const handsCanvas = useRef<HTMLCanvasElement>(null);
  const backdrop = useRef<Backdrop | null>(null);
  const hands = useRef<Hands | null>(null);

  const [accent, setAccent] = useState(loadAccent);
  const [effect, setEffect] = useState<EffectId>(loadEffect);
  const [trans, setTrans] = useState<{ from: Section; to: Section; t: number }>({
    from: 'work',
    to: 'work',
    t: 1,
  });
  const [highlight, setHighlight] = useState(projects[0].slug);

  // ---- accent -------------------------------------------------------------
  useEffect(() => {
    applyAccent(accent);
    saveAccent(accent);
    const rgb = hexToRgb(accent);
    backdrop.current?.setAccent(rgb);
    hands.current?.setAccent(rgb, HAND_TINT);
  }, [accent]);

  // ---- surface effect -----------------------------------------------------
  useEffect(() => {
    saveEffect(effect);
    const mode = modeOf(effect);
    backdrop.current?.setMode(mode);
    hands.current?.setMode(mode);
  }, [effect]);

  // ---- shaders ------------------------------------------------------------
  useEffect(() => {
    if (!bgCanvas.current) return;
    try {
      backdrop.current = new Backdrop(bgCanvas.current);
      backdrop.current.setAccent(hexToRgb(loadAccent()));
      backdrop.current.setMode(modeOf(loadEffect()));
    } catch (err) {
      console.warn('backdrop unavailable:', err);
      document.documentElement.classList.add('no-webgl');
    }
    return () => {
      backdrop.current?.dispose();
      backdrop.current = null;
    };
  }, []);

  useEffect(() => {
    if (!handsCanvas.current) return;
    try {
      hands.current = new Hands(handsCanvas.current, [
        '/img/hand-left.png',
        '/img/hand-right.png',
      ]);
      hands.current.setAccent(hexToRgb(loadAccent()), HAND_TINT);
      hands.current.setMode(modeOf(loadEffect()));
    } catch (err) {
      console.warn('hands unavailable:', err);
    }
    return () => {
      hands.current?.dispose();
      hands.current = null;
    };
  }, []);

  // ---- pointer, shared by both passes ------------------------------------
  useEffect(() => {
    const move = (e: PointerEvent) => {
      backdrop.current?.pointer(e.clientX, e.clientY, true);
      hands.current?.pointer(e.clientX, e.clientY, true);
    };
    const leave = () => {
      backdrop.current?.pointer(-9999, -9999, false);
      hands.current?.pointer(-9999, -9999, false);
    };
    const down = () => {
      backdrop.current?.impulse();
      hands.current?.impulse();
    };
    window.addEventListener('pointermove', move, { passive: true });
    window.addEventListener('pointerdown', down, { passive: true });
    window.addEventListener('pointerleave', leave);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerdown', down);
      window.removeEventListener('pointerleave', leave);
    };
  }, []);

  // ---- backdrop follows the highlighted project ---------------------------
  // There is exactly one clip element on the page. It is rendered inside the
  // glass frame *and* uploaded into the backdrop texture each tick, so the card
  // and the background are the same decoded frame — two elements playing the
  // same file drift apart within seconds.
  const current = projects.find((x) => x.slug === highlight) ?? projects[0];
  useEffect(() => {
    const v = bgVideo.current;
    if (v && v.dataset.slug !== current.slug) {
      v.dataset.slug = current.slug;
      v.src = bestSrc(current);
      v.load();
      void v.play().catch(() => {
        /* blocked until the first interaction — the poster carries it */
      });
    }
    void backdrop.current?.setSource(plate(current), v);
  }, [current]);

  // ---- section transition -------------------------------------------------
  const raf = useRef(0);
  const go = useCallback((next: Section) => {
    setTrans((cur) => (cur.to === next ? cur : { from: cur.to, to: next, t: 0 }));
  }, []);

  useEffect(() => {
    if (trans.t >= 1) return;
    const start = performance.now();
    const step = (now: number) => {
      const raw = Math.min(1, (now - start) / DURATION);
      setTrans((cur) => ({ ...cur, t: raw }));
      if (raw < 1) raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf.current);
    // Restart only when a new transition begins, not on every progress tick.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trans.from, trans.to]);

  const eased = easeInOut(trans.t);
  const t = trans.from === trans.to ? 1 : eased;

  const weights: Weights = useMemo(() => {
    const w: Weights = { work: 0, about: 0, contact: 0 };
    if (trans.from === trans.to) w[trans.to] = 1;
    else {
      w[trans.from] = 1 - eased;
      w[trans.to] = eased;
    }
    return w;
  }, [trans.from, trans.to, eased]);

  useEffect(() => {
    backdrop.current?.setWeights(weights);
  }, [weights]);

  // Don't decode a clip nobody is looking at.
  const workVisible = weights.work > 0.02;
  useEffect(() => {
    const v = bgVideo.current;
    if (!v) return;
    if (workVisible) void v.play().catch(() => {});
    else v.pause();
  }, [workVisible]);

  // ---- hand placement: slides in from the sides as Contact arrives --------
  useEffect(() => {
    const h = hands.current;
    if (!h) return;
    const c = layout.contact;
    const p = weights.contact;
    // Ease the slide so the hands settle a beat after the fade.
    const slide = 1 - Math.pow(1 - p, 2);
    const travel = layout.vw * 0.42;

    h.place(0, {
      cx: c.left.cx - travel * (1 - slide),
      cy: c.left.cy + 60 * (1 - slide) * layout.s,
      w: c.hand.w,
      h: c.hand.h,
      rot: c.left.rot,
      alpha: p,
    });
    h.place(1, {
      cx: c.right.cx + travel * (1 - slide),
      cy: c.right.cy - 60 * (1 - slide) * layout.s,
      w: c.hand.w,
      h: c.hand.h,
      rot: c.right.rot,
      alpha: p,
    });
  }, [weights.contact, layout]);

  // ---- keyboard shortcut: left/right through the sections -----------------
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      if ((e.target as HTMLElement | null)?.closest('.worklist')) return;
      const i = ORDER.indexOf(trans.to);
      const next = ORDER[Math.max(0, Math.min(ORDER.length - 1, i + (e.key === 'ArrowRight' ? 1 : -1)))];
      go(next);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [trans.to, go]);

  return (
    <>
      <canvas ref={bgCanvas} className="backdrop" aria-hidden />

      <main className="stage">
        <Work
          layout={layout}
          weight={weights.work}
          onHighlight={setHighlight}
          videoRef={bgVideo}
          posterSrc={poster(current)}
        />
        <About layout={layout} weight={weights.about} />
        <Contact layout={layout} weight={weights.contact} />

        <SharedLayer
          layout={layout}
          from={trans.from}
          to={trans.to}
          t={t}
          work={weights.work}
          contact={weights.contact}
        />

        <Nav
          layout={layout}
          from={trans.from}
          to={trans.to}
          t={t}
          onDark={weights.work + weights.about}
          onGo={go}
        />
      </main>

      <canvas ref={handsCanvas} className="handscanvas" aria-hidden />

      <div className="dials">
        <EffectDial value={effect} onChange={setEffect} />
        <AccentDial value={accent} onChange={setAccent} />
      </div>
    </>
  );
}
