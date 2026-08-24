export type OnboardingSpotlight = "bell" | "welcome" | null;

export type NotificationOnboardingState = {
  open: boolean;
  spotlight: OnboardingSpotlight;
};

export type NotificationOnboardingAction =
  | { type: "start" }
  | { type: "toggle" }
  | { type: "close" }
  | { type: "cancel-spotlight" }
  | { type: "set-spotlight"; spotlight: OnboardingSpotlight };

export const initialNotificationOnboardingState: NotificationOnboardingState = {
  open: false,
  spotlight: null,
};

export function notificationOnboardingReducer(
  state: NotificationOnboardingState,
  action: NotificationOnboardingAction,
): NotificationOnboardingState {
  switch (action.type) {
    case "start":
      return { open: false, spotlight: "bell" };
    case "toggle":
      if (state.open) return { open: false, spotlight: state.spotlight === "welcome" ? null : state.spotlight };
      return { open: true, spotlight: state.spotlight === "bell" ? "welcome" : state.spotlight };
    case "close":
      return { open: false, spotlight: state.spotlight === "welcome" ? null : state.spotlight };
    case "cancel-spotlight":
      return { ...state, spotlight: null };
    case "set-spotlight":
      return { ...state, spotlight: action.spotlight };
  }
}
