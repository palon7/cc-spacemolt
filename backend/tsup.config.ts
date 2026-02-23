import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  outDir: 'dist',
  bundle: true,
  // Bundle @cc-spacemolt/shared into the output (workspace package, not on npm)
  noExternal: [/^@cc-spacemolt\//],
  clean: true,
  target: 'node22',
  // Preserve dynamic imports for conditional setup/config loading
  splitting: false,
});
