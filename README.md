# Mohit Jakhar — portfolio v2

Vite + React + TypeScript, plain CSS.

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # -> dist/
npm run preview  # serve the built output locally
```

## Hosting

**The repo's own `index.html` is the Vite dev entry** — it points at
`/src/main.tsx`, which only exists while `npm run dev` is running. Opening it from
the folder, or pointing a host at the repo root, gives a blank page. The site has
to be built and the host has to serve `dist/`.

- **Build command:** `npm run build`
- **Output directory:** `dist`
- **Node:** 18 or newer
- No server, no environment variables, no rewrite rules (single page, no routing)

`.github/workflows/deploy.yml` does this for GitHub Pages on every push to `main`.
It needs Pages set to **Settings → Pages → Source: GitHub Actions** once; with the
default "Deploy from a branch" it will serve the raw repo and stay broken.

Vercel, Netlify and Cloudflare Pages just need the build command and output
directory above.

`vite.config.ts` sets `base: './'` and every runtime asset URL goes through
`src/asset.ts`, so one build works at a domain root *and* under a subpath like
`user.github.io/repo/` with no reconfiguration.

## Layout

One screen, after two references: Brandon Yasin's site (off-white, one size of
uppercase grotesk, a sparse four-column header) and a stack of
perspective panels receding on a diagonal.

| part    | file                        | what it is |
| ------- | --------------------------- | ---------- |
| header  | `src/components/Header.tsx` | name, Work/About/Contact, local time (IST) |
| work    | `src/sections/Stack.tsx`    | the panel loop and footer notes |
| about   | `src/sections/About.tsx`    | cap photo and bio |
| contact | `src/sections/Contact.tsx`  | email, phone, Instagram (`src/data/contact.ts`) |
| viewer  | `src/components/Viewer.tsx` | one project, full size, with sound |

**The stack.** One panel per project, at the clip's own aspect ratio (constant
area, so a 9:16 reel and a 16:9 film weigh the same), on a line that recedes from
left to right, rising slightly, in CSS perspective. The line is
an infinite loop: positions come from one continuous offset wrapped modulo the
project count, so each project appears once. Both ends of the line are off
screen or washed into the paper by an opaque layer on the face (never by
transparency, so panels don't show through each other), so a panel wrapping from
one end to the other is never seen to jump. Wheel, drag or swipe moves along the line with inertia and
always rests on a panel. The centred panel is the open project and plays its
clip in place; click it (or Enter) for the full viewer with sound, click any
other panel to bring it to the centre. Geometry lives in the `tick` loop in `Stack.tsx`.

## Media

`public/media/` holds one representative clip per Drive folder, transcoded to a
12s muted loop (≤1280×720, H.264 MP4 + VP9 WebM) with two poster frames each:
`<slug>.jpg` is the panel face and the viewer's poster. The `-plate` posters are unused.

`src/data/projects.ts` is the manifest. Each entry carries its `driveFolderId`
and the `source` filename it came from, so the per-project pages can enumerate
the rest of each folder later. The list is the 11 folders that exist in the
shared Drive root — `Rejua` and `Peak Love` are in the Figma frame but have no
folder yet; add one and append an entry here.

Aspect ratios vary (Amazon and Pair are 9:16, Personal and Gangour 4:5). The
`aspect` field sizes the viewer and labels the format (16:9 film, 9:16 reel, 4:5 post).
