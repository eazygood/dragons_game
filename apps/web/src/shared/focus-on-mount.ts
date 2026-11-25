// A callback ref instead of an effect: focus is a one-off DOM side effect of mounting.
export const focusOnMount = (element: HTMLElement | null) => element?.focus();
