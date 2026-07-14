# Job Attachments

## Existing model

Job attachments are already implemented using:

- `public.job_attachments`
- private Supabase Storage bucket: `job-attachments`

## Expected behavior

- files belong to a job
- multiple files may be selected
- files may be opened through signed URLs
- files may be removed
- attachment count appears in the production table
- historical job files remain job-centered

## Planned UX improvement

Provide a drag-and-drop staging area for uploading a complete job packet.

Potential staging behavior:

- drag several files at once
- display file names and sizes
- optionally classify each file
- upload all staged files
- report errors per file
- do not cancel successful uploads because one file failed

## Document types

Current or likely values:

- Estimate
- Work Order
- Blend Sheet
- Shop Drawing
- Cut Ticket
- Color Plate
- Sample / Approval
- Purchase Order
- Photo
- Other

Document types may become configurable reference data later.
