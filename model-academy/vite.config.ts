import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  plugins: [react()],
  // Relative URLs work at /hhh/, custom domains, and other static hosts.
  base: './',
  resolve: { alias: { '@': fileURLToPath(new URL('.', import.meta.url)) } },
});
