import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { ApiError, UNREACHABLE_STATUS } from '../src/api/api-error.ts';
import { ErrorNotice } from '../src/shared/ErrorNotice.tsx';
import { RefreshHint } from '../src/shared/RefreshHint.tsx';
import { sharedCopy } from '../src/shared/shared-copy.ts';

const UNREACHABLE = new ApiError({
  status: UNREACHABLE_STATUS,
  code: 'unreachable',
  message: 'offline',
});

describe('ErrorNotice', () => {
  it('names the problem and retries on click', async () => {
    const onRetry = vi.fn();

    render(<ErrorNotice error={UNREACHABLE} onRetry={onRetry} />);
    await userEvent.click(screen.getByRole('button', { name: sharedCopy.errors.retry }));

    expect(screen.getByRole('alert')).toHaveTextContent(sharedCopy.errors.unreachable);
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('disables Retry and says it is retrying while the retry is in flight', async () => {
    const onRetry = vi.fn();

    render(<ErrorNotice error={UNREACHABLE} onRetry={onRetry} isRetrying />);
    const button = screen.getByRole('button', { name: sharedCopy.errors.retrying });

    await userEvent.click(button);

    expect(button).toBeDisabled();
    expect(onRetry).not.toHaveBeenCalled();
  });
});

describe('RefreshHint', () => {
  it('is an empty status region until a refresh fails', () => {
    render(<RefreshHint hasFailed={false} />);

    expect(screen.getByRole('status')).toBeEmptyDOMElement();
  });

  it('puts the text into the same region when a refresh fails, so it is announced', () => {
    const { rerender } = render(<RefreshHint hasFailed={false} />);
    const region = screen.getByRole('status');

    rerender(<RefreshHint hasFailed />);

    expect(screen.getByRole('status')).toBe(region);
    expect(region).toHaveTextContent(sharedCopy.errors.refreshFailed);
  });
});
