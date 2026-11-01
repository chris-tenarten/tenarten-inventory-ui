# Messaging and Production follow-up selective proof

## Accepted candidate source review — Messaging and Production follow-ups, November 1, 2026

Chris approves e61d333ccfb2fed1f1488ad8071d169cf67c73b7 and 2723b1e6286885222c43f58bbfd4de66fcd79854 for selective TenDev staging in APPROVED MESSAGING & FOLLOW-UP STAGING. Advisory unavailable; this current explicit Product instruction controls.

Scope: tendev-preparation.
This review is not evidence of hosted application or deployment.
This review grants no migration application, write activation, push or deployment authority.

The separate current Product instruction authorizes matched TenDev UI/Edge deployment only after the unchanged release-proof gate and build pass. Existing persistent-history TenDev baseline 9415adc577e5509c2473001fbd514ab644077e3c is preserved. No new migration, provider, spending, permissions or operational-write activation is included.

| Path | Git blob | SHA256 | Authority | Kind | Accepted authority revision |
|---|---|---|---|---|---|
| supabase/functions/_shared/tenbot-job-routing.ts | 17123374c896bce71181ea51272a4c681573b642 | 3da8e3ae9346d34eea74d5be752f6848b02d96add71125d6b90ad2d10a232fc4 | product-accepted | runtime | 2723b1e6286885222c43f58bbfd4de66fcd79854 |
| supabase/functions/_shared/tenbot-conversation-context.ts | 52930d2ad7cd67d53f84dd5a7f59edd02f875b87 | 8c73b45b326088b8ef7f6866151afe830128f687c46ff6c18d8530329975a5a7 | product-accepted | runtime | 2723b1e6286885222c43f58bbfd4de66fcd79854 |
| supabase/functions/_shared/tenbot-job-presentation.ts | 441a4dc637199d652a58b6e179fbfdebd5585d11 | e183f95316f2207f86541afde5f7237401d3109d25747036d003275e2ba48acc | product-accepted | runtime | 2723b1e6286885222c43f58bbfd4de66fcd79854 |

The three exact Edge files refine existing canonical Production status selectors using the retained subject, replace a prior status only when explicitly requested and keep count/filtered enumeration consistent. Caller-scoped tools, current permissions, source validation, historical redaction, deterministic metrics and existing model boundaries remain enforced. A short On Deck follow-up no longer falls to unrelated knowledge; explicit My Work/task wording is still guidance. There is no new tool, SQL gateway, data cache or permission. The shared Edge service remains read-only with existing Origin separation and Production history transport guard; no TenOps Pages release or persistent-Production activation.

Existing knowledge entries, patches, generator, source verifier and release authority remain unchanged. Prior candidate tuples replaced by exact accepted bytes are retained as historical supersession evidence. All migration bytes remain exactly the accepted TenDev baseline; their original historical candidate evidence is not rewritten as proof of hosted application. No new inference, funding or operational write is authorized.

## Accepted record source review — Messaging presentation, November 1, 2026

Chris approves the exact Messaging presentation changes in e61d333ccfb2fed1f1488ad8071d169cf67c73b7 for this TenDev staging.
Business meaning, permission policy, lifecycle and effects are unchanged for the seven DM/group Messaging knowledge records below.

Only selected-thread styling/aria-current/focus ring changes in InboxDialog. The system TenBot row is stably pinned before unchanged employee/group recency order; existing dropdown openAssistant navigation is restored. Historical notices distinguish legacy loss, access/source restriction and temporary verification without revealing any restricted prose. Verified persistent history wins over a stale local marker. No DM/group membership, creation, editing, reply, sharing, attachment, draft persistence, participant-only privacy or posting semantics change. All ordinary Messaging server contracts remain untouched.

| Record | Primary path | Original semantic source | Reviewed source | Record content/authority digest |
|---|---|---|---|---|
| dm | src/modules/my-work/InboxDialog.tsx | 1e2fe3d86211d6819f0b38170e305ee4142764bf | 44c2d1a6d06c4280bb7a94c2e79b64e408c4b594 | bc307fd6417f038fcff168d590a4ad46b7107ea36665e67a71fc5a6d55c16910 |
| group | src/modules/my-work/InboxDialog.tsx | 1e2fe3d86211d6819f0b38170e305ee4142764bf | 44c2d1a6d06c4280bb7a94c2e79b64e408c4b594 | 6e87c76817da022ca9355b2d1596ae9548df742613d915c75db6b4e88e293e9b |
| message-attachments | src/modules/my-work/InboxDialog.tsx | 1e2fe3d86211d6819f0b38170e305ee4142764bf | 44c2d1a6d06c4280bb7a94c2e79b64e408c4b594 | a6855e912e9f78b26d9305924519b1c0cf53f27dd4459f7694d551a0bd454282 |
| message-reply | src/modules/my-work/InboxDialog.tsx | 1e2fe3d86211d6819f0b38170e305ee4142764bf | 44c2d1a6d06c4280bb7a94c2e79b64e408c4b594 | 065244fc9a7c4116d49cc1b1d89b058d01632ebc41fbfff3cb2c31433eae01c7 |
| share-job | src/modules/my-work/InboxDialog.tsx | 1e2fe3d86211d6819f0b38170e305ee4142764bf | 44c2d1a6d06c4280bb7a94c2e79b64e408c4b594 | fc4df7a747c85087a62ad91cf7b8e7988ed857a445366406ea9704549dde436b |
| workflow-message-drafts | src/modules/my-work/InboxDialog.tsx | 1e2fe3d86211d6819f0b38170e305ee4142764bf | 44c2d1a6d06c4280bb7a94c2e79b64e408c4b594 | 2dfa7d12fe043f2e664cfb790afe5e42f079aece85a86c3d9e1649367db51cae |
| workflow-message-edit | src/modules/my-work/InboxDialog.tsx | 1e2fe3d86211d6819f0b38170e305ee4142764bf | 44c2d1a6d06c4280bb7a94c2e79b64e408c4b594 | 7dcffd764fbb864982286711333092b30d6f73fccb0c195797a8bc1a60791628 |

Reviewed additional presentation dependencies (same exact accepted source tree):
- src/components/GlobalMessaging.tsx: 2d305a5f6f2ecb55aa2d2fa57d6f5032056665bb
- src/modules/my-work/inbox.ts: 75a07f550fd894b3572b7648c83d684a52fe0684
- src/modules/tenbot/TenbotWorkspace.tsx: 9dac5a2fe2689c471837ac0a849900eb7bdf9fe9
- src/modules/tenbot/history-presentation.ts: e5ddaa3b540e4994b8d80e3369997bdadf0d036d

The source authority is the current explicit Product acceptance, not this developer receipt alone. The reviewed candidate binds the exact accepted bytes; old semantic claims and digests remain unchanged and old source receipts are preserved, superseded only for their changed source-byte tuple. This is preparation-only evidence and cannot authorize migration, funding, permission changes, unrestricted history access or deployment independently.
