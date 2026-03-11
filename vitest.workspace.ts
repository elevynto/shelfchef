import { defineWorkspace } from 'vitest/config';

export default defineWorkspace([
  {
    extends: 'packages/shared/vitest.config.ts',
    test: {
      name: 'shared',
      include: ['packages/shared/tests/**/*.test.ts'],
    },
  },
  {
    extends: 'apps/api/vitest.config.ts',
    test: {
      name: 'api-unit',
      include: ['apps/api/tests/unit/**/*.test.ts'],
    },
  },
  {
    extends: 'apps/api/vitest.config.ts',
    test: {
      name: 'api-integration',
      include: ['apps/api/tests/integration/**/*.test.ts'],
      setupFiles: ['apps/api/tests/setup.ts'],
    },
  },
  {
    extends: 'apps/web/vite.config.ts',
    test: {
      name: 'web',
      include: ['apps/web/tests/**/*.test.{ts,tsx}'],
    },
  },
]);
