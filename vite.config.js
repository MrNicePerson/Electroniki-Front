import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';
import { fileURLToPath } from 'node:url';

const backendDirectory = fileURLToPath(new URL('../backend', import.meta.url));
const backendEnv = loadEnv('development', backendDirectory, 'PORT');
const backendPort = Number(backendEnv.PORT) || 3000;

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: '0.0.0.0',
    proxy: {
      '/api': {
        // Always follow the sibling backend's local PORT setting. This avoids
        // stale shell-level API_PROXY values silently sending requests to an
        // old or unused backend port.
        target: `http://127.0.0.1:${backendPort}`,
        // Preserve the browser's host so the backend can validate its Origin.
        changeOrigin: false,
      },
    },
  },
});
