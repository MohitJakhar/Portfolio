import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Relative, so one build works at a domain root and under a subpath such as
  // user.github.io/repo/. Runtime asset URLs go through src/asset.ts to match.
  base: './',
  server: { port: 5173, host: true },
  build: { assetsInlineLimit: 0 },
});
