import { useCallback, useEffect, useRef, useState } from 'react';
import { bestSrc, poster, projects, type Project } from '../data/projects';
import { TINTS } from '../data/tints';

/**
 * The work view: one panel per project on a line that recedes from left to
 * right, rising slightly, in perspective. The line is a loop. Positions come
 * from one continuous `offset`, wrapped modulo the project count, and both ends
 * of the line sit off screen, so a panel leaving the far end comes back in at
 * the near end without ever being seen to jump. The panel at the centre is the
 * open project and plays its clip.
 */

const N = projects.length;
const HALF = N / 2;
const DRAG_SLOP = 5;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Signed distance from the centre, in panels, wrapped into [-N/2, N/2). */
const wrap = (v: number) => {
  const m = ((v % N) + N) % N;
  return m >= HALF ? m - N : m;
};

const smooth = (t: number) => t * t * (3 - 2 * t);

const indexAt = (offset: number) => ((Math.round(offset) % N) + N) % N;

type Props = { onOpen: (p: Project) => void; hidden: boolean };

export function Stack({ onOpen, hidden }: Props) {
  const boxRef = useRef<HTMLDivElement>(null);
  const panelRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const cursorRef = useRef<HTMLDivElement>(null);

  const size = useRef({ w: 1, h: 1, P: 1, compact: false });
  const offset = useRef(0);
  const velocity = useRef(0);
  const target = useRef<number | null>(null);
  const dragging = useRef(false);
  const hovered = useRef<number | null>(null);
  const lift = useRef(new Float32Array(N));
  const pointer = useRef<{ x: number; y: number } | null>(null);

  const [active, setActive] = useState(0);
  const activeRef = useRef(0);
  const [settled, setSettled] = useState(true);
  const settledRef = useRef(true);
  const [over, setOver] = useState<number | null>(null);

  useEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    const measure = () => {
      const w = box.clientWidth;
      const h = box.clientHeight;
      const compact = w < 760;
      const P = compact ? clamp(w * 0.46, 160, 240) : clamp(Math.min(h * 0.36, w * 0.22), 190, 400);
      size.current = { w, h, P, compact };
      box.style.setProperty('--P', `${P}px`);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(box);
    return () => ro.disconnect();
  }, []);

  // ---- the loop that places every panel ------------------------------------
  useEffect(() => {
    let raf = 0;
    let last = performance.now();

    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      const dt = Math.min((now - last) / 1000, 1 / 20);
      last = now;
      const { P, compact } = size.current;

      if (!dragging.current) {
        if (target.current !== null) {
          velocity.current = 0;
          offset.current += (target.current - offset.current) * (1 - Math.pow(0.002, dt));
          if (Math.abs(target.current - offset.current) < 0.001) {
            offset.current = target.current;
            target.current = null;
          }
        } else {
          offset.current += velocity.current * dt;
          velocity.current *= Math.pow(0.02, dt);
          if (Math.abs(velocity.current) < 0.35) {
            velocity.current = 0;
            // Rest on a panel rather than between two.
            const snap = Math.round(offset.current);
            offset.current += (snap - offset.current) * (1 - Math.pow(0.002, dt));
            if (Math.abs(snap - offset.current) < 0.001) offset.current = snap;
          }
        }
      }

      // Spacing along the line, as a share of the panel size.
      // Mostly sideways, with a slight climb toward the far end.
      const dx = P * (compact ? 0.5 : 0.64);
      const dy = P * (compact ? 0.1 : 0.07);
      const dz = P * 0.5;
      const k = 1 - Math.pow(0.0005, dt);

      for (let i = 0; i < N; i++) {
        const el = panelRefs.current[i];
        if (!el) continue;
        const s = wrap(i - offset.current);
        // The near side of the line opens out faster, so the open panel is never
        // buried under the ones in front of it.
        const t = s < 0 ? s * 1.55 : s;
        lift.current[i] += ((hovered.current === i ? 1 : 0) - lift.current[i]) * k;
        const up = lift.current[i] * P * 0.07;
        el.style.transform =
          `translate(-50%, -50%) translate3d(${(t * dx).toFixed(1)}px, ${(-t * dy - up).toFixed(1)}px, ${(-s * dz).toFixed(1)}px) ` +
          `rotateY(-38deg)`;
        el.style.zIndex = String(Math.round(1000 - s * 20));
        // Panels at either end wash out into the paper. The wash is an opaque
        // layer on the face, so a fading panel never shows the ones behind it;
        // it only goes transparent once it is already paper-coloured. That also
        // hides the seam where a panel wraps from one end of the loop to the other.
        const wash = Math.max(
          smooth(clamp((s - 1.5) / 3.4, 0, 1)),
          smooth(clamp((-s - 1.3) / 1.4, 0, 1)),
        );
        el.style.setProperty('--wash', wash.toFixed(3));
        el.style.opacity = (1 - smooth(clamp((wash - 0.9) / 0.1, 0, 1))).toFixed(3);
      }

      const idx = indexAt(offset.current);
      if (idx !== activeRef.current) {
        activeRef.current = idx;
        setActive(idx);
      }
      const still =
        !dragging.current &&
        target.current === null &&
        Math.abs(offset.current - Math.round(offset.current)) < 0.02;
      if (still !== settledRef.current) {
        settledRef.current = still;
        setSettled(still);
      }

      const cur = cursorRef.current;
      const p = pointer.current;
      if (cur) {
        cur.style.opacity = p ? '1' : '0';
        if (p) cur.style.transform = `translate3d(${p.x}px, ${p.y}px, 0)`;
      }
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  // ---- input ---------------------------------------------------------------
  useEffect(() => {
    const box = boxRef.current;
    if (!box || hidden) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      target.current = null;
      const unit = e.deltaMode === 1 ? 18 : e.deltaMode === 2 ? 400 : 1;
      const d = (Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY) * unit;
      velocity.current = clamp(velocity.current + d * 0.02, -24, 24);
    };
    box.addEventListener('wheel', onWheel, { passive: false });
    return () => box.removeEventListener('wheel', onWheel);
  }, [hidden]);

  const press = useRef<{
    x: number;
    y: number;
    travel: number;
    panel: number | null;
    touch: boolean;
    /** Recent offsets, for the release speed. */
    hist: { t: number; o: number }[];
  } | null>(null);

  const panelAt = (e: React.PointerEvent) => {
    const el = (e.target as Element | null)?.closest?.('.panel');
    return el instanceof HTMLElement && el.dataset.index ? Number(el.dataset.index) : null;
  };

  /** Shortest way round the loop to panel k. */
  const goTo = useCallback((k: number) => {
    target.current = offset.current + wrap(k - offset.current);
    velocity.current = 0;
  }, []);

  const onPointerMove = (e: React.PointerEvent) => {
    if (e.pointerType === 'mouse') {
      // Window coordinates: the cursor is fixed over the whole page.
      pointer.current = { x: e.clientX, y: e.clientY };
      const h = dragging.current ? null : panelAt(e);
      if (h !== hovered.current) {
        hovered.current = h;
        setOver(h);
      }
    }
    const p = press.current;
    if (!p) return;
    const dxp = e.clientX - p.x;
    const dyp = e.clientY - p.y;
    p.travel += Math.abs(dxp) + Math.abs(dyp);
    p.x = e.clientX;
    p.y = e.clientY;
    if (p.travel < DRAG_SLOP) return;
    if (!dragging.current) {
      dragging.current = true;
      // Keeps the drag when the finger leaves the box. Never let it abort one.
      try {
        boxRef.current?.setPointerCapture(e.pointerId);
      } catch {
        /* the pointer is already gone */
      }
    }
    target.current = null;
    velocity.current = 0;
    // Along the line. On a phone a swipe counts in either axis, and swiping up
    // or left both go to the next project, like scrolling down a feed. A mouse
    // drag is mostly sideways.
    const along = p.touch ? dxp + dyp : dxp - dyp * 0.25;
    offset.current -= along / (size.current.P * (p.touch ? 0.55 : 0.5));
    const now = performance.now();
    p.hist.push({ t: now, o: offset.current });
    while (p.hist.length > 2 && now - p.hist[0].t > 120) p.hist.shift();
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const now = performance.now();
    press.current = {
      x: e.clientX,
      y: e.clientY,
      travel: 0,
      panel: panelAt(e),
      touch: e.pointerType !== 'mouse',
      hist: [{ t: now, o: offset.current }],
    };
    dragging.current = false;
    velocity.current = 0;
  };

  const onPointerUp = (e: React.PointerEvent) => {
    const p = press.current;
    press.current = null;
    if (dragging.current) {
      dragging.current = false;
      try {
        boxRef.current?.releasePointerCapture(e.pointerId);
      } catch {
        /* already released */
      }
      // Speed over the last ~100ms of the drag rather than the last event, then
      // land on a whole panel a short way on: a flick adds a project or two
      // projects on a phone (three with a mouse), so it never spins the loop.
      const h = p ? p.hist : [];
      const a = h[0];
      const b = h[h.length - 1];
      const dt = a && b ? (b.t - a.t) / 1000 : 0;
      const v = dt > 0.01 && performance.now() - b.t < 80 ? (b.o - a.o) / dt : 0;
      const fling = p?.touch ? clamp(v * 0.2, -1.5, 1.5) : clamp(v * 0.18, -3, 3);
      target.current = Math.round(offset.current + fling);
      return;
    }
    if (p?.panel == null) return;
    // The centre panel opens its project page; any other one comes to the centre first.
    if (p.panel === activeRef.current) onOpen(projects[p.panel]);
    else goTo(p.panel);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') goTo(activeRef.current + 1);
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') goTo(activeRef.current - 1);
    else if (e.key === 'Enter') onOpen(projects[activeRef.current]);
    else return;
    e.preventDefault();
  };

  const ap = projects[active];
  const small = size.current.compact;

  return (
    <section className="work" aria-label="Work" hidden={hidden}>
      <div
        ref={boxRef}
        className="stack"
        tabIndex={0}
        role="group"
        aria-roledescription="carousel"
        aria-label={`${N} projects. ${ap.title} is in the centre. Arrow keys move, Enter opens it.`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={() => {
          press.current = null;
          // Don't leave the stack resting between two panels.
          if (dragging.current) target.current = Math.round(offset.current);
          dragging.current = false;
        }}
        onPointerLeave={(e) => {
          if (e.pointerType !== 'mouse') return;
          pointer.current = null;
          hovered.current = null;
          setOver(null);
        }}
        onKeyDown={onKeyDown}
      >
        {projects.map((p, i) => (
          <button
            key={p.slug}
            ref={(el) => {
              panelRefs.current[i] = el;
            }}
            type="button"
            tabIndex={-1}
            aria-hidden
            className={`panel${i === active ? ' is-on' : ''}`}
            data-index={i}
            // The clip's own shape at a constant area, so a 9:16 reel and a 16:9
            // film weigh the same on the line and neither is cropped.
            style={{
              width: `calc(var(--P) * ${Math.sqrt(p.aspect).toFixed(4)})`,
              aspectRatio: String(p.aspect),
              // The folder's glass takes the project's own colour.
              ['--tint' as string]: TINTS[p.slug] ?? 'var(--blue)',
            }}
          >
            {/* The glass folder each project sits in, tinted from its poster. */}
            <span className="panel__folder" aria-hidden>
              <span className="panel__tab" />
            </span>
            <span className="panel__face" style={{ backgroundImage: `url("${poster(p, small)}")` }}>
              {i === active && settled && (
                <video
                  key={p.slug}
                  src={bestSrc(p, small)}
                  muted
                  autoPlay
                  loop
                  playsInline
                  preload="auto"
                  ref={(v) => {
                    if (v) v.muted = true;
                  }}
                />
              )}
            </span>
          </button>
        ))}

      </div>


      {/* Outside the stack: its perspective would trap a fixed element and clip
          the circle at the stack's edges. */}
      <div ref={cursorRef} className={`cursor${over !== null ? ' is-open' : ''}`} aria-hidden>
        {over === null ? 'Drag' : over === active ? 'Open' : 'View'}
      </div>

      {/* The open project, large, from the left margin. Keyed so each change
          plays the swap. */}
      <div className="title" aria-hidden>
        <p key={ap.slug} className="title__name">
          {ap.title.toLowerCase()}
        </p>
      </div>

      <div className="foot">
        <p>
          Motion graphics designer
          <br />
          <span>Figma, After Effects, DaVinci Resolve</span>
        </p>
        <div className="scrub" role="group" aria-label="Projects">
          {projects.map((p, k) => (
            <button
              key={p.slug}
              type="button"
              className={k === active ? 'is-on' : ''}
              aria-label={p.title}
              aria-current={k === active ? 'true' : undefined}
              onClick={() => goTo(k)}
            >
              <i />
              <b>{p.title}</b>
            </button>
          ))}
        </div>
        <p className="foot__right">
          Drag or scroll
          <br />
          <span>Click the centre panel to open</span>
        </p>
      </div>
    </section>
  );
}
