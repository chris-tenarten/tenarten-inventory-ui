# Compact mobile footer release

RELEASED BOTH. Canonical local/remote main/dev and both served revisions: `c490747c08404a3b2877538404d9af8bf98460a6`.

Accepted candidate `bcfe6d8b9ae2f4c579436c5e1352cbcac4ae10db`; verified parent `83d0343bf1058dd0a6f21f4abaca194de5211498`. Integration tree exactly matches the accepted candidate. Only application delta: shared mobile row 52px to 44px; full portrait footer 87px to 79px with the existing 34px safe area.

- tendev: `811128bb-2dc9-4022-9288-8213d978a879`, TenDev / RESEARCH & DEVELOPMENT; 62 served byte matches and one focused mobile-maintenance group passed.
- tenops: `e183bfd2-02a6-47c0-94be-e39fdfb22e0f`, TenOps / OPERATIONS CONTROL; 62 served byte matches and one focused mobile-maintenance group passed.

Tier 1 / focused Level 1 release. Reused 36 candidate layout combinations, full startup playback, TypeScript, targeted lint, diff and Production build evidence. Built TenDev separately; reused the exact-tree Production export after current public-configuration, branding, source/artifact identity and exclusion checks. Production branding explicitly false. Existing release checkouts reused; no additional worktrees or new verification scripts. Prior artifact backups moved outside checkouts to satisfy the clean-status gate before any push/deployment.

Canonical promotion was atomic with skip markers; all four Git-trigger records confirmed skipped. No competing deployment at either deployment gate or completion. TenDev deployed, passed asset/branding/footer gates, then TenOps deployed and passed the same gates. Both complete artifact manifests and rollback bundle preserved in `.tmp-footer-release`.

Startup animation, Web Push and service-worker bytes, Contacts, all other application modules and backend configuration unchanged. No migrations, hosted business-data writes, credentials/scopes or infrastructure changes. Hosted mobile checks used existing intercepted fixtures; no live accounts created or Web Push test sends. Physical installed-PWA checks were not repeated.

Rollback refs: `rollback/mobile-footer-20261021-main` / `rollback/mobile-footer-20261021-dev` at `83d0343bf1058dd0a6f21f4abaca194de5211498`. Previous deployment IDs and bundle hash are in the [machine receipt](evidence/2026-10-21-mobile-footer-44-release.json). Original candidate and unrelated worktrees/root changes preserved. This local receipt remains uncommitted to preserve the deployed revision.
