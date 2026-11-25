// Runs `count` tasks with at most `concurrency` in flight; results keep index order.
// After the first failure no new task starts, and the rejection waits for the
// ones already running, so callers can safely release what those tasks use.
export const runBounded = async <T>({
  count,
  concurrency,
  task,
}: {
  count: number;
  concurrency: number;
  task: (index: number) => Promise<T>;
}): Promise<T[]> => {
  const results: T[] = [];
  let nextIndex = 0;
  let hasFailed = false;

  const worker = async () => {
    while (nextIndex < count && !hasFailed) {
      const index = nextIndex;

      nextIndex += 1;

      try {
        results[index] = await task(index);
      } catch (error) {
        hasFailed = true;
        throw error;
      }
    }
  };

  const settled = await Promise.allSettled(
    Array.from({ length: Math.min(concurrency, count) }, worker),
  );
  const rejection = settled.find((outcome) => outcome.status === 'rejected');

  if (rejection) {
    throw rejection.reason;
  }

  return results;
};
