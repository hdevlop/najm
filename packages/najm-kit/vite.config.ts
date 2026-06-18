import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

export default defineConfig({
  root: 'playground',
  plugins: [react()],
  resolve: {
    alias: [
      { find: /^najm-kit\/theme\.css$/, replacement: resolve(__dirname, 'src/theme.css') },
      { find: /^najm-kit$/, replacement: resolve(__dirname, 'src/index.ts') },
    ],
  },
  server: {
    host: '127.0.0.1',
    port: 5177,
  },
});
