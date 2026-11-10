export const PRODUCTION_APPROVAL_WINDOW_MS = 2 * 60 * 1000;
const ADDITIONAL_PRODUCTION_APPROVAL_PASSWORDS = new Set(['coppola']);

export type ProductionApprovalDecision =
  | { state: 'missing_configuration'; expiration: null; clearStoredExpiration: boolean }
  | { state: 'password_required'; expiration: null; clearStoredExpiration: boolean }
  | { state: 'active'; expiration: number; clearStoredExpiration: false };

export function isProductionApprovalPasswordAccepted(
  enteredPassword: string,
  configuredPassword: string | undefined,
): boolean {
  return enteredPassword === configuredPassword?.trim()
    || ADDITIONAL_PRODUCTION_APPROVAL_PASSWORDS.has(enteredPassword);
}

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
