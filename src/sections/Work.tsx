import { useCallback, useEffect, useRef, useState } from 'react';
import { projects } from '../data/projects';
import { glassFor, type Layout } from '../layout';

type Props = {
  layout: Layout;
  /** Section weight, 0..1. */
  weight: number;
  /** The project the backdrop should show: hovered if any, else centred. */
  onHighlight: (slug: string) => void;
  /**
   * The one and only clip element. It lives inside the glass frame but also
   * feeds the backdrop texture, so the card and the background are guaranteed
   * to be the same frame rather than two decoders drifting apart.
   */
  videoRef: React.Ref<HTMLVideoElement>;
  /** Poster for the currently highlighted project. */
  posterSrc: string;
};

const N = projects.length;

/** Pointer travel, in px, before a press counts as a drag rather than a click. */
const DRAG_SLOP = 5;

const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

export function Work({ layout, weight, onHighlight, videoRef, posterSrc }: Props) {
  const rowRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const listRef = useRef<HTMLDivElement>(null);

  /** Scroll position, in *design* units, so it survives a resize. */
  const offset = useRef(0);
  const velocity = useRef(0);
  const target = useRef<number | null>(null);
  const dragging = useRef(false);
  const lastPointer = useRef(0);
  const dragTravel = useRef(0);
  const centred = useRef(0);
  const lastHover = useRef(0);

  /**
   * Selection state for the render loop. `selectedRow` is the index the pointer
   * or a click has picked out (-1 for none), `rowHover` is a per-row eased 0..1,
   * and `selectBlend` eases the highlight *away* from the centred row while a
   * selection is live — otherwise two rows would read as selected at once.
   */
  const selectedRow = useRef(-1);
  const rowHover = useRef(new Float32Array(N));
  const selectBlend = useRef(0);

  // The animation loop reads the layout through a ref so a resize never
  // restarts it (and never loses the current scroll position).
  const lay = useRef(layout);
  lay.current = layout;

  const [centreIndex, setCentreIndex] = useState(0);
  const [hover, setHover] = useState<number | null>(null);
  /** Clicked project: stays open after the pointer leaves, until you scroll. */
  const [pinned, setPinned] = useState<number | null>(null);
  const pinnedRef = useRef<number | null>(null);
  pinnedRef.current = pinned;

  /** What the glass frame is showing, if anything. */
  const shown = hover ?? pinned;
  const highlight = shown ?? centreIndex;

  useEffect(() => {
    onHighlight(projects[highlight].slug);
  }, [highlight, onHighlight]);

  // Keep the render loop's selection in step with hover and the pinned row.
  selectedRow.current = shown ?? -1;

  const unpin = useCallback(() => {
    if (pinnedRef.current !== null) setPinned(null);
  }, []);

  // ---- the loop that positions rows and reports the centred one -----------
  useEffect(() => {
    let raf = 0;
    let last = performance.now();

    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      const dt = Math.min((now - last) / 1000, 1 / 20);
      last = now;

      // Compact uses the same absolute positioning as desktop, so this loop runs
      // on every size — it is what spreads the rows out at all.
      const { list } = lay.current;
      const total = N * list.step;
      const wrap = (v: number) => {
        const m = ((v % total) + total) % total;
        return m > total / 2 ? m - total : m;
      };

      if (!dragging.current) {
        if (target.current !== null) {
          // A click owns the scroll until it lands. This has to run regardless
          // of velocity: if it waited for momentum to decay first, clicking mid
          // drift would coast past the target and snap somewhere else entirely.
          velocity.current = 0;
          offset.current += (target.current - offset.current) * (1 - Math.pow(0.0009, dt));
          if (Math.abs(target.current - offset.current) < 0.05) {
            offset.current = target.current;
            target.current = null;
          }
        } else {
          offset.current += velocity.current * dt;
          velocity.current *= Math.pow(0.0018, dt);
          if (Math.abs(velocity.current) < 12 * list.s) {
            velocity.current = 0;
            // Rest on a row rather than between two.
            const snapTo = Math.round(offset.current / list.step) * list.step;
            offset.current += (snapTo - offset.current) * (1 - Math.pow(0.0009, dt));
            if (Math.abs(snapTo - offset.current) < 0.05) offset.current = snapTo;
          }
        }
      }

      // Ease the hover weights so a row grows into the highlight rather than
      // snapping to it.
      const ease = 1 - Math.pow(0.00005, dt);
      const under = selectedRow.current;
      selectBlend.current += ((under >= 0 ? 1 : 0) - selectBlend.current) * ease;
      for (let i = 0; i < N; i++) {
        const want = i === under ? 1 : 0;
        rowHover.current[i] += (want - rowHover.current[i]) * ease;
      }

      let best = 0;
      let bestDist = Infinity;

      for (let i = 0; i < N; i++) {
        const el = rowRefs.current[i];
        if (!el) continue;
        const dy = wrap(i * list.step - offset.current);
        const dist = Math.abs(dy);
        if (dist < bestDist) {
          bestDist = dist;
          best = i;
        }

        // Off-centre rows highlight on hover: the pointer takes the selection
        // over from the centred row for as long as it is on the list.
        const byCentre = 1 - smoothstep(0, list.step * 0.85, dist);
        const active =
          byCentre * (1 - selectBlend.current) + rowHover.current[i] * selectBlend.current;
        const edge = 1 - smoothstep(list.height * 0.34, list.height * 0.5, dist);

        el.style.transform = `translate3d(0, ${dy.toFixed(2)}px, 0)`;
        el.style.fontSize = `${(list.size + (list.activeSize - list.size) * active).toFixed(2)}px`;
        el.style.fontVariationSettings = `"wght" ${(400 + 300 * active).toFixed(0)}`;
        el.style.opacity = ((0.49 + 0.51 * active) * edge).toFixed(3);
      }

      if (best !== centred.current) {
        centred.current = best;
        setCentreIndex(best);
      }
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  // ---- input --------------------------------------------------------------
  // On the window, not the column: the whole page scrolls the list. `active`
  // keeps About and Contact from being scrolled by proxy.
  const active = weight > 0.6;
  useEffect(() => {
    if (!active) return;

    const onWheel = (e: WheelEvent) => {
      // The listener is on window, so the target is not necessarily an element.
      const t = e.target;
      if (t instanceof Element && t.closest('.dial')) return;
      e.preventDefault();
      // Browsing again: release whatever was clicked open.
      unpin();
      target.current = null;
      const unit = e.deltaMode === 1 ? 18 : e.deltaMode === 2 ? 400 : 1;
      const step = lay.current.list.step;
      velocity.current = Math.max(
        -60 * step,
        Math.min(60 * step, velocity.current + e.deltaY * unit * 1.9),
      );
    };
    window.addEventListener('wheel', onWheel, { passive: false });
    return () => window.removeEventListener('wheel', onWheel);
  }, [active, unpin]);

  const centreOn = useCallback((i: number) => {
    const step = lay.current.list.step;
    const total = N * step;
    const m = (((i * step - offset.current) % total) + total) % total;
    target.current = offset.current + (m > total / 2 ? m - total : m);
    velocity.current = 0;
  }, []);

  /** Bring a row to the centre and hold its clip open. */
  const select = useCallback(
    (i: number) => {
      setHover(i);
      setPinned(i);
      centreOn(i);
    },
    [centreOn],
  );

  // ---- press / drag / click ------------------------------------------------
  // Deliberately driven off pointerup rather than `click`, and without
  // setPointerCapture. Capturing the pointer retargets the compatibility mouse
  // events — including `click` — to the capturing element, so a real mouse click
  // on a row never reached the row's own handler. Window listeners give the same
  // "keep tracking outside the element" behaviour without that side effect.
  const pressing = useRef(false);
  const pressIndex = useRef<number | null>(null);
  const moveRef = useRef<(e: PointerEvent) => void>(() => {});
  const upRef = useRef<(e: PointerEvent) => void>(() => {});

  moveRef.current = (e: PointerEvent) => {
    if (!pressing.current) return;
    const dy = e.clientY - lastPointer.current;
    dragTravel.current += Math.abs(dy);
    lastPointer.current = e.clientY;
    // A click carries a pixel or two of jitter: don't scroll, and don't release
    // the pin, until the pointer has travelled far enough to mean it.
    if (dragTravel.current < DRAG_SLOP) return;
    dragging.current = true;
    unpin();
    offset.current -= dy;
    velocity.current = -dy * 34;
  };

  upRef.current = () => {
    if (!pressing.current) return;
    pressing.current = false;
    window.removeEventListener('pointermove', moveRef.current);
    window.removeEventListener('pointerup', upRef.current);
    window.removeEventListener('pointercancel', upRef.current);

    const wasDrag = dragging.current;
    dragging.current = false;
    const i = pressIndex.current;
    pressIndex.current = null;
    if (!wasDrag && i !== null) select(i);
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const row = (e.target as Element | null)?.closest?.('.worklist__row');
    pressIndex.current =
      row instanceof HTMLElement && row.dataset.index ? Number(row.dataset.index) : null;
    pressing.current = true;
    dragging.current = false;
    dragTravel.current = 0;
    velocity.current = 0;
    lastPointer.current = e.clientY;
    window.addEventListener('pointermove', moveRef.current);
    window.addEventListener('pointerup', upRef.current);
    window.addEventListener('pointercancel', upRef.current);
  };

  useEffect(
    () => () => {
      window.removeEventListener('pointermove', moveRef.current);
      window.removeEventListener('pointerup', upRef.current);
      window.removeEventListener('pointercancel', upRef.current);
    },
    [],
  );

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    e.preventDefault();
    const step = lay.current.list.step;
    const dir = e.key === 'ArrowDown' ? 1 : -1;
    target.current = (target.current ?? Math.round(offset.current / step) * step) + dir * step;
    velocity.current = 0;
  };

  const enter = useCallback((i: number) => setHover(i), []);
  const leave = useCallback(() => setHover(null), []);

  const { list, compact } = layout;
  // A phone has no hover, so the frame is always up and simply follows whichever
  // row is centred. On desktop it opens for a hover or a click.
  const open = compact || shown !== null;
  // The frame follows the clip's shape. While closing, keep the last shape so it
  // doesn't reshape on the way out.
  const shape = compact ? highlight : (shown ?? lastHover.current);
  lastHover.current = shape;
  const glass = glassFor(
    projects[shape].aspect,
    layout.vw,
    layout.vh,
    layout.s,
    list.left,
    compact,
  );

  return (
    <section
      className="panel panel--work"
      style={{ opacity: weight, pointerEvents: weight > 0.6 ? 'auto' : 'none' }}
      aria-hidden={weight < 0.5}
    >
      {/* Open on hover, and stays open for a clicked project. */}
      <div
        className="glass"
        style={{
          left: glass.left,
          top: glass.top,
          width: glass.width,
          height: glass.height,
          borderRadius: glass.radius,
          // Not quite zero: the clip inside is also the backdrop's texture
          // source, and a fully transparent subtree can have its decoding
          // throttled — which would freeze the background.
          opacity: open ? 1 : 0.001,
          transform: `scale(${open ? 1 : 0.985})`,
        }}
        aria-hidden={!open}
      >
        <div
          className="glass__inner"
          style={{ width: glass.innerW, height: glass.innerH, borderRadius: glass.radius }}
        >
          <video
            ref={videoRef}
            className="glass__video"
            poster={posterSrc}
            muted
            loop
            playsInline
            preload="auto"
            aria-label={`${projects[highlight].title} showreel`}
          />
        </div>
      </div>

      <div
        ref={listRef}
        className="worklist"
        style={{ left: list.left, top: list.top, width: list.width, height: list.height }}
        onPointerDown={onPointerDown}
        onPointerLeave={leave}
        onBlur={leave}
        onKeyDown={onKeyDown}
        role="listbox"
        tabIndex={0}
        aria-label="Projects"
        aria-activedescendant={`project-${projects[highlight].slug}`}
      >
        {projects.map((p, i) => (
          <button
            key={p.slug}
            id={`project-${p.slug}`}
            ref={(el) => {
              rowRefs.current[i] = el;
            }}
            type="button"
            className="worklist__row"
            data-index={i}
            style={{
              top: list.centre - list.rowH / 2,
              height: list.rowH,
              fontSize: list.size,
            }}
            role="option"
            aria-selected={i === highlight}
            // Touch fires pointerenter on tap and never leaves, which would
            // strand the hover state. Selection on touch goes through pointerup.
            onPointerEnter={(e) => {
              if (e.pointerType === 'mouse') enter(i);
            }}
            onFocus={() => enter(i)}
            // Mouse selection runs off pointerup (see above). This covers
            // keyboard activation, where `click` is the only signal; it targets
            // the same row, so the two paths can't disagree.
            onClick={() => select(i)}
          >
            {p.title}
          </button>
        ))}
      </div>
    </section>
  );
}
