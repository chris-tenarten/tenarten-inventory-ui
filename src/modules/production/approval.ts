export const PRODUCTION_APPROVAL_WINDOW_MS = 2 * 60 * 1000;

export type ProductionApprovalDecision =
  | { state: 'missing_configuration'; expiration: null; clearStoredExpiration: boolean }
  | { state: 'password_required'; expiration: null; clearStoredExpiration: boolean }
  | { state: 'active'; expiration: number; clearStoredExpiration: false };

export function productionApprovalDecision(
  configuredPassword: string | undefined,
  storedExpiration: string | null,
  now: number,
): ProductionApprovalDecision {
  if (!configuredPassword?.trim()) {
    return { state: 'missing_configuration', expiration: null, clearStoredExpiration: storedExpiration !== null };
  }

  if (storedExpiration === null) {
    return { state: 'password_required', expiration: null, clearStoredExpiration: false };
  }

  if (!/^\d+$/.test(storedExpiration)) {
    return { state: 'password_required', expiration: null, clearStoredExpiration: true };
  }

  const expiration = Number(storedExpiration);
  const isValid = Number.isSafeInteger(expiration)
    && expiration > now
    && expiration <= now + PRODUCTION_APPROVAL_WINDOW_MS;

  return isValid
    ? { state: 'active', expiration, clearStoredExpiration: false }
    : { state: 'password_required', expiration: null, clearStoredExpiration: true };
}
