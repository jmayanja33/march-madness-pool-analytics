// Vite configuration.
// BACKEND_URL resolution priority:
//   1. process.env.BACKEND_URL  — set by Docker Compose as a real env var
//   2. env.BACKEND_URL          — read from a local .env file by loadEnv()
//   3. fallback 'http://localhost:8000' — bare local dev without a .env file
//
// loadEnv() only reads .env files on disk; it does NOT see Docker Compose env
// vars, so process.env is checked first to handle the Docker case correctly.
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  // Load all .env variables (empty prefix = load everything, not just VITE_*)
  const env = loadEnv(mode, process.cwd(), '');

  // Prefer the real process env (Docker Compose) over the .env file value.
  const backendUrl =
    process.env.BACKEND_URL ?? env.BACKEND_URL ?? 'http://localhost:8000';

  return {
    plugins: [react()],
    server: {
      // Proxy /analyze and /info to the FastAPI backend, keeping the frontend
      // and backend on the same origin in development to avoid CORS issues.
      proxy: {
        // Use explicit option objects so changeOrigin rewrites the Host header
        // to match the target — required when the backend runs on a different
        // host (e.g., the "backend" Docker service name vs. "localhost").
        '/analyze':        { target: backendUrl, changeOrigin: true },
        '/teams':          { target: backendUrl, changeOrigin: true },
        '/info':           { target: backendUrl, changeOrigin: true },
        '/create-a-team':  { target: backendUrl, changeOrigin: true },
      },
    },
  };
});
