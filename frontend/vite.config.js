// Vite configuration.
// Uses loadEnv to read BACKEND_URL from the .env file (see .env.example).
// Docker Compose overrides BACKEND_URL via its environment section so the
// proxy points at the backend service name instead of localhost.
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  // Load all .env variables (empty prefix = load everything, not just VITE_*)
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [react()],
    server: {
      // Proxy /analyze and /info to the FastAPI backend, keeping the frontend
      // and backend on the same origin in development to avoid CORS issues.
      proxy: {
        '/analyze': env.BACKEND_URL,
        '/info':    env.BACKEND_URL,
      },
    },
  };
});
