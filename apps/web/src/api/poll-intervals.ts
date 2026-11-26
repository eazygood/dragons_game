export const WATCH_POLL_INTERVAL_MS = 1000;

// The move list grows by one row per turn and is read from the database, so it needs
// no faster a poll than the status bar does, and a full list is the heavier response.
export const MOVE_HISTORY_POLL_INTERVAL_MS = 2500;
