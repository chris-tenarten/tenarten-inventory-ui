# Desktop Contacts icon release

Both environments aligned at daa79324531476f91e9e2be9e254050335e895c9. Two source files remove the desktop Contacts icon and card Directory ID text. Existing Customer Inspector already hides raw IDs. Accepted local browser validation reused. Production Web Push source and service worker remain byte-identical to baseline. Label, order, link, permission predicate and mobile implementation preserved. Tier 1 / Testing Level 1: targeted ESLint, diff check, separate Production builds including TypeScript, branding, served root/manifest integrity, deployed revision and one desktop browser icon check per environment passed. Existing release tooling and worktrees reused. No broader suite or new test script. Normal authentication, Supabase, RBAC and parallel Web Push unchanged. Synthetic review infrastructure excluded from exports.

tendev: 7ec743a2-d57a-49dd-8bf1-4a23f28bebad; TenDev / RESEARCH & DEVELOPMENT
tenops: 6cc7ff0f-c77d-4fb9-b579-1fc80638223b; TenOps / OPERATIONS CONTROL

Rollback base: e6d1cbc58d4bc622f1cfe99adde3c9bc7d005ae3; refs rollback/contacts-cleanup-20261022-main, rollback/contacts-cleanup-20261022-dev. Essential hosted checks: served root/manifest/service-worker byte integrity, service-worker cache/scope headers, correct branding and one combined Contacts browser check per environment. Browser Auth/data interception only; no hosted business writes. [Evidence](evidence/2026-10-22-contacts-cleanup-release.json).
