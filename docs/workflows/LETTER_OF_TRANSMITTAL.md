# Letter of Transmittal

## Entry point

Open a Production job in the Inspector and choose **Letter of Transmittal**
from Job Details. Every Transmittal is linked to one canonical `jobs.id`.

The panel contains:

- Create: document details, recipient, delivery and item types, item rows,
  purpose, comments, sender, preview, and final generation.
- History: immutable Transmittals for the selected job, newest first, with
  document status, preview, download, and failed-generation retry.

## Lifecycle

1. The composer prepopulates job number, project name, editable Customer Name,
   and current local date. Customer Name is initialized from `jobs.customer`
   for each newly opened editor but remains a document-only value; editing it
   never writes back to the Production job. The current editor is job-scoped,
   so switching jobs closes it and the next editor initializes from that job.
   Recipient Address accepts intentional line breaks and preserves them in
   preview and the immutable issued snapshot.
2. Preview renders the current unsaved values through
   `generate-job-transmittal-pdf`. It does not persist history, allocate a
   number, or upload a permanent file.
3. Final generation validates the form and calls `issue_job_transmittal`.
4. The RPC locks the job-document number prefix, verifies a manual override or
   allocates the next suffix, and inserts one immutable snapshot.
5. The Edge Function renders only the stored snapshot and uploads the PDF to
   the private `job-transmittal-documents` bucket.
6. The browser downloads the PDF from a short-lived signed URL.
7. If rendering or upload fails, the history record remains immutable with a
   failed document status and can retry the same snapshot and number.

## Controlled test cleanup

The August 3 pre-release audit identified Anthony's single July 29 controlled
test issuance for Heights Career Tech. The issued record
`64e117e8-e3f2-47d7-877d-50133a590bc4` and its exact private PDF were removed.
The canonical Production job `09402df6-6bd8-4e94-953e-fe7006a95491` was not
changed. Document number `0530-001` remains reserved in the shared registry as
an intentional sequence gap; it was not renumbered or reused. Verification
found no PO or activity record tied to the cleanup and no remaining Transmittal
for that job. Valid Transmittals and unrelated Storage objects remained outside
the exact-ID cleanup scope.

## Numbering

Automatic numbers are `<last four job-number digits>-<three-digit suffix>`.
Allocation begins at `001` when no conflicting document exists. Purchase Orders
and Letters of Transmittal consume the same per-job sequence in issuance order.
It checks:

- persisted Purchase Order numbers using the same prefix;
- persisted Letter of Transmittal numbers.

The hardening migration replaces the isolated allocators with a private shared
`job_document_numbers` registry and per-prefix sequence. Both Purchase Orders
and Transmittals reserve a globally unique normalized number in the same
transaction and under the same prefix lock. Manual overrides use the same
registry. Existing collisions cause the migration to abort for explicit
resolution; issued documents are never silently renumbered.

## Storage and document ownership

Permanent PDFs use:

```text
bucket: job-transmittal-documents
path: <transmittal-id>/<transmittal-number>.pdf
```

The bucket is private and accepts PDFs only. The Edge Function uploads with
the service role and creates ten-minute signed URLs.

Letters of Transmittal are not Project Files. Generation does not write
`job_attachments`, does not use the `job-attachments` bucket, and does not
change the Production Files tab.

## Interim access model

Migration `20260728_001_job_transmittals.sql` was applied before production
hardening. Forward migration
`20260728_002_job_transmittal_hardening.sql` keeps the canonical table,
number registry, number sequences, immutable snapshots, generation claims,
hashes, and storage metadata private. The anonymous browser role may execute
only validated RPCs for issuance, provisional numbering, and a bounded,
sanitized job-history projection. It cannot read or mutate the raw
`job_transmittals` table.

TenOps currently operates under an anonymous Supabase MVP access model behind
the browser-local shared-password gate. This is appropriate only for
Chris-only controlled internal testing under the current deployment
assumptions and is not suitable for public exposure. Sender names are
attributed snapshot values, not verified identities. Exact-origin CORS and
request validation reduce exposure but are not authentication. Supabase Auth
and role-aware authorization remain deferred to the RBAC initiative, which
will replace the temporary anonymous RPC grants.

The Edge Function uses the service role only after exact-origin, method,
body-size, action, request-shape, and UUID validation. Permanent generation
accepts only a persisted Transmittal ID, claims that immutable record
atomically, derives its snapshot, number, bucket, path, and filename on the
server, and returns only a short-lived signed URL. Requests without an
`Origin` header are rejected, including command-line tooling unless it supplies
an explicitly allowed origin.

## Production availability

Letter of Transmittal is a standard Production capability. The Production
Inspector always presents its launch control in the Documents section.

## Generation claims and recovery

Permanent generation uses a tokenized database claim. Pending, failed, and
stale-generating records can be claimed; an active claim cannot be stolen.
Only the matching claim token can mark an attempt generated or failed, so an
older failure cannot overwrite newer success. Generated records are
idempotently returned.

Storage completion and signed-link creation are separate. A signed-link
failure does not downgrade a stored generated document. Existing deterministic
objects are reused only when their bytes match the newly rendered immutable
snapshot.

## Deployment order

1. Run `supabase/inspection/20260728_001_job_transmittal_hardening_preflight.sql`.
2. Resolve any PO/Transmittal collisions or malformed test records explicitly.
3. Apply `20260728_002_job_transmittal_hardening.sql`.
4. Verify grants, policies, registry bootstrap, and claim RPCs.
5. Deploy `generate-job-transmittal-pdf`.
6. Configure `TENOPS_ALLOWED_ORIGINS` with exact local and deployed TenOps
   origins; retain the existing logo secret.
7. Deploy the Edge Function.
8. Deploy the app and perform Letter of Transmittal workflow and Purchase Order
   regression testing.

Before the editable Customer Name release, apply and verify the pending
forward migration `20260803_002_job_transmittal_editable_customer.sql`, then
deploy the updated `generate-job-transmittal-pdf` Edge Function before the
frontend. The migration preserves canonical `jobs.id`, existing issued
snapshots, shared numbering, and the existing anonymous MVP RPC boundary.
