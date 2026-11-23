// Game Over is a terminal state every upstream call can reach, so it is a result, not an error.
export type UpstreamResult<T> = { status: 'ok'; value: T } | { status: 'game_over' };
