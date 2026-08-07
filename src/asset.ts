/**
 * Resolve a path in `public/` against the deployed base.
 *
 * Vite is configured with `base: './'`, so the site works both at a domain root
 * and under a subpath like `user.github.io/repo/`. Absolute URLs such as
 * `/media/foo.mp4` would 404 in the latter case, so every runtime asset
 * reference goes through here.
 */
const BASE = import.meta.env.BASE_URL || './';

export const asset = (path: string) =>
  BASE.replace(/\/?$/, '/') + path.replace(/^\//, '');
