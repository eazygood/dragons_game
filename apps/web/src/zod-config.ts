import { z } from 'zod';

// zod probes for eval support with `new Function`; the CSP forbids eval, so every page
// load would log a violation. Must be imported before any module that builds a schema.
z.config({ jitless: true });
