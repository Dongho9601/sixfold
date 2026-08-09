import { defineConfig } from 'vite';
import path from 'node:path';

export default defineConfig({
  resolve: {
    alias: {
      '@core': path.resolve(__dirname, './src/core'),
      '@content': path.resolve(__dirname, './src/content'),
      '@application': path.resolve(__dirname, './src/application'),
      '@platform': path.resolve(__dirname, './src/platform'),
      '@ui': path.resolve(__dirname, './src/ui'),
      '@workers': path.resolve(__dirname, './src/workers'),
    },
  },
  build: {
    target: 'es2022',
  },
});
