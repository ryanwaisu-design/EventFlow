import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const repoName = process.env.GITHUB_REPOSITORY?.split('/')[1];
const pagesBase = process.env.GITHUB_ACTIONS === 'true' && repoName ? `/${repoName}/` : './';

export default defineConfig({
  plugins: [react()],
  base: pagesBase,
  server: {
    port: 5175,
    strictPort: true,
    host: true,
    headers: {
      'Cache-Control': 'no-store',
    },
  },
  preview: {
    port: 5175,
    strictPort: true,
    host: true,
    headers: {
      'Cache-Control': 'no-store',
    },
  },
});
