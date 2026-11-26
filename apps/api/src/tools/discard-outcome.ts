// Settles a promise chain on either outcome, for chains that only exist to order work and must
// stay alive after a rejection.
export const discardOutcome = () => undefined;
