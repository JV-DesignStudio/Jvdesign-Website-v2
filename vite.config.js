import { defineConfig } from 'vite';
import { resolve } from 'path';

// ── Vite scaffold for Arcade Game Maker modular split ──────────────────────
// Current file is 1.37 MB single HTML + inline JS (parse ~500ms on low-end).
// This config prepares the incremental split without breaking the live site:
//  • tools/arcade-game-maker.html stays the production entry until modules land
//  • src/arcade-maker/* will hold extracted ES modules (liveConfig, GameAudio, RunMods, scenes)
//  • Build emits a chunked bundle that sync-maker can copy to www/ for Capacitor
// Run:  npx vite build   (no-op until src exists, then chunks appear)
// See:  src/arcade-maker/README.md for migration stages.

export default defineConfig({
  root: '.',
  build: {
    rollupOptions: {
      input: {
        // Keep legacy HTML as entry during transition; Vite will inject modulepreload
        arcade: resolve(__dirname, 'tools/arcade-game-maker.html'),
      },
    },
    // Chunk split reduces parse burst on low-end Android
    chunkSizeWarningLimit: 600,
  },
  server: {
    port: 5173,
  },
});
