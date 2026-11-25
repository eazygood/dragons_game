type LaunchMutation = { isPending: boolean; isSuccess: boolean };

// isPending clears before the navigation commits, and a click in that gap would start a second game.
export const isLaunchLocked = ({ mutations }: { mutations: LaunchMutation[] }) =>
  mutations.some(({ isPending, isSuccess }) => isPending || isSuccess);
