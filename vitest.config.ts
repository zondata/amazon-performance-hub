import path from 'node:path';

import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'apps/web/src'),
      react: path.resolve(__dirname, 'apps/web/node_modules/react'),
      'react-dom': path.resolve(__dirname, 'apps/web/node_modules/react-dom'),
      'react/jsx-runtime': path.resolve(__dirname, 'apps/web/node_modules/react/jsx-runtime.js'),
      'server-only': path.resolve(__dirname, 'test/shims/server-only.ts'),
    },
  },
});
