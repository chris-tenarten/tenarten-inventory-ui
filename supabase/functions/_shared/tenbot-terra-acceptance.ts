/** Server-only, temporary TenDev inference authority. This grants no tool or write permissions. */
export type TerraAcceptanceConfig = {
 enabled: boolean;
 ownerIds: string[];
 startsAt: string;
 expiresAt: string;
};
export type TerraAcceptanceScope = {
 owner: string;
 origin: string;
 hostedEnabled: boolean;
 modelDirectedReads: boolean;
};
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_WINDOW_MS = 24 * 60 * 60 * 1000;

/** Re-evaluate before every reservation and provider dispatch, including later rounds. */
export function terraAcceptanceSpendingAuthorized(config: TerraAcceptanceConfig, scope: TerraAcceptanceScope, now = Date.now()): boolean {
 const starts = Date.parse(config.startsAt), expires = Date.parse(config.expiresAt);
 return config.enabled === true && scope.origin === 'https://tendev.pages.dev'
  && scope.hostedEnabled === true && scope.modelDirectedReads === true
  && UUID.test(scope.owner) && config.ownerIds.includes(scope.owner)
  && Number.isFinite(now) && Number.isFinite(starts) && Number.isFinite(expires)
  && expires > starts && expires - starts <= MAX_WINDOW_MS && starts <= now && now < expires;
}
