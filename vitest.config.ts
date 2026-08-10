/**
 * Vitest configuration for the whole monorepo.
 *
 * A single run covers every workspace so that `npm run check` cannot silently skip a
 * package. Coverage is measured over the source of `apps/*` and `packages/*`; the design
 * target is to keep the domain layer at 100% and the repository as a whole above 90%.
 * `passWithNoTests` exists only so that freshly scaffolded workspaces do not break the
 * pipeline before their first test lands.
 *
 * The React plugin is registered here so that `apps/web` component tests can import `.tsx`
 * and CSS the same way Vite does in development. Individual UI tests opt into `jsdom` with
 * a file-level `@vitest-environment` comment; everything else stays on `node`.
 */

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'node',
    include: ['{apps,packages}/*/src/**/*.test.{ts,tsx}'],
    passWithNoTests: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['{apps,packages}/*/src/**/*.{ts,tsx}'],
      exclude: [
        '**/*.test.{ts,tsx}',
        '**/*.d.ts',
        // Test-only fixtures and process entry points, which wire modules together rather
        // than holding logic of their own.
        '**/testing/**',
        'apps/server/src/index.ts',
        'apps/web/src/main.tsx',
      ],
    },
  },
});
