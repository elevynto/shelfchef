import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@shelfchef/shared': path.resolve(__dirname, '../../packages/shared/src/index.ts'),
    },
  },
  test: {
    environment: 'node',
    env: {
      JWT_SECRET: 'test-secret-at-least-sixteen-characters',
      JWT_REFRESH_SECRET: 'test-refresh-secret-sixteen-chars',
      MONGODB_URI: 'mongodb://localhost/shelfchef-test-placeholder',
      NODE_ENV: 'test',
      SPOONACULAR_API_KEY: 'test-spoonacular-key',
    },
    coverage: {
      provider: 'v8',
      include: ['src/services/**'],
      thresholds: {
        lines: 80,
      },
    },
  },
});
