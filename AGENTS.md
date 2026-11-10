# TenOps public development boundary

This is a frontend-only cross-device source baseline with independent minimal history. Read README.md and PUBLICATION_BASELINE.json before work.

- Product acceptance and release authority remain with the project owner. This branch grants no migration, backend, rollout or deployment authority.
- Preserve existing work. Work in a task branch and keep changes within the requested scope.
- Never commit credentials, environment values, account/session state, employee/customer records, private evaluation evidence, database exports, backups or generated application outputs.
- Development fixtures and defaults must be clearly synthetic. Do not restore real account/record identifiers or personal contact defaults.
- The selected frontend shared helpers are not a complete backend. Do not deploy them or represent this branch as the portable TenBot v81 runtime.
- Use an approved nonproduction backend. Public source does not grant access to business data.
- Validate the changed behavior and inspect git diff before committing. Do not perform broad cleanup or dependency upgrades for unrelated work.
- Prefix development commit subjects with [CF-Pages-Skip] [skip ci] until deployment controls have been verified for the branch.
- No push, pull request, release or deployment without applicable authorization.
- Return only post-baseline task changes for isolated review in the authoritative Mac repository. Never merge unrelated histories or import the root snapshot wholesale.
