import { tanstackRouter } from '@tanstack/router-plugin/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const DEFAULT_API_PORT = 3000;

export default defineConfig({
  // The router plugin must run before react so generated routes are transformed too.
  plugins: [tanstackRouter({ target: 'react', autoCodeSplitting: true }), react()],
  server: {
    proxy: { '/api': `http://127.0.0.1:${process.env.API_PORT ?? DEFAULT_API_PORT}` },
  },
});
