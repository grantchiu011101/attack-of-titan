import { defineConfig } from 'vite';

export default defineConfig({
  base: process.env.GITHUB_ACTIONS ? '/attack-of-titan/' : '/',
  server: {
    port: 5173,
    host: true,
    open: true,
  },
  build: {
    target: 'es2022',
    sourcemap: true,
  },
});
