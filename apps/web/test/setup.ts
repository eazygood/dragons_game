import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// jsdom does not implement scrollTo; the router calls it on navigation and logs a warning.
window.scrollTo = () => undefined;

afterEach(() => {
  cleanup();
});
