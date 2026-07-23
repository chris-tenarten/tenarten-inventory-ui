# TenOps UI Scaling

TenOps supports `compact`, `default`, and `large` interactive display modes.
The browser-local preference is stored under `tenops_display_size` and applied
to the root `data-display-size` attribute before the application paints.

`src/app/globals.css` is the canonical scaling boundary. Each mode supplies a
root font-size token, allowing the existing rem-based Tailwind typography,
control heights, spacing, table density, dialogs, navigation, and inspectors to
scale together. New interactive UI should continue to prefer the shared
Tailwind spacing and sizing scale over isolated pixel dimensions.

Generated Purchase Order PDFs are rendered independently from immutable
snapshot data and never consume the interactive preference. Print media resets
the root font size to the canonical 16px document baseline so browser printing
also remains stable.

The preference is intentionally localStorage-only for the MVP. A future
authenticated user-profile preference can reuse the same three values and root
attribute without changing component APIs.
