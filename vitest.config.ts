import path from 'node:path';

import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'apps/web/src'),
      'server-only': path.resolve(__dirname, 'test/shims/server-only.ts'),
    },
  },
});
