# Supabase backup and recovery — November 2, 2026

**Status:** database backup availability verified read-only; Storage export tooling implemented locally. No restoration, hosted configuration change, new service, paid add-on, schedule, or operational write was performed. Authority is Chris's current **Infrastructure & TenBot Simplification** prompt; separate Advisory context was unavailable. This is the backup portion of the Tier 3 pass.

## Verified recovery position

Fresh authenticated Management API requests returned HTTP 200 for the `tenarten-terrazzo` organization, `tenartenDB` (`vxdxjhazkqhpkwdqtobp`) backup list, and Storage bucket inventory. Organization plan is **Pro**. Backup response reports `walg_enabled: true`, `pitr_enabled: false`, and these **nine COMPLETED physical recovery points**:

| Recovery point (UTC) | Backup ID |
| --- | --- |
| 2026-11-02 10:21:16.550 | 2145099873 |
| 2026-11-01 10:22:35.233 | 2135261141 |
| 2026-10-31 10:21:22.928 | 2125506758 |
| 2026-10-30 23:56:28.678 | 2119021657 |
| 2026-10-30 10:30:00.715 | 2115737813 |
| 2026-10-29 10:27:34.578 | 2105989414 |
| 2026-10-28 10:22:55.574 | 2096183203 |
| 2026-10-27 10:21:23.279 | 2086457919 |
| 2026-10-26 10:21:28.378 | 2076777136 |

These are observed available points, not an entitlement to nine days. Supabase's current [backup documentation](https://supabase.com/docs/guides/platform/backups) and [pricing](https://supabase.com/pricing) specify **daily backups retained for seven days on Pro**. The observed extra points do not extend that guarantee. Daily recovery may lose changes since the selected point; PITR is disabled and was not enabled. Small compute does not itself purchase PITR. Restoration capability was not destructively tested.

The verified calls were GET `/v1/organizations/uxxhpnseynojdgabanrv`, GET `/v1/projects/vxdxjhazkqhpkwdqtobp/database/backups`, and GET `/v1/projects/vxdxjhazkqhpkwdqtobp/storage/buckets`. Existing locally authorized CLI credentials remained in memory and were not printed or copied. [The supported backup-list API](https://supabase.com/docs/reference/api/v1-list-all-backups) requires `backups_read`; no dashboard-only step blocked this verification.

## Storage needs independent protection

Supabase database backups contain Storage **metadata, not object bytes**. A database restore cannot recover an attachment deleted after its backup. All twelve hosted buckets were verified private:

| Buckets | Important contents |
| --- | --- |
| `job-attachments`, `project-task-attachments` | Job and planning/task attachments |
| `purchase-order-documents`, `job-transmittal-documents`, `receiving-documents`, `proposal-documents` | Issued or generated business documents |
| `sample-documents`, `historical-samples` | Sample documents and preserved import originals |
| `bid-files` | Bid attachments |
| `my-work-attachments`, `my-work-inbox-attachments` | Private task and Messaging attachments |
| `invoice-receival-originals` | Original invoice evidence |

This inventory reads bucket configuration only. No private attachment names or content were inspected. Repository references establish domain purpose; bucket presence alone does not prove that each bucket currently contains objects. Static vendor PDFs in `public/vendor-pdfs` are protected through repository/source backups, separately from Storage.

## Lightweight independent copy

Use the included [download-only exporter](../../scripts/backup-tenops-storage.mjs) for the actual gap: opaque copies of the twelve Storage buckets. It uses the supported [Supabase CLI Storage copy command](https://supabase.com/docs/reference/cli/supabase-storage-cp); it cannot upload, delete, restore, or change hosted settings. It checks the linked project is `tenartenDB`, requires a new destination outside the repository under an owner-only parent, keeps CLI logs/object paths private, and writes per-file SHA-256/byte counts. A failed copy leaves an explicitly incomplete snapshot. No remote mirroring or automatic retention deletion occurs.

Owner setup is deliberately small: choose an **existing encrypted backup disk/location** with appropriate private access, create a `0700` parent there, and use an already authenticated official Supabase CLI (`supabase` on PATH, or `TENOPS_SUPABASE_CLI` set to its absolute executable path). Then run:

```sh
node scripts/backup-tenops-storage.mjs --encrypted-destination /absolute/private/backup-volume/tenops-2026-11-02
```

The flag is the operator's declaration that the destination is encrypted; the script cannot verify disk encryption. Keep the backup separate from the working computer via the owner's existing backup arrangement. Never commit its manifest, logs, object paths, or binaries. Backup authority does not grant employees or administrators routine browsing access to private Messaging/My Work contents.

Start with a weekly copy and a copy before consequential document/attachment cleanup; retain four weekly copies and a pre-change copy using the existing backup destination's retention controls. This is an operating recommendation, **not an installed schedule**. Review the bucket inventory when new attachment domains are added. Daily database backups remain the primary database protection; a second daily SQL scheduler adds little value here. For a portable pre-change database export when needed, use Supabase's [supported CLI backup guide](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore), keep its roles/schema/data outputs encrypted, and include Storage separately.

**Remaining owner action:** select the encrypted independent destination and run the first real Storage copy. No suitable existing destination was established in this pass, so no actual Storage backup or restore success is claimed. Installed CLI discovery encountered its normal local telemetry write outside the sandbox; the elevated help request was interrupted. Exporter validation therefore used a fake CLI for command direction, failure handling and manifest integrity, not a real hosted Storage download.

## Recovery procedure

1. Stop the affected workflow and capture the incident time/scope. Preserve current data and existing backups; do not retry bulk writes or delete evidence.
2. For database damage, inspect **tenartenDB → Database → Backups** and select the closest completed point **before** the incident. Estimate lost changes and downtime with Chris. Prefer a separately authorized isolated recovery destination for investigation; do not restore Production without Chris's explicit approval.
3. After approval, use Supabase's supported dashboard recovery flow. A restore makes the project unavailable while it runs. Reconcile custom role passwords and any non-Realtime replication subscriptions as described in the provider guide. Hosted configuration, credentials and Edge/Pages deployments require their own known configuration/source receipts; a database point is not a complete application backup.
4. Recover missing Storage objects from the independent snapshot at their exact bucket/path using an owner-authorized restore operation. Verify `status.json` says complete and recalculate manifest SHA-256/byte counts first. Do not restore private objects into public buckets. Do not blindly upload everything or overwrite valid newer documents.
5. Reconcile restored database metadata with object bytes. Storage copies are not transactional with database backups: preserve issued-document snapshots, check missing/newer objects and original source hashes, and resolve mismatches before resuming employees.
6. Verify Auth/RLS, private Messaging/task isolation, Job attachment access, issued document downloads and core Job/inventory reads on the recovered environment. Record the selected point, remaining data loss and explicit acceptance before resuming Production writes.

No real recovery drill was run. A small isolated restore/download drill is the next proof of end-to-end recoverability after an independent copy exists; it is separate from this read-only verification and does not authorize creating paid resources.

## Focused validation

The inline `node --input-type=module` harness imported `backup`, `BUCKETS` and `inventory` from `./scripts/backup-tenops-storage.mjs` and retained its synthetic output under `/private/tmp/tenops-storage-backup-check-iSYRt7`. **Seven checks passed:** twelve download-only CLI invocations; manifest SHA-256/byte counts and complete marker; existing destination rejection; encrypted-destination declaration required; repository destination rejection; failed copy retaining `complete: false`; and symlink rejection during manifest inventory. The harness used an injected fake CLI and opaque synthetic bytes; actual hosted downloads were zero. `node --check scripts/backup-tenops-storage.mjs`, `./node_modules/.bin/eslint scripts/backup-tenops-storage.mjs` and `git diff --check -- scripts/backup-tenops-storage.mjs docs/project-memory/2026-11-02-supabase-backup-recovery.md` each exited 0. The hosted GET results were summarized directly in this document; no separate raw response or object-content evidence file was retained.
