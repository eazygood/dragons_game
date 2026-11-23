// Runs `count` tasks with at most `concurrency` in flight; results keep index order.
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
  let next = 0;

  const worker = async () => {
    while (next < count) {
      const index = next;

      next += 1;
      results[index] = await task(index);
    }
  };

  await Promise.all(Array.from({ length: Math.min(concurrency, count) }, worker));

  return results;
};
