# Curated Intake demo names — approved release mapping

Before names were read from Production on 2026-09-25. Chris approved this exact mapping for release. The guarded release transaction applied all eight cosmetic updates and confirmed preservation of all other demo content and relationships (apart from normal updated_at timestamps). UUIDs match the immutable approved manifest, which remains unchanged.

| Stable ID | Customer before → after | Project before → after |
| --- | --- | --- |
| `de000000-0000-4000-8000-000000000001` | TEST CUSTOMER — Juniper Lantern Hospitality (Fictional) → **Juniper Lantern Hospitality** | TEST — Website Lead — Downtown Restaurant → **Website Lead — Downtown Restaurant** |
| `de000000-0000-4000-8000-000000000002` | TEST CUSTOMER — Willow Meridian Development (Fictional) → **Willow Meridian Development** | TEST — Hotel Lobby Terrazzo → **Hotel Lobby Terrazzo** |
| `de000000-0000-4000-8000-000000000003` | TEST CUSTOMER — Cedar Quill Campus Builders (Fictional) → **Cedar Quill Campus Builders** | TEST — University Stair Package → **University Stair Package** |
| `de000000-0000-4000-8000-000000000004` | TEST CUSTOMER — Silver Kite Terminal Partners (Fictional) → **Silver Kite Terminal Partners** | TEST — Airport Concourse → **Airport Concourse** |
| `de000000-0000-4000-8000-000000000005` | TEST CUSTOMER — Copper Wren Retail Works (Fictional) → **Copper Wren Retail Works** | TEST — Retail Cove Base Package → **Retail Cove Base Package** |
| `de000000-0000-4000-8000-000000000006` | TEST CUSTOMER — North Orchard Workplace Group (Fictional) → **North Orchard Workplace Group** | TEST — Corporate HQ Slabs → **Corporate HQ Slabs** |
| `de000000-0000-4000-8000-000000000007` | TEST CUSTOMER — Maple Harbor Construction (Fictional) → **Maple Harbor Construction** | TEST — Mixed Terrazzo Package → **Mixed Terrazzo Package** |
| `de000000-0000-4000-8000-000000000008` | TEST CUSTOMER — Amber Loom Civic Interiors (Fictional) → **Amber Loom Civic Interiors** | TEST — Award / Ready-to-Convert Example → **Award / Ready-to-Convert Example** |

The runtime TEST badge uses these eight exact UUIDs only. Renaming, adding a TEST prefix to another Bid, or transferring ownership cannot confer permissions or alter cleanup eligibility.

Existing deterministic seed/cleanup tooling intentionally compares against the original manifest and will refuse changed records after any approved renames. Do not edit the immutable manifest to bypass those safeguards; review any future maintenance operation separately.
