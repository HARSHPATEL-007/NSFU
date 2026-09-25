import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, Plugin } from 'vite';
import express from 'express';
import { apiRouter } from './src/server/api';

function expressApiPlugin(): Plugin {
  return {
    name: 'express-api-plugin',
    configureServer(server) {
      const app = express();
      app.use(express.json());
      app.use(apiRouter);
      server.middlewares.use('/api', app);
    },
  };
}

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss(), expressApiPlugin()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
