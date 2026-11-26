import { discardOutcome } from '../../entities/discard-outcome.ts';

// One move per game at a time: a double click must not reach the upstream twice
// concurrently, and the second move must see the state the first one left.
const pendingTasksByGame = new Map<string, Promise<void>>();

export const withGameLock = <T>({
  gameId,
  task,
}: {
  gameId: string;
  task: () => Promise<T>;
}): Promise<T> => {
  const previousTask = pendingTasksByGame.get(gameId) ?? Promise.resolve();
  const currentTask = previousTask.then(task);
  const settled = currentTask.then(discardOutcome, discardOutcome);

  pendingTasksByGame.set(gameId, settled);
  void settled.then(() => {
    if (pendingTasksByGame.get(gameId) === settled) {
      pendingTasksByGame.delete(gameId);
    }
  });

  return currentTask;
};
