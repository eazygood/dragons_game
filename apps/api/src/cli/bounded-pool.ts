// Runs `count` tasks with at most `concurrency` in flight; outcomes keep index order.
// A failed task never stops the rest: a benchmark reports a lost run, it does not
// throw away the other nineteen.
export const runBounded = async <T>({
  count,
  concurrency,
  task,
}: {
  count: number;
  concurrency: number;
  task: (index: number) => Promise<T>;
}): Promise<PromiseSettledResult<T>[]> => {
  const outcomes: PromiseSettledResult<T>[] = [];
  let nextIndex = 0;

  const worker = async () => {
    while (nextIndex < count) {
      const index = nextIndex;

      nextIndex += 1;

      try {
        outcomes[index] = { status: 'fulfilled', value: await task(index) };
      } catch (reason) {
        outcomes[index] = { status: 'rejected', reason };
      }
    }
  };

  await Promise.all(Array.from({ length: Math.min(concurrency, count) }, worker));

  return outcomes;
};
