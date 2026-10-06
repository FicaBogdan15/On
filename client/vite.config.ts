import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// In development the ASP.NET Core server runs on :5080; Vite proxies the API and SignalR hub
// so the browser only ever talks to one origin (same as production).
const backend = process.env.BACKEND_URL ?? 'http://localhost:5080';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': backend,
      '/gameHub': { target: backend, ws: true },
    },
  },
  build: {
    outDir: 'dist',
    chunkSizeWarningLimit: 2000,
  },
});
