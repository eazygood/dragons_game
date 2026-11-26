import { tanstackRouter } from '@tanstack/router-plugin/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const DEFAULT_API_PORT = 3000;

// Vite transpiles syntax for these but never polyfills APIs, so the source must not call
// anything newer. The bundle was checked for it; AbortSignal.any (Safari 17.4) was the one miss.
const SUPPORTED_BROWSERS = ['chrome111', 'firefox114', 'safari16.4'];

// Copied from apps/api/src/plugins/security-headers.ts. Keep the two in sync: previewing
// with a looser policy would let e2e pass on code the real server would block.
const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self' data:",
  "connect-src 'self'",
  "font-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ');

export default defineConfig({
  // The router plugin must run before react so generated routes are transformed too.
  plugins: [tanstackRouter({ target: 'react', autoCodeSplitting: true }), react()],
  build: {
    target: SUPPORTED_BROWSERS,
    // Without it the entry chunk, which holds zod-config, runs after the shared chunk that
    // builds the contract schemas, so zod probes for eval before jitless is set.
    rolldownOptions: { output: { strictExecutionOrder: true } },
  },
  server: {
    proxy: { '/api': `http://127.0.0.1:${process.env.API_PORT ?? DEFAULT_API_PORT}` },
  },
  preview: { headers: { 'Content-Security-Policy': CONTENT_SECURITY_POLICY } },
});
