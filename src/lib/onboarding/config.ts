/** Default overlay opacity (0–1). Lower than legacy 0.55 for comfort. */
export const ONBOARDING_OVERLAY_ALPHA = 0.42;

/** Softer overlay when reduced motion / reduced contrast is preferred. */
export const ONBOARDING_OVERLAY_ALPHA_SOFT = 0.28;

/** Delay before auto-start when the page is idle (ms). */
export const ONBOARDING_AUTO_START_IDLE_MS = 400;

/** Maximum wait for idle callback before forcing auto-start (ms). */
export const ONBOARDING_AUTO_START_MAX_WAIT_MS = 2500;

export function getOnboardingOverlayAlpha(soft: boolean): number {
  return soft ? ONBOARDING_OVERLAY_ALPHA_SOFT : ONBOARDING_OVERLAY_ALPHA;
}
