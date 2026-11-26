import { sharedCopy } from './shared-copy.ts';

const TITLE_SEPARATOR = ' · ';

export const pageHead = ({ title }: { title?: string } = {}) => ({
  meta: [
    { title: title ? `${title}${TITLE_SEPARATOR}${sharedCopy.appTitle}` : sharedCopy.appTitle },
  ],
});
