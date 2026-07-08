import { defineConfig } from 'astro/config';

export default defineConfig({
  // Keep flat output (roadmap.html, not roadmap/index.html) so every
  // existing link/bookmark to these pages keeps working unchanged.
  build: {
    format: 'file',
  },
});
