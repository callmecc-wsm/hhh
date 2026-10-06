import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  plugins: [react()],
  // Preview artifact is mounted beside the unchanged formal Pages root.
  base: '/hhh/v3/',
  resolve: { alias: { '@': fileURLToPath(new URL('.', import.meta.url)) } },
});
