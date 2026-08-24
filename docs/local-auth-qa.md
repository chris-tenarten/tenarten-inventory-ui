# TenOps local Auth QA

This isolated harness tests account setup and password recovery through local Supabase Auth and its local email inbox. It does not load the TenOps production migration directory, use hosted credentials, send real email, or change ordinary `npm run dev` behavior.

## Start

Docker Desktop must be running.
Stop any ordinary TenOps dev server already using port 3000 before starting the QA frontend.

```bash
npm run auth:qa:start
npm run auth:qa:reset
npm run auth:qa:dev
```

Open TenOps at `http://localhost:3000`. Open the local email inbox at `http://127.0.0.1:54324`.

## Pending-account setup

The pending fixture is `pending.user@tenops.local`. It intentionally has no usable password.

1. Open the TenOps login screen and dismiss the cutover notice.
2. Choose **Need to set or reset your password?**.
3. Enter `pending.user@tenops.local` and choose **Set up account**.
4. Open the newest local setup message in Mailpit and follow its link.
5. Set and confirm a password of at least 10 characters.
6. Confirm TenOps closes the temporary callback session and returns to normal sign-in.
7. Sign in with the new password. The local profile should display **Pending User**, role **Member**, active.

## Confirmed-account recovery

The confirmed fixture starts as:

- Email: `confirmed.user@tenops.local`
- Password: `ConfirmedTest!2026`

1. Choose **Need to set or reset your password?**.
2. Enter `confirmed.user@tenops.local` and choose **Reset password**.
3. Open the newest local recovery message in Mailpit and follow its link.
4. Set and confirm a new password of at least 10 characters.
5. Confirm TenOps closes the callback session.
6. Sign in with the new password.

## Repeat or stop

Restore both disposable users and their original states at any time:

```bash
npm run auth:qa:reset
```

The reset helper obtains credentials from the running local stack and refuses any URL other than `localhost:54321` or `127.0.0.1:54321`.

Stop the isolated stack:

```bash
npm run auth:qa:stop
```

Return to ordinary localhost development with:

```bash
npm run dev
```

Ordinary development continues to use `.env.local`; the Auth QA commands do not rewrite it.

## Automated local flow check

With the local stack running, this command sends only local Mailpit messages, consumes both disposable callback links, sets passwords, verifies normal password sign-in and the local `app_users` profile, then restores both fixtures:

```bash
npm run auth:qa:verify-flow
```
