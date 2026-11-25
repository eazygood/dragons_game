const PENDING_PROBE_MS = 50;

// A promise that settles within the probe window is not pending; one that outlasts it is.
export const isPending = ({ promise }: { promise: Promise<unknown> }) =>
  Promise.race([
    promise.then(() => false),
    new Promise<boolean>((resolve) => setTimeout(resolve, PENDING_PROBE_MS, true)),
  ]);
