import { Link } from '@tanstack/react-router';
import type { ErrorComponentProps } from '@tanstack/react-router';

import { ErrorNotice } from './ErrorNotice.tsx';
import { Panel } from './Panel.tsx';
import { sharedCopy } from './shared-copy.ts';

export const NotFoundScreen = () => (
  <Panel>
    <h2>{sharedCopy.routeFallback.notFoundTitle}</h2>
    <p>{sharedCopy.routeFallback.notFoundBody}</p>
    <Link to="/play">{sharedCopy.routeFallback.back}</Link>
  </Panel>
);

export const RouteErrorScreen = ({ error, reset }: ErrorComponentProps) => (
  <ErrorNotice error={error} onRetry={reset} />
);
