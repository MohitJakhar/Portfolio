# Mohit Jakhar — portfolio v2

Implementation of the `Website v2` frames in
[Figma](https://www.figma.com/design/rzMI8fWlVAvEqbvE7FKcD8/Video-storyboards?node-id=344-2).
Vite + React + TypeScript, plain CSS, two hand-written WebGL passes.

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # -> dist/
npm run preview  # serve the built output locally
```

## Hosting

A plain static build — no server, no environment variables.

- **Build command:** `npm run build`
- **Output directory:** `dist`
- **Node:** 18 or newer

It drops straight onto Vercel, Netlify, Cloudflare Pages or GitHub Pages. It is a
single page with no client-side routing, so no rewrite rules are needed.

For GitHub Pages served from a subpath (`user.github.io/repo/`), set
`base: '/repo/'` in `vite.config.ts` — everything references assets by absolute
path (`/media/...`, `/img/...`), so without that the media 404s. Root domains and
the other three hosts need no change.

The clips in `public/media/` are committed (~17 MB total, largest file 2.6 MB),
so a fresh clone builds and runs with no extra setup.

## Layout model

The design is a 1440×1024 board. Rather than scaling that board as one block —
which leaves the composition floating in the middle of wide screens — each
element keeps the **anchor** it has in the design and only its offset is scaled:

| element             | anchor                |
| ------------------- | --------------------- |
| nav                 | top-left              |
| identity block      | bottom-left           |
| cap (Work)          | bottom-left           |
| cap (About)         | left, vertically mid  |
| project list        | right, vertically mid |
| glass card, card, CTA | centre              |
| hands               | left / right edge     |

`src/layout.ts` is the single place that turns Figma numbers into screen pixels;
`buildLayout()` returns every box for the current viewport and the components
just read from it. The scale is `clamp(min(vw/1440, vh/1024), 0.5, 2.2)`, so the
design scales **up** on large displays without drifting off the edges. Below
640px the same markup re-flows into one scrolling column (the `.is-compact`
block at the end of `styles.css`).

## The three sections

One page, no routing. `App` holds `{ from, to, t }` and derives a weight per
section; everything reads those weights, so sections cross-dissolve rather than
mount and unmount.

**Work.** The backdrop is the highlighted project — the *live clip*, not a
still. There is exactly one `<video>` on the page: it sits inside the glass frame
*and* is uploaded into the backdrop texture every frame, so the card and the
background are the same decoded frame. (Two elements playing one file drift apart
within seconds.)

The project list loops endlessly: rows are positioned from a single scroll offset
wrapped modulo the list height, driven by wheel (anywhere on the page), drag and
arrow keys, with inertia and snap. The highlighted project is the hovered row,
else a clicked one, else the centred one. Clicking a row brings it to the centre
and keeps its clip open after the pointer leaves; scrolling or dragging releases
it. The frame is cut to each clip's own aspect ratio and hangs off the column at
the design's spacing.

**About.** The cap photo and the name block live in `SharedLayer` and are
rendered **once for the whole site**, then re-positioned between sections. The
`<img>` is never unmounted, so going Work → About never re-requests or re-decodes
the asset — it only animates. The accent half-panel and its dot field come from
the backdrop shader; the reading half is deliberately flat and non-reactive.

**Contact.** The hands slide in from both edges. They are drawn on their own
transparent canvas stacked *above* the card, which is what keeps the water
shader on the hands and off the contact details — the text is plain DOM
underneath and never enters that pass.

## The shaders (`src/gl/`)

- **`trail.ts`** — the cursor field, shared by both passes. A 256² ping-pong
  buffer holds a flow vector (RG) and an energy value (B) per pixel. The pointer
  paints its own velocity in; the field advects along itself and decays with a
  short half-life. Consumers read it back as displacement plus highlight, which
  gives the liquid *lag* of a disturbed surface instead of the hard ring you get
  from evaluating `sin(distance)` directly. Tuning lives in `update()` —
  `uRadius` is the brush size, `uDecay` the persistence.
- **`Backdrop.ts`** — real ordered dithering: the frame is quantised to 1 bit
  through an 8×8 Bayer matrix computed in the shader (`BAYER_GLSL`), sampled at
  cell centres so the dots are genuinely chunky rather than a noise overlay. The
  trail field nudges the grid and lifts the threshold slightly. Never still: a
  slow ambient field keeps the dots breathing with no pointer present.
- **`Hands.ts`** — same treatment, plus the trail field as a UV displacement and
  a wet highlight, with the sprite alpha preserved.

Both passes take a `uMode` uniform and carry the same two treatments, so the
whole site switches together:

| mode | effect                                                       |
| ---- | ------------------------------------------------------------ |
| 0    | **Dither** — 1 bit through the ordered Bayer matrix          |
| 1    | **Halftone** — circular dots on a screen rotated 22.5°, tone carried as dot area |

`src/effects.ts` is the registry; the dial above the accent dial switches it and
persists the choice. To add a treatment: append an entry there and add a branch
to both fragment shaders.

## Accent

One hue drives the About panel, the Contact card, the cap wash, the CTA and the
dither tint. `src/accent.ts` publishes it as CSS custom properties *and* a shader
uniform; the dial in the bottom-right corner writes to it and persists to
`localStorage`.

## Media

`public/media/` holds one representative clip per Drive folder, transcoded to a
12s muted loop (≤1280×720, H.264 MP4 + VP9 WebM) with two poster frames each:
`<slug>.jpg` for the `<video>` and `<slug>-plate.jpg` for the backdrop.

`src/data/projects.ts` is the manifest. Each entry carries its `driveFolderId`
and the `source` filename it came from, so the per-project pages can enumerate
the rest of each folder later. The list is the 11 folders that exist in the
shared Drive root — `Rejua` and `Peak Love` are in the Figma frame but have no
folder yet; add one and append an entry here.

Aspect ratios vary (Amazon and Pair are 9:16, Personal and Gangour 4:5). The
`aspect` field decides `contain` vs `cover` inside the glass card.
