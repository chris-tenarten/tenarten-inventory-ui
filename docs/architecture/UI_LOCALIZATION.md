# TenOps UI Localization

TenOps supports a browser-local interface language preference. The initial
languages are English and Spanish.

## Architecture

- `src/lib/language.tsx` owns the supported language values, translation
  dictionaries, provider, and translation hook.
- The selected language is stored under `tenops_language` in `localStorage`.
- The root layout restores the document language before the interactive shell
  loads, and the provider applies changes immediately without a page refresh.
- Missing translations must fall back to the canonical English dictionary by
  retaining the same typed translation key.

## Current boundary

The current rollout covers the shared application shell, domain navigation,
internal-access controls, Settings, Dashboard and Production overview,
Manpower Reporting, Material Usage, Inventory and Pending Receivals, Catalog,
Inventory Activity, and the primary Purchasing list and Purchase Order editor.
Translations use complete operational phrases so their meaning is appropriate
to the workflow rather than relying on isolated word replacement.

Large operational modules are localized incrementally at the component
boundary. New or revised controls in these modules should provide contextual
Spanish copy at the same time as their English copy. A translated display
label must always map back to the unchanged canonical status or action value.

The language preference translates interface labels only. It must not translate
or modify:

- user-entered or imported operational data;
- job, vendor, material, worker, or task names;
- Purchase Order PDFs or draft previews;
- printed or exported documents;
- database values used as workflow status identifiers.

Display text for future translated status values should map from canonical
stored identifiers without changing those identifiers.
