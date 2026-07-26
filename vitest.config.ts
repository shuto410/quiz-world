/**
 * Vitest configuration for the whole monorepo.
 *
 * A single run covers every workspace so that `npm run check` cannot silently skip a
 * package. Coverage is measured over the source of `apps/*` and `packages/*`; the design
 * target is to keep the domain layer at 100% and the repository as a whole above 90%.
 * `passWithNoTests` exists only so that freshly scaffolded workspaces do not break the
 * pipeline before their first test lands.
 */

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['{apps,packages}/*/src/**/*.test.{ts,tsx}'],
    passWithNoTests: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['{apps,packages}/*/src/**/*.{ts,tsx}'],
      exclude: ['**/*.test.{ts,tsx}', '**/*.d.ts'],
    },
  },
});
