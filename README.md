# TenOps cross-device frontend

Accepted frontend source prepared for development on Mac and Windows. The source baseline is Production commit 301a6bd1b34698a212c1e5652b424ed4a62c7ce1, including Calendar, My Work, employee-scoped Messaging display preferences and Job Sharing.

This branch starts with independent minimal history. It does not replace the authoritative Mac repository or authorize a release.

## Local development

Use Node.js 24.x and the checked-in package lock. Create a local .env.local through your existing private configuration process with these required names:

- NEXT_PUBLIC_SUPABASE_URL
- NEXT_PUBLIC_SUPABASE_ANON_KEY

No environment values or credentials are included. Use an approved nonproduction backend and sign in normally.

For nonadmin Production/Calendar access, privately configure NEXT_PUBLIC_ADMIN_ONLY_PRODUCTION_FIXTURE_ID to preserve the existing fixture exclusion. It is a browser-visible record identifier, not a secret credential, and its value must remain outside public Git. When this configuration is absent or invalid, nonadmin Production Job lists fail closed. Admin behavior is unchanged.

    npm ci
    npm run dev

Open http://localhost:3000. For a static frontend build:

    npm run build -- --webpack

The package scripts are limited to dev/build/lint. Dependency declarations and the lockfile match the accepted source.

## Publication profile

Personal employee/contact defaults, live record identifiers and personalized artwork are replaced or omitted. Vendor datasets and reference PDFs are omitted; vendor catalog/reference-document features need separately approved local resources. Do not add those resources to public commits.

Calendar/My Work, Messaging preference and Job Sharing behavior source is retained. The public development defaults are not a Production configuration.

The small supabase/functions/_shared subset contains authored helpers imported by the frontend. It is not a backend deployment. The separate portable TenBot v81 reference, generated server knowledge, backend runtime, migrations, private evaluation evidence and release tooling are not included.

## Cross-device changes

Create a task branch descended from this baseline and review every diff before committing. Keep environment files, credentials, business records, private evaluation evidence, generated exports, backups and dependencies out of Git.

Until branch deployment controls are verified, prefix development commit subjects with [CF-Pages-Skip] [skip ci]. No push or pull request is authorized by this source preparation.

Return only reviewed changes after this root commit to an isolated Mac integration workspace. Do not merge unrelated histories or cherry-pick the root snapshot into canonical dev/main. Reconcile against the current accepted frontend before integrating a task's changes.
