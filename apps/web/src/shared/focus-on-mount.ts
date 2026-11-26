// Moves focus to a page heading after navigation, so a screen reader starts at the new page.
// A callback ref instead of an effect: focus is a one-off DOM side effect of mounting.
export const focusOnMount = (element: HTMLElement | null) => element?.focus();
