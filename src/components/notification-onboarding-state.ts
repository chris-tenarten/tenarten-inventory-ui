export type OnboardingSpotlight = "bell" | "welcome" | null;

export type NotificationOnboardingState = {
  open: boolean;
  spotlight: OnboardingSpotlight;
  arrivalNotificationId: string | null;
};

export type NotificationOnboardingAction =
  | { type: "start" }
  | { type: "toggle" }
  | { type: "close" }
  | { type: "cancel-spotlight" }
  | { type: "set-spotlight"; spotlight: OnboardingSpotlight }
  | { type: "focus-arrival"; notificationId: string }
  | { type: "finish-arrival" }
  | { type: "reset" };

export const initialNotificationOnboardingState: NotificationOnboardingState = {
  open: false,
  spotlight: null,
  arrivalNotificationId: null,
};

export function notificationOnboardingReducer(
  state: NotificationOnboardingState,
  action: NotificationOnboardingAction,
): NotificationOnboardingState {
  switch (action.type) {
    case "start":
      return { open: false, spotlight: "bell", arrivalNotificationId: null };
    case "toggle":
      // Arrival attention owns the interaction until the user explicitly views or
      // dismisses it. Bell spam must never independently release or duplicate it.
      if (state.arrivalNotificationId) return state;
      if (state.open) return { ...state, open: false, spotlight: state.spotlight === "welcome" ? null : state.spotlight };
      return { ...state, open: true, spotlight: state.spotlight === "bell" ? "welcome" : state.spotlight };
    case "close":
      return { open: false, spotlight: state.spotlight === "welcome" ? null : state.spotlight, arrivalNotificationId: null };
    case "cancel-spotlight":
      return { ...state, spotlight: null };
    case "set-spotlight":
      return { ...state, spotlight: action.spotlight };
    case "focus-arrival":
      // Onboarding and an existing arrival are authoritative; co-arrivals remain
      // ordinary unread notifications instead of creating stacked locks.
      if (state.spotlight || state.arrivalNotificationId) return state;
      return { ...state, open: true, arrivalNotificationId: action.notificationId };
    case "finish-arrival":
      return { ...state, open: false, arrivalNotificationId: null };
    case "reset":
      return initialNotificationOnboardingState;
  }
}
