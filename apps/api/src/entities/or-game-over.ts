// Game Over is a terminal state every game call can reach, upstream or local, so it is a
// result, not an error.
export type OrGameOver<T> = { status: 'ok'; value: T } | { status: 'game_over' };
