import { QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from '@tanstack/react-router';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { z } from 'zod';

import { createQueryClient } from './query-client.ts';
import { router } from './router.tsx';
import './styles/tokens.css';

// zod probes for eval support with `new Function`; the CSP forbids eval, so every page
// load would log a violation. Jitless parsing skips the probe.
z.config({ jitless: true });

const ROOT_ELEMENT_ID = 'root';

const rootElement = document.getElementById(ROOT_ELEMENT_ID);

if (!rootElement) {
  throw new Error(`Missing #${ROOT_ELEMENT_ID} element`);
}

createRoot(rootElement).render(
  <StrictMode>
    <QueryClientProvider client={createQueryClient()}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
);
