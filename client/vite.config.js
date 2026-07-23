import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// No PWA/service-worker in the desktop build: a service worker aggressively
// caches pages and would serve stale UI inside the Electron window.
export default defineConfig({
  plugins: [
    react(),
  ],
  server: {
    port: 3000,
    proxy: {
      '/api': 'http://localhost:3001',
    },
  },
});
