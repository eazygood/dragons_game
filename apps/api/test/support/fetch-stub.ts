import { vi } from 'vitest';

// Not routable, so a test that forgets to stub fetch fails instead of reaching a real host.
export const FETCH_STUB_BASE_URL = 'https://upstream.invalid/api/v2';

// A body that stays open, so cancelling it reaches `onCancel` as it would for a live socket.
export const openBody = ({ onCancel }: { onCancel: () => void }) =>
  new ReadableStream<Uint8Array>({
    start: (controller) => controller.enqueue(new TextEncoder().encode('<html>unread</html>')),
    cancel: onCancel,
  });

export const stubFetch = (...responses: Response[]) => {
  const fetchStub = vi.fn<typeof fetch>();

  for (const response of responses) {
    fetchStub.mockResolvedValueOnce(response);
  }

  vi.stubGlobal('fetch', fetchStub);

  return fetchStub;
};

export const failureOf = async (pending: Promise<unknown>) =>
  pending.then(
    () => undefined,
    (error: unknown) => error as Error,
  );
