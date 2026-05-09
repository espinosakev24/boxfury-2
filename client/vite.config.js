import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  server: {
    port: 5173,
    allowedHosts: ['*'],
  },
  optimizeDeps: {
    exclude: ['@boxfury/shared'],
  },
  build: {
    target: 'es2022',
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        editor: resolve(__dirname, 'map-editor.html'),
      },
    },
  },
});
