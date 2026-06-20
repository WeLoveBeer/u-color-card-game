import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const root = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['server/src/**/*.spec.ts', 'client/src/**/*.spec.ts'],
    exclude: ['dist/**', 'node_modules/**']
  },
  resolve: {
    alias: {
      '@shared': fileURLToPath(new URL('./shared/src', import.meta.url)),
      '@server': fileURLToPath(new URL('./server/src', import.meta.url))
    }
  },
  root
});
