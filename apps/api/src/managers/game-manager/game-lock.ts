// One move per game at a time: a double click must not reach the upstream twice
// concurrently, and the second move must see the state the first one left.
const queues = new Map<string, Promise<void>>();

const ignore = () => undefined;

export const withGameLock = <T>({
  gameId,
  task,
}: {
  gameId: string;
  task: () => Promise<T>;
}): Promise<T> => {
  const previous = queues.get(gameId) ?? Promise.resolve();
  const current = previous.then(task);
  const settled = current.then(ignore, ignore);

  queues.set(gameId, settled);
  void settled.then(() => {
    if (queues.get(gameId) === settled) {
      queues.delete(gameId);
    }
  });

  return current;
};
