import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const backendHost = env.WADDLE_BACKEND_HOST || '127.0.0.1';
  const backendPort = env.WADDLE_BACKEND_PORT || '8000';
  const backendHttp = `http://${backendHost}:${backendPort}`;
  const backendWs = `ws://${backendHost}:${backendPort}`;

  return {
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      port: 5173,
      proxy: {
        '/api': {
          target: backendHttp,
          changeOrigin: true,
        },
        '/ws': {
          target: backendWs,
          ws: true,
        },
      },
    },
  };
});
