/**
 * Vite configuration for the Quiz World SPA.
 *
 * The proxy is what makes local development look like production: the browser talks to one
 * origin (the Vite server), and `/api` plus `/socket.io` are forwarded to the socket server.
 * That is the same path split CloudFront will perform later, so the client never needs a
 * different base URL between environments.
 *
 * `DEV_PROXY_TARGET` moves the proxy to another socket server. The end-to-end tests use it to
 * run their own server beside a development one that is already listening on 3001.
 */

import { env } from 'node:process';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const SOCKET_SERVER = env['DEV_PROXY_TARGET'] ?? 'http://localhost:3001';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': { target: SOCKET_SERVER, changeOrigin: true },
      // ALB health checks hit `/health` directly. Proxied here so a browser on the Vite origin
      // can verify the socket server is reachable without inventing an `/api/health` path.
      '/health': { target: SOCKET_SERVER, changeOrigin: true },
      '/socket.io': { target: SOCKET_SERVER, ws: true, changeOrigin: true },
    },
  },
});
