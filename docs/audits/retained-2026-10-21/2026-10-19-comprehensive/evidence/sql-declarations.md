# SQL declaration index

Lexical index of repository migration history, not an effective or hosted schema. Includes superseded definitions, later drops and the prohibited enforcement migration; never execute from this inventory. Base inventory excludes pre-existing tables with no CREATE in migrations.

## tables

| Name | Source |
|---|---|
| `public.jobs` | `supabase/migrations/20260713_002_production_mvp_jobs.sql:15` |
| `public.job_activity` | `supabase/migrations/20260713_002_production_mvp_jobs.sql:180` |
| `public.job_attachments` | `supabase/migrations/20260713_003_job_attachments.sql:3` |
| `public.manpower_workers` | `supabase/migrations/20260714_001_manpower_reporting_mvp.sql:5` |
| `public.manpower_tasks` | `supabase/migrations/20260714_001_manpower_reporting_mvp.sql:20` |
| `public.manpower_entries` | `supabase/migrations/20260714_001_manpower_reporting_mvp.sql:35` |
| `public.manpower_reporting_groups` | `supabase/migrations/20260714_002_manpower_reporting_groups_and_import_correction.sql:3` |
| `public.production_schedule_batches` | `supabase/migrations/20260716_002_atomic_production_schedule_batch.sql:3` |
| `public.material_usage_reports` | `supabase/migrations/20260720_001_material_usage_reporting.sql:10` |
| `public.material_usage_lines` | `supabase/migrations/20260720_001_material_usage_reporting.sql:96` |
| `public.vendors` | `supabase/migrations/20260722_002_purchasing_phase1.sql:3` |
| `public.purchase_orders` | `supabase/migrations/20260722_002_purchasing_phase1.sql:20` |
| `public.purchase_order_lines` | `supabase/migrations/20260722_002_purchasing_phase1.sql:64` |
| `public.chip_purchase_order_line_details` | `supabase/migrations/20260722_002_purchasing_phase1.sql:76` |
| `public.vendor_contacts` | `supabase/migrations/20260722_005_purchasing_vendor_configuration.sql:17` |
| `public.purchase_order_issuances` | `supabase/migrations/20260723_001_purchase_order_issuance.sql:23` |
| `public.purchase_order_documents` | `supabase/migrations/20260723_004_purchase_order_pdf_documents.sql:3` |
| `public.purchase_order_number_sequences` | `supabase/migrations/20260723_006_purchase_order_number_allocation.sql:3` |
| `public.job_updates` | `supabase/migrations/20260727_001_production_job_updates.sql:3` |
| `public.job_transmittal_number_sequences` | `supabase/migrations/20260728_001_job_transmittals.sql:3` |
| `public.job_transmittals` | `supabase/migrations/20260728_001_job_transmittals.sql:11` |
| `public.job_document_numbers` | `supabase/migrations/20260728_002_job_transmittal_hardening.sql:53` |
| `public.job_document_number_sequences` | `supabase/migrations/20260728_002_job_transmittal_hardening.sql:65` |
| `public.whiteboard_cards` | `supabase/migrations/20260731_001_whiteboard_mvp.sql:3` |
| `public.planning_items` | `supabase/migrations/20260731_003_planning_phases_items.sql:62` |
| `public.planning_phase_library` | `supabase/migrations/20260731_003_planning_phases_items.sql:71` |
| `public.planning_phase_library_items` | `supabase/migrations/20260731_003_planning_phases_items.sql:81` |
| `public.production_planning_schedule_batches` | `supabase/migrations/20260803_003_atomic_production_planning_schedule.sql:3` |
| `public.production_rework_cycles` | `supabase/migrations/20260817_003_production_rework_cycles.sql:7` |
| `public.production_rework_schedule_batches` | `supabase/migrations/20260817_003_production_rework_cycles.sql:40` |
| `public.app_users` | `supabase/migrations/20260818_001_rbac_identity_infrastructure.sql:6` |
| `public.app_role_capabilities` | `supabase/migrations/20260818_001_rbac_identity_infrastructure.sql:17` |
| `public.account_notifications` | `supabase/migrations/20260818_004_final_compatibility_support.sql:124` |
| `public.job_update_mentions` | `supabase/migrations/20260819_001_job_update_account_collaboration.sql:6` |
| `public.job_update_seen_state` | `supabase/migrations/20260821_002_friday_welcome_and_job_update_seen.sql:20` |
| `public.account_user_preferences` | `supabase/migrations/20260821_002_friday_welcome_and_job_update_seen.sql:183` |
| `public.proposal_access_users` | `supabase/migrations/20260827_004_proposal_generator_v1.sql:4` |
| `public.proposals` | `supabase/migrations/20260827_004_proposal_generator_v1.sql:24` |
| `public.proposal_lines` | `supabase/migrations/20260827_004_proposal_generator_v1.sql:47` |
| `public.proposal_documents` | `supabase/migrations/20260827_004_proposal_generator_v1.sql:56` |
| `public.proposal_pdf_documents` | `supabase/migrations/20260827_004_proposal_generator_v1.sql:63` |
| `public.work_tasks` | `supabase/migrations/20260827_012_my_work_mvp.sql:3` |
| `public.work_task_preferences` | `supabase/migrations/20260828_013_my_work_enrichment.sql:5` |
| `public.work_task_attachments` | `supabase/migrations/20260831_015_my_work_task_attachments.sql:22` |
| `public.my_work_messages` | `supabase/migrations/20260831_016_my_work_inbox.sql:3` |
| `public.my_work_message_attachments` | `supabase/migrations/20260831_017_my_work_inbox_attachments.sql:14` |
| `public.tenops_release_communications` | `supabase/migrations/20260831_018_durable_release_communications.sql:5` |
| `public.my_work_message_versions` | `supabase/migrations/20260831_020_my_work_lifecycle_admin_cleanup.sql:9` |
| `public.my_work_message_deletion_audit` | `supabase/migrations/20260831_020_my_work_lifecycle_admin_cleanup.sql:35` |
| `public.work_task_deletion_audit` | `supabase/migrations/20260831_020_my_work_lifecycle_admin_cleanup.sql:48` |
| `public.bids` | `supabase/migrations/20260901_001_preproduction_bids.sql:5` |
| `public.bid_activity` | `supabase/migrations/20260901_001_preproduction_bids.sql:20` |
| `public.bid_updates` | `supabase/migrations/20260901_002_bid_operational_context.sql:32` |
| `public.canonical_files` | `supabase/migrations/20260901_003_bid_files.sql:18` |
| `public.bid_file_relationships` | `supabase/migrations/20260901_003_bid_files.sql:30` |
| `public.canonical_record_deletion_audit` | `supabase/migrations/20260901_004_admin_canonical_cleanup.sql:5` |
| `public.samples` | `supabase/migrations/20260901_005_sample_color_plate_generator.sql:5` |
| `public.sample_blend_rows` | `supabase/migrations/20260901_005_sample_color_plate_generator.sql:32` |
| `public.sample_issued_documents` | `supabase/migrations/20260901_005_sample_color_plate_generator.sql:50` |
| `public.bid_proposal_relationships` | `supabase/migrations/20260902_002_bid_proposal_relationships.sql:5` |
| `public.my_work_task_groups` | `supabase/migrations/20260902_004_my_work_task_groups.sql:4` |
| `public.my_work_task_group_memberships` | `supabase/migrations/20260902_004_my_work_task_groups.sql:15` |
| `public.sample_user_recent_values` | `supabase/migrations/20260902_005_sample_recent_value_suggestions.sql:4` |
| `public.proposal_estimating_default_versions` | `supabase/migrations/20260908_004_proposal_generator_v2.sql:6` |
| `public.proposal_estimates` | `supabase/migrations/20260908_004_proposal_generator_v2.sql:18` |
| `public.sample_formulation_defaults` | `supabase/migrations/20260917_001_sample_formulation_foundation.sql:11` |
| `public.sample_working_versions` | `supabase/migrations/20260917_001_sample_formulation_foundation.sql:25` |
| `public.sample_formulation_profiles` | `supabase/migrations/20260918_003_sample_formula_volumetric_profiles.sql:5` |
| `public.manpower_product_categories` | `supabase/migrations/20260921_001_manpower_product_categories.sql:7` |
| `public.sample_operational_profiles` | `supabase/migrations/20260923160000_sample_operational_profiles.sql:3` |
| `public.purchase_order_line_allocations` | `supabase/migrations/20260923160100_po_reservation_allocations.sql:18` |
| `public.pending_receival_receipt_batches` | `supabase/migrations/20260923160200_partial_pending_receipts.sql:20` |
| `public.intake_training_grants` | `supabase/migrations/20260924190000_intake_personal_training.sql:4` |
| `public.intake_training_workflows` | `supabase/migrations/20260924190000_intake_personal_training.sql:9` |
| `public.my_work_attachment_previews` | `supabase/migrations/20260925200000_messaging_v11.sql:35` |
| `public.production_blend_plans` | `supabase/migrations/20261005150000_production_blend_plans.sql:5` |
| `public.sample_color_plate_counters` | `supabase/migrations/20261006190000_sample_color_plate_allocation.sql:3` |
| `public.production_companies` | `supabase/migrations/20261014190000_production_contact_configuration.sql:3` |
| `public.production_contacts` | `supabase/migrations/20261014190000_production_contact_configuration.sql:13` |
| `public.production_job_contacts` | `supabase/migrations/20261014220000_protected_job_contacts.sql:6` |

## views

| Name | Source |
|---|---|

## functions

| Name | Source |
|---|---|
| `public.set_jobs_updated_at` | `supabase/migrations/20260713_002_production_mvp_jobs.sql:159` |
| `public.set_manpower_updated_at` | `supabase/migrations/20260714_001_manpower_reporting_mvp.sql:72` |
| `public.receive_pending_receival_with_reservation` | `supabase/migrations/20260714_005_inventory_production_job_reservations.sql:177` |
| `public.receive_pending_receival_with_reservation` | `supabase/migrations/20260714_006_harden_inventory_reservation_receipts.sql:109` |
| `public.save_production_schedule_batch` | `supabase/migrations/20260716_002_atomic_production_schedule_batch.sql:19` |
| `public.set_material_usage_updated_at` | `supabase/migrations/20260720_001_material_usage_reporting.sql:182` |
| `public.save_material_usage_report` | `supabase/migrations/20260720_001_material_usage_reporting.sql:203` |
| `public.delete_material_usage_report` | `supabase/migrations/20260720_001_material_usage_reporting.sql:402` |
| `public.reserve_inventory_quantity` | `supabase/migrations/20260721_001_atomic_inventory_reservations.sql:3` |
| `public.release_inventory_reservation` | `supabase/migrations/20260721_001_atomic_inventory_reservations.sql:68` |
| `public.release_inventory_reservations_bulk` | `supabase/migrations/20260721_001_atomic_inventory_reservations.sql:126` |
| `public.receive_pending_receival_with_reservation` | `supabase/migrations/20260722_001_pending_receival_undo.sql:23` |
| `public.undo_pending_receival_receipt` | `supabase/migrations/20260722_001_pending_receival_undo.sql:153` |
| `public.save_chip_purchase_order_draft` | `supabase/migrations/20260722_002_purchasing_phase1.sql:106` |
| `public.save_chip_purchase_order_draft` | `supabase/migrations/20260722_003_purchasing_phase1_1_simplification.sql:26` |
| `public.save_chip_purchase_order_draft` | `supabase/migrations/20260722_004_purchasing_optional_charges.sql:23` |
| `public.save_chip_purchase_order_draft_v2` | `supabase/migrations/20260722_005_purchasing_vendor_configuration.sql:51` |
| `public.delete_purchase_order_draft` | `supabase/migrations/20260722_005_purchasing_vendor_configuration.sql:68` |
| `public.save_vendor_profile` | `supabase/migrations/20260722_005_purchasing_vendor_configuration.sql:80` |
| `public.save_vendor_contact` | `supabase/migrations/20260722_005_purchasing_vendor_configuration.sql:99` |
| `public.save_purchasing_catalog_item` | `supabase/migrations/20260722_005_purchasing_vendor_configuration.sql:118` |
| `public.save_purchasing_catalog_item` | `supabase/migrations/20260722_008_vendor_catalog_bulk_pricing.sql:26` |
| `public.guard_purchase_order_issuance_snapshot` | `supabase/migrations/20260723_001_purchase_order_issuance.sql:50` |
| `public.guard_issued_purchase_order` | `supabase/migrations/20260723_001_purchase_order_issuance.sql:62` |
| `public.guard_issued_purchase_order_line` | `supabase/migrations/20260723_001_purchase_order_issuance.sql:78` |
| `public.guard_issued_chip_purchase_order_detail` | `supabase/migrations/20260723_001_purchase_order_issuance.sql:102` |
| `public.issue_purchase_order` | `supabase/migrations/20260723_001_purchase_order_issuance.sql:127` |
| `public.save_purchasing_catalog_item` | `supabase/migrations/20260723_002_vendor_catalog_truckload_pricing.sql:30` |
| `public.capture_purchase_order_pdf_snapshot_fields` | `supabase/migrations/20260723_004_purchase_order_pdf_documents.sql:50` |
| `public.initialize_purchase_order_document` | `supabase/migrations/20260723_004_purchase_order_pdf_documents.sql:86` |
| `public.claim_purchase_order_pdf_generation` | `supabase/migrations/20260723_004_purchase_order_pdf_documents.sql:110` |
| `public.capture_purchase_order_pdf_snapshot_fields` | `supabase/migrations/20260723_005_purchase_order_pdf_v2.sql:33` |
| `public.initialize_purchase_order_document` | `supabase/migrations/20260723_005_purchase_order_pdf_v2.sql:72` |
| `public.set_purchase_order_document_template` | `supabase/migrations/20260723_005_purchase_order_pdf_v2.sql:98` |
| `public.allocate_purchase_order_number` | `supabase/migrations/20260723_006_purchase_order_number_allocation.sql:30` |
| `public.save_chip_purchase_order_draft_v2` | `supabase/migrations/20260723_006_purchase_order_number_allocation.sql:98` |
| `public.create_pending_receivals_from_purchase_order` | `supabase/migrations/20260723_008_purchase_order_pending_receivals.sql:43` |
| `public.delete_empty_manpower_reporting_group` | `supabase/migrations/20260724020000_delete_empty_manpower_reporting_groups.sql:3` |
| `public.guard_purchase_order_issuance_snapshot` | `supabase/migrations/20260724_001_guarded_test_purchase_order_purge.sql:4` |
| `public.guard_issued_purchase_order` | `supabase/migrations/20260724_001_guarded_test_purchase_order_purge.sql:15` |
| `public.guard_issued_purchase_order_line` | `supabase/migrations/20260724_001_guarded_test_purchase_order_purge.sql:30` |
| `public.guard_issued_chip_purchase_order_detail` | `supabase/migrations/20260724_001_guarded_test_purchase_order_purge.sql:51` |
| `public.purge_test_purchase_order` | `supabase/migrations/20260724_001_guarded_test_purchase_order_purge.sql:75` |
| `public.validate_job_attachment_update_job` | `supabase/migrations/20260727_001_production_job_updates.sql:60` |
| `public.resolve_job_update` | `supabase/migrations/20260727_001_production_job_updates.sql:84` |
| `public.issue_job_transmittal` | `supabase/migrations/20260728_001_job_transmittals.sql:48` |
| `public.guard_job_transmittal_immutable` | `supabase/migrations/20260728_001_job_transmittals.sql:168` |
| `public.prevent_job_transmittal_delete` | `supabase/migrations/20260728_001_job_transmittals.sql:198` |
| `public.resolve_job_update` | `supabase/migrations/20260728_001_job_update_resolution_details.sql:65` |
| `public.resolve_job_update` | `supabase/migrations/20260728_001_job_update_resolution_details.sql:106` |
| `public.reserve_job_document_number` | `supabase/migrations/20260728_002_job_transmittal_hardening.sql:105` |
| `public.allocate_purchase_order_number` | `supabase/migrations/20260728_002_job_transmittal_hardening.sql:178` |
| `public.validate_job_transmittal_snapshot` | `supabase/migrations/20260728_002_job_transmittal_hardening.sql:214` |
| `public.issue_job_transmittal` | `supabase/migrations/20260728_002_job_transmittal_hardening.sql:259` |
| `public.preview_next_job_document_number` | `supabase/migrations/20260728_002_job_transmittal_hardening.sql:309` |
| `public.claim_job_transmittal_pdf_generation` | `supabase/migrations/20260728_002_job_transmittal_hardening.sql:329` |
| `public.complete_job_transmittal_pdf_generation` | `supabase/migrations/20260728_002_job_transmittal_hardening.sql:352` |
| `public.fail_job_transmittal_pdf_generation` | `supabase/migrations/20260728_002_job_transmittal_hardening.sql:365` |
| `public.list_job_transmittals` | `supabase/migrations/20260728_002_job_transmittal_hardening.sql:376` |
| `public.issue_job_transmittal` | `supabase/migrations/20260729_001_shared_document_numbering_suffix_one.sql:6` |
| `public.preview_next_job_document_number` | `supabase/migrations/20260729_001_shared_document_numbering_suffix_one.sql:60` |
| `public.set_whiteboard_card_updated_at` | `supabase/migrations/20260731_001_whiteboard_mvp.sql:29` |
| `public.validate_whiteboard_card_dependency` | `supabase/migrations/20260731_001_whiteboard_mvp.sql:36` |
| `public.validate_planning_phase_dependency` | `supabase/migrations/20260731_003_planning_phases_items.sql:44` |
| `public.set_planning_record_updated_at` | `supabase/migrations/20260731_003_planning_phases_items.sql:89` |
| `public.enforce_planning_phase_limit` | `supabase/migrations/20260803_001_planning_library_colors_and_phase_cap.sql:72` |
| `public.issue_job_transmittal` | `supabase/migrations/20260803_002_job_transmittal_editable_customer.sql:17` |
| `public.save_production_planning_schedule_batch` | `supabase/migrations/20260803_003_atomic_production_planning_schedule.sql:15` |
| `public.edit_job_update` | `supabase/migrations/20260817_002_job_update_editing.sql:12` |
| `public.touch_production_rework_cycle_updated_at` | `supabase/migrations/20260817_003_production_rework_cycles.sql:52` |
| `public.create_production_rework` | `supabase/migrations/20260817_003_production_rework_cycles.sql:75` |
| `public.update_production_rework_status` | `supabase/migrations/20260817_003_production_rework_cycles.sql:125` |
| `public.save_production_rework_schedule_batch` | `supabase/migrations/20260817_003_production_rework_cycles.sql:156` |
| `public.save_production_rework_mixed_schedule_batch` | `supabase/migrations/20260817_003_production_rework_cycles.sql:224` |
| `public.tenops_touch_updated_at` | `supabase/migrations/20260818_001_rbac_identity_infrastructure.sql:60` |
| `public.has_app_capability` | `supabase/migrations/20260818_001_rbac_identity_infrastructure.sql:73` |
| `public.require_app_capability` | `supabase/migrations/20260818_001_rbac_identity_infrastructure.sql:86` |
| `public.get_my_app_user` | `supabase/migrations/20260818_001_rbac_identity_infrastructure.sql:98` |
| `public.bootstrap_first_tenops_admin` | `supabase/migrations/20260818_001_rbac_identity_infrastructure.sql:108` |
| `public.admin_set_app_user_access` | `supabase/migrations/20260818_001_rbac_identity_infrastructure.sql:129` |
| `public.admin_list_app_users` | `supabase/migrations/20260818_001_rbac_identity_infrastructure.sql:154` |
| `public.list_my_job_update_notifications` | `supabase/migrations/20260818_001_rbac_identity_infrastructure.sql:178` |
| `public.report_job_update_identity_backfill` | `supabase/migrations/20260818_001_rbac_identity_infrastructure.sql:194` |
| `public.tenops_active_user` | `supabase/migrations/20260818_002_rbac_final_enforcement_DO_NOT_APPLY.sql:16` |
| `public.current_app_display_name` | `supabase/migrations/20260818_002_rbac_final_enforcement_DO_NOT_APPLY.sql:25` |
| `public.tenops_authorize_request` | `supabase/migrations/20260818_002_rbac_final_enforcement_DO_NOT_APPLY.sql:36` |
| `public.enforce_jobs_update_capability` | `supabase/migrations/20260818_002_rbac_final_enforcement_DO_NOT_APPLY.sql:144` |
| `public.create_production_rework` | `supabase/migrations/20260818_002_rbac_final_enforcement_DO_NOT_APPLY.sql:211` |
| `public.update_production_rework_status` | `supabase/migrations/20260818_002_rbac_final_enforcement_DO_NOT_APPLY.sql:216` |
| `public.save_production_rework_schedule_batch` | `supabase/migrations/20260818_002_rbac_final_enforcement_DO_NOT_APPLY.sql:221` |
| `public.save_production_rework_mixed_schedule_batch` | `supabase/migrations/20260818_002_rbac_final_enforcement_DO_NOT_APPLY.sql:226` |
| `public.save_chip_purchase_order_draft_v2` | `supabase/migrations/20260818_004_final_compatibility_support.sql:18` |
| `public.apply_issued_purchase_order_job_reference` | `supabase/migrations/20260818_004_final_compatibility_support.sql:57` |
| `public.ensure_my_welcome_notification` | `supabase/migrations/20260818_004_final_compatibility_support.sql:153` |
| `public.list_my_account_notifications` | `supabase/migrations/20260818_004_final_compatibility_support.sql:192` |
| `public.mark_my_account_notification_read` | `supabase/migrations/20260818_004_final_compatibility_support.sql:210` |
| `public.list_active_job_update_collaborators` | `supabase/migrations/20260819_001_job_update_account_collaboration.sql:26` |
| `public.list_job_update_mentions` | `supabase/migrations/20260819_001_job_update_account_collaboration.sql:41` |
| `public.notify_job_update_account` | `supabase/migrations/20260819_001_job_update_account_collaboration.sql:58` |
| `public.sync_job_update_mentions` | `supabase/migrations/20260819_001_job_update_account_collaboration.sql:105` |
| `public.create_job_update_with_mentions` | `supabase/migrations/20260819_001_job_update_account_collaboration.sql:143` |
| `public.edit_job_update_with_mentions` | `supabase/migrations/20260819_001_job_update_account_collaboration.sql:211` |
| `public.resolve_job_update_with_identity` | `supabase/migrations/20260819_001_job_update_account_collaboration.sql:305` |
| `public.preview_legacy_job_update_enrollment` | `supabase/migrations/20260819_002_legacy_job_update_enrollment_notifications.sql:9` |
| `public.execute_legacy_job_update_enrollment` | `supabase/migrations/20260819_002_legacy_job_update_enrollment_notifications.sql:84` |
| `public.list_my_account_notification_history` | `supabase/migrations/20260819_002_legacy_job_update_enrollment_notifications.sql:174` |
| `public.mark_all_my_account_notifications_read` | `supabase/migrations/20260819_002_legacy_job_update_enrollment_notifications.sql:204` |
| `public.mark_my_account_notification_read` | `supabase/migrations/20260819_002_legacy_job_update_enrollment_notifications.sql:222` |
| `public.delete_job_update` | `supabase/migrations/20260821_001_job_update_deletion.sql:10` |
| `public.list_my_unseen_job_update_jobs` | `supabase/migrations/20260821_002_friday_welcome_and_job_update_seen.sql:57` |
| `public.mark_my_job_updates_seen` | `supabase/migrations/20260821_002_friday_welcome_and_job_update_seen.sql:84` |
| `public.tenops_account_preferences_valid` | `supabase/migrations/20260821_002_friday_welcome_and_job_update_seen.sql:118` |
| `public.get_my_account_preferences` | `supabase/migrations/20260821_002_friday_welcome_and_job_update_seen.sql:209` |
| `public.set_my_account_preference` | `supabase/migrations/20260821_002_friday_welcome_and_job_update_seen.sql:228` |
| `public.notify_job_update_account` | `supabase/migrations/20260821_003_job_update_self_mention_notifications.sql:6` |
| `public.receive_pending_receival_with_reservation` | `supabase/migrations/20260824_001_pending_receival_rbac_enforcement.sql:76` |
| `public.undo_pending_receival_receipt` | `supabase/migrations/20260824_001_pending_receival_rbac_enforcement.sql:93` |
| `public.create_pending_receivals_from_purchase_order` | `supabase/migrations/20260824_001_pending_receival_rbac_enforcement.sql:111` |
| `public.has_proposal_access` | `supabase/migrations/20260827_004_proposal_generator_v1.sql:15` |
| `public.proposal_issued_immutable` | `supabase/migrations/20260827_004_proposal_generator_v1.sql:74` |
| `public.proposal_line_issued_immutable` | `supabase/migrations/20260827_004_proposal_generator_v1.sql:80` |
| `public.create_job_proposal` | `supabase/migrations/20260827_004_proposal_generator_v1.sql:104` |
| `public.save_proposal_draft` | `supabase/migrations/20260827_004_proposal_generator_v1.sql:120` |
| `public.issue_proposal` | `supabase/migrations/20260827_004_proposal_generator_v1.sql:135` |
| `public.create_proposal_revision` | `supabase/migrations/20260827_004_proposal_generator_v1.sql:147` |
| `public.admin_delete_issued_proposal` | `supabase/migrations/20260827_005_admin_delete_issued_proposal.sql:2` |
| `public.proposal_issued_immutable` | `supabase/migrations/20260827_005_admin_delete_issued_proposal.sql:30` |
| `public.proposal_line_issued_immutable` | `supabase/migrations/20260827_005_admin_delete_issued_proposal.sql:44` |
| `public.create_job_proposal` | `supabase/migrations/20260827_006_proposal_commercial_defaults.sql:11` |
| `public.save_proposal_draft` | `supabase/migrations/20260827_006_proposal_commercial_defaults.sql:27` |
| `public.create_proposal_revision` | `supabase/migrations/20260827_006_proposal_commercial_defaults.sql:42` |
| `public.proposal_acceptance_defaults` | `supabase/migrations/20260827_007_proposal_acceptance_defaults.sql:6` |
| `public.proposal_clarification_revision_defaults` | `supabase/migrations/20260827_008_proposal_commercial_clarifications.sql:9` |
| `public.save_proposal_clarifications` | `supabase/migrations/20260827_008_proposal_commercial_clarifications.sql:24` |
| `public.delete_proposal_draft` | `supabase/migrations/20260827_008_proposal_commercial_clarifications.sql:39` |
| `public.canonicalize_job_number` | `supabase/migrations/20260827_009_job_number_uniqueness.sql:4` |
| `public.proposal_acceptance_defaults` | `supabase/migrations/20260827_010_proposal_standard_commercial_defaults.sql:7` |
| `public.work_task_touch_updated_at` | `supabase/migrations/20260827_012_my_work_mvp.sql:25` |
| `public.list_my_work_tasks` | `supabase/migrations/20260827_012_my_work_mvp.sql:41` |
| `public.create_my_work_task` | `supabase/migrations/20260827_012_my_work_mvp.sql:54` |
| `public.set_my_work_task_completed` | `supabase/migrations/20260827_012_my_work_mvp.sql:85` |
| `public.list_my_work_tasks` | `supabase/migrations/20260828_013_my_work_enrichment.sql:25` |
| `public.create_my_work_task` | `supabase/migrations/20260828_013_my_work_enrichment.sql:39` |
| `public.update_my_work_task` | `supabase/migrations/20260828_013_my_work_enrichment.sql:71` |
| `public.create_proposal` | `supabase/migrations/20260828_014_generic_proposal_creation.sql:7` |
| `public.create_my_work_task_complete` | `supabase/migrations/20260831_015_my_work_task_attachments.sql:105` |
| `public.finalize_my_work_task_creation` | `supabase/migrations/20260831_015_my_work_task_attachments.sql:131` |
| `public.list_my_work_inbox_recipients` | `supabase/migrations/20260831_016_my_work_inbox.sql:29` |
| `public.list_my_work_inbox_messages` | `supabase/migrations/20260831_016_my_work_inbox.sql:39` |
| `public.send_my_work_inbox_message` | `supabase/migrations/20260831_016_my_work_inbox.sql:55` |
| `public.mark_my_work_inbox_conversation_read` | `supabase/migrations/20260831_016_my_work_inbox.sql:73` |
| `public.create_my_work_inbox_message_draft` | `supabase/migrations/20260831_017_my_work_inbox_attachments.sql:62` |
| `public.finalize_my_work_inbox_message` | `supabase/migrations/20260831_017_my_work_inbox_attachments.sql:77` |
| `public.discard_my_work_inbox_message_draft` | `supabase/migrations/20260831_017_my_work_inbox_attachments.sql:92` |
| `public.list_my_work_inbox_messages` | `supabase/migrations/20260831_017_my_work_inbox_attachments.sql:97` |
| `public.list_my_work_inbox_messages` | `supabase/migrations/20260831_018_durable_release_communications.sql:49` |
| `public.mark_my_work_inbox_conversation_read` | `supabase/migrations/20260831_018_durable_release_communications.sql:68` |
| `public.deliver_tenops_release_communication_to_user` | `supabase/migrations/20260831_018_durable_release_communications.sql:86` |
| `public.deliver_tenops_release_communication` | `supabase/migrations/20260831_018_durable_release_communications.sql:118` |
| `public.deliver_current_tenops_onboarding_for_app_user` | `supabase/migrations/20260831_018_durable_release_communications.sql:136` |
| `public.can_access_my_work_typing_topic` | `supabase/migrations/20260831_019_private_my_work_typing_broadcast.sql:4` |
| `public.list_my_work_inbox_recipients` | `supabase/migrations/20260831_020_my_work_lifecycle_admin_cleanup.sql:64` |
| `public.list_my_work_inbox_messages_v2` | `supabase/migrations/20260831_020_my_work_lifecycle_admin_cleanup.sql:79` |
| `public.edit_my_work_inbox_message` | `supabase/migrations/20260831_020_my_work_lifecycle_admin_cleanup.sql:100` |
| `public.prepare_admin_delete_my_work_message` | `supabase/migrations/20260831_020_my_work_lifecycle_admin_cleanup.sql:124` |
| `public.admin_permanently_delete_my_work_message` | `supabase/migrations/20260831_020_my_work_lifecycle_admin_cleanup.sql:139` |
| `public.prepare_admin_delete_work_task` | `supabase/migrations/20260831_020_my_work_lifecycle_admin_cleanup.sql:165` |
| `public.admin_permanently_delete_work_task` | `supabase/migrations/20260831_020_my_work_lifecycle_admin_cleanup.sql:176` |
| `public.list_my_work_tasks` | `supabase/migrations/20260831_021_my_work_task_estimated_time.sql:12` |
| `public.create_my_work_task_complete` | `supabase/migrations/20260831_021_my_work_task_estimated_time.sql:27` |
| `public.update_my_work_task` | `supabase/migrations/20260831_021_my_work_task_estimated_time.sql:57` |
| `public.list_bid_owners` | `supabase/migrations/20260901_001_preproduction_bids.sql:46` |
| `public.list_bids` | `supabase/migrations/20260901_001_preproduction_bids.sql:55` |
| `public.list_bid_activity` | `supabase/migrations/20260901_001_preproduction_bids.sql:66` |
| `public.create_bid` | `supabase/migrations/20260901_001_preproduction_bids.sql:75` |
| `public.update_bid` | `supabase/migrations/20260901_001_preproduction_bids.sql:90` |
| `public.list_bids` | `supabase/migrations/20260901_002_bid_operational_context.sql:51` |
| `public.list_bid_updates` | `supabase/migrations/20260901_002_bid_operational_context.sql:93` |
| `public.update_bid` | `supabase/migrations/20260901_002_bid_operational_context.sql:104` |
| `public.create_bid_update` | `supabase/migrations/20260901_002_bid_operational_context.sql:179` |
| `public.list_bid_files` | `supabase/migrations/20260901_003_bid_files.sql:97` |
| `public.begin_bid_file_upload` | `supabase/migrations/20260901_003_bid_files.sql:109` |
| `public.abort_bid_file_upload` | `supabase/migrations/20260901_003_bid_files.sql:128` |
| `public.finalize_bid_file_upload` | `supabase/migrations/20260901_003_bid_files.sql:142` |
| `public.prepare_bid_file_removal` | `supabase/migrations/20260901_003_bid_files.sql:158` |
| `public.cancel_bid_file_removal` | `supabase/migrations/20260901_003_bid_files.sql:171` |
| `public.finalize_bid_file_removal` | `supabase/migrations/20260901_003_bid_files.sql:182` |
| `public.prepare_admin_delete_bid` | `supabase/migrations/20260901_004_admin_canonical_cleanup.sql:20` |
| `public.cancel_admin_delete_bid` | `supabase/migrations/20260901_004_admin_canonical_cleanup.sql:46` |
| `public.admin_permanently_delete_bid` | `supabase/migrations/20260901_004_admin_canonical_cleanup.sql:59` |
| `public.production_job_delete_blockers` | `supabase/migrations/20260901_004_admin_canonical_cleanup.sql:101` |
| `public.preflight_admin_delete_production_job` | `supabase/migrations/20260901_004_admin_canonical_cleanup.sql:119` |
| `public.prepare_admin_delete_production_job` | `supabase/migrations/20260901_004_admin_canonical_cleanup.sql:132` |
| `public.admin_permanently_delete_production_job` | `supabase/migrations/20260901_004_admin_canonical_cleanup.sql:147` |
| `public.sample_issued_document_snapshot_immutable` | `supabase/migrations/20260901_005_sample_color_plate_generator.sql:67` |
| `public.list_samples` | `supabase/migrations/20260901_005_sample_color_plate_generator.sql:88` |
| `public.create_sample` | `supabase/migrations/20260901_005_sample_color_plate_generator.sql:103` |
| `public.save_sample_draft` | `supabase/migrations/20260901_005_sample_color_plate_generator.sql:117` |
| `public.duplicate_sample` | `supabase/migrations/20260901_005_sample_color_plate_generator.sql:142` |
| `public.issue_sample_form` | `supabase/migrations/20260901_005_sample_color_plate_generator.sql:156` |
| `public.permanently_delete_sample_draft` | `supabase/migrations/20260902_001_sample_draft_deletion.sql:4` |
| `public.inherit_bid_proposal_relationship` | `supabase/migrations/20260902_002_bid_proposal_relationships.sql:26` |
| `public.create_bid_proposal` | `supabase/migrations/20260902_002_bid_proposal_relationships.sql:41` |
| `public.link_proposal_to_bid` | `supabase/migrations/20260902_002_bid_proposal_relationships.sql:62` |
| `public.link_sample_to_bid` | `supabase/migrations/20260902_002_bid_proposal_relationships.sql:89` |
| `public.admin_permanently_delete_bid` | `supabase/migrations/20260902_003_bid_delete_runtime_fix.sql:5` |
| `public.my_work_task_participant` | `supabase/migrations/20260902_004_my_work_task_groups.sql:30` |
| `public.list_my_work_task_groups` | `supabase/migrations/20260902_004_my_work_task_groups.sql:35` |
| `public.list_my_work_task_group_memberships` | `supabase/migrations/20260902_004_my_work_task_groups.sql:44` |
| `public.create_my_work_task_group` | `supabase/migrations/20260902_004_my_work_task_groups.sql:55` |
| `public.update_my_work_task_group` | `supabase/migrations/20260902_004_my_work_task_groups.sql:66` |
| `public.set_my_work_task_group` | `supabase/migrations/20260902_004_my_work_task_groups.sql:77` |
| `public.delete_my_work_task_group` | `supabase/migrations/20260902_004_my_work_task_groups.sql:88` |
| `public.list_my_sample_recent_values` | `supabase/migrations/20260902_005_sample_recent_value_suggestions.sql:23` |
| `public.record_my_sample_recent_values` | `supabase/migrations/20260902_005_sample_recent_value_suggestions.sql:44` |
| `public.issue_job_transmittal` | `supabase/migrations/20260904_001_job_transmittal_without_job_number.sql:19` |
| `public.issue_job_transmittal` | `supabase/migrations/20260908_001_job_transmittal_linkage_semantics.sql:26` |
| `public.list_job_transmittals` | `supabase/migrations/20260908_001_job_transmittal_linkage_semantics.sql:112` |
| `public.save_chip_purchase_order_draft_v2` | `supabase/migrations/20260908_002_purchase_order_line_material_types.sql:41` |
| `public.save_purchasing_catalog_item_v2` | `supabase/migrations/20260908_002_purchase_order_line_material_types.sql:101` |
| `public.proposal_validate_estimating_assumptions` | `supabase/migrations/20260908_004_proposal_generator_v2.sql:62` |
| `public.proposal_validate_estimate_inputs` | `supabase/migrations/20260908_004_proposal_generator_v2.sql:127` |
| `public.proposal_calculate_estimate_v2` | `supabase/migrations/20260908_004_proposal_generator_v2.sql:178` |
| `public.proposal_empty_estimate_inputs` | `supabase/migrations/20260908_004_proposal_generator_v2.sql:535` |
| `public.proposal_estimating_defaults_payload` | `supabase/migrations/20260908_004_proposal_generator_v2.sql:562` |
| `public.proposal_estimate_payload` | `supabase/migrations/20260908_004_proposal_generator_v2.sql:580` |
| `public.get_current_proposal_estimating_defaults` | `supabase/migrations/20260908_004_proposal_generator_v2.sql:604` |
| `public.save_proposal_estimating_defaults` | `supabase/migrations/20260908_004_proposal_generator_v2.sql:624` |
| `public.proposal_initialize_estimate_for_new_proposal` | `supabase/migrations/20260908_004_proposal_generator_v2.sql:668` |
| `public.ensure_proposal_estimate` | `supabase/migrations/20260908_004_proposal_generator_v2.sql:717` |
| `public.save_proposal_estimate_draft` | `supabase/migrations/20260908_004_proposal_generator_v2.sql:752` |
| `public.save_proposal_draft` | `supabase/migrations/20260908_004_proposal_generator_v2.sql:807` |
| `public.save_proposal_v2_draft` | `supabase/migrations/20260908_004_proposal_generator_v2.sql:964` |
| `public.issue_proposal` | `supabase/migrations/20260908_004_proposal_generator_v2.sql:991` |
| `public.create_proposal_revision` | `supabase/migrations/20260908_004_proposal_generator_v2.sql:1068` |
| `public.proposal_estimating_defaults_immutable` | `supabase/migrations/20260908_004_proposal_generator_v2.sql:1126` |
| `public.proposal_estimate_issued_immutable` | `supabase/migrations/20260908_004_proposal_generator_v2.sql:1140` |
| `public.sample_working_version_immutable` | `supabase/migrations/20260917_001_sample_formulation_foundation.sql:41` |
| `public.sample_nonnegative_numeric` | `supabase/migrations/20260917_001_sample_formulation_foundation.sql:46` |
| `public.normalize_sample_formulation` | `supabase/migrations/20260917_001_sample_formulation_foundation.sql:51` |
| `public.get_sample_formulation_default` | `supabase/migrations/20260917_001_sample_formulation_foundation.sql:65` |
| `public.set_sample_formulation_default` | `supabase/migrations/20260917_001_sample_formulation_foundation.sql:69` |
| `public.create_sample` | `supabase/migrations/20260917_001_sample_formulation_foundation.sql:80` |
| `public.save_sample_draft` | `supabase/migrations/20260917_001_sample_formulation_foundation.sql:91` |
| `public.duplicate_sample` | `supabase/migrations/20260917_001_sample_formulation_foundation.sql:110` |
| `public.list_samples` | `supabase/migrations/20260917_001_sample_formulation_foundation.sql:119` |
| `public.save_sample_working_version` | `supabase/migrations/20260917_001_sample_formulation_foundation.sql:133` |
| `public.restore_sample_working_version` | `supabase/migrations/20260917_001_sample_formulation_foundation.sql:143` |
| `public.get_sample_working_pdf_snapshot` | `supabase/migrations/20260917_001_sample_formulation_foundation.sql:153` |
| `public.issue_sample_form` | `supabase/migrations/20260917_001_sample_formulation_foundation.sql:163` |
| `public.normalize_sample_formulation` | `supabase/migrations/20260917_002_sample_draft_library_identity.sql:19` |
| `public.get_sample_formulation_default` | `supabase/migrations/20260917_002_sample_draft_library_identity.sql:45` |
| `public.set_sample_formulation_default` | `supabase/migrations/20260917_002_sample_draft_library_identity.sql:50` |
| `public.create_sample` | `supabase/migrations/20260917_002_sample_draft_library_identity.sql:65` |
| `public.save_sample_draft` | `supabase/migrations/20260917_002_sample_draft_library_identity.sql:76` |
| `public.duplicate_sample` | `supabase/migrations/20260917_002_sample_draft_library_identity.sql:85` |
| `public.issue_sample_form` | `supabase/migrations/20260917_002_sample_draft_library_identity.sql:96` |
| `public.sample_working_version_immutable` | `supabase/migrations/20260917_003_sample_deletion_lifecycle.sql:4` |
| `public.permanently_delete_sample_draft` | `supabase/migrations/20260917_003_sample_deletion_lifecycle.sql:15` |
| `public.prepare_admin_delete_sample` | `supabase/migrations/20260917_003_sample_deletion_lifecycle.sql:43` |
| `public.admin_permanently_delete_sample` | `supabase/migrations/20260917_003_sample_deletion_lifecycle.sql:59` |
| `public.save_purchasing_catalog_item_v2` | `supabase/migrations/20260917_004_purchase_order_material_taxonomy.sql:39` |
| `public.recover_purchase_order_draft_v2` | `supabase/migrations/20260917_004_purchase_order_material_taxonomy.sql:70` |
| `public.recover_purchase_order_draft_v2` | `supabase/migrations/20260917_005_purchase_order_recovery_idempotency.sql:17` |
| `public.admin_permanently_delete_sample_draft` | `supabase/migrations/20260917_006_sample_admin_draft_deletion.sql:5` |
| `public.normalize_sample_formulation` | `supabase/migrations/20260917_007_sample_formula_mass_balance.sql:9` |
| `public.get_sample_formulation_default` | `supabase/migrations/20260917_007_sample_formula_mass_balance.sql:26` |
| `public.set_sample_formulation_default` | `supabase/migrations/20260917_007_sample_formula_mass_balance.sql:31` |
| `public.create_sample` | `supabase/migrations/20260917_007_sample_formula_mass_balance.sql:41` |
| `public.save_sample_draft` | `supabase/migrations/20260917_007_sample_formula_mass_balance.sql:53` |
| `public.normalize_sample_formulation` | `supabase/migrations/20260918_001_sample_formula_historical_parity.sql:5` |
| `public.create_sample` | `supabase/migrations/20260918_001_sample_formula_historical_parity.sql:22` |
| `public.save_sample_draft` | `supabase/migrations/20260918_001_sample_formula_historical_parity.sql:33` |
| `public.normalize_sample_formulation` | `supabase/migrations/20260918_003_sample_formula_volumetric_profiles.sql:37` |
| `public.issue_sample_form` | `supabase/migrations/20260918_003_sample_formula_volumetric_profiles.sql:61` |
| `public.create_sample` | `supabase/migrations/20260918_003_sample_formula_volumetric_profiles.sql:73` |
| `public.save_sample_draft` | `supabase/migrations/20260918_003_sample_formula_volumetric_profiles.sql:85` |
| `public.normalize_sample_formulation` | `supabase/migrations/20260918_004_sample_formula_density_profiles.sql:29` |
| `public.save_sample_draft` | `supabase/migrations/20260918_004_sample_formula_density_profiles.sql:49` |
| `public.create_sample` | `supabase/migrations/20260918_004_sample_formula_density_profiles.sql:75` |
| `public.issue_sample_form` | `supabase/migrations/20260918_004_sample_formula_density_profiles.sql:87` |
| `public.audit_manpower_product_category` | `supabase/migrations/20260921_001_manpower_product_categories.sql:27` |
| `public.validate_manpower_product_category` | `supabase/migrations/20260921_001_manpower_product_categories.sql:69` |
| `public.save_sample_operational_profile` | `supabase/migrations/20260923160000_sample_operational_profiles.sql:27` |
| `public.move_sample_operational_profile` | `supabase/migrations/20260923160000_sample_operational_profiles.sql:45` |
| `public.save_purchase_order_allocated_draft` | `supabase/migrations/20260923160100_po_reservation_allocations.sql:31` |
| `public.check_po_allocation_total` | `supabase/migrations/20260923160100_po_reservation_allocations.sql:55` |
| `public.capture_po_allocation_intent` | `supabase/migrations/20260923160100_po_reservation_allocations.sql:66` |
| `public.create_allocated_po_receivals` | `supabase/migrations/20260923160100_po_reservation_allocations.sql:96` |
| `public.create_pending_receivals_from_purchase_order` | `supabase/migrations/20260923160100_po_reservation_allocations.sql:138` |
| `public.check_po_receival_allocations` | `supabase/migrations/20260923160100_po_reservation_allocations.sql:145` |
| `public.receive_pending_receival_quantity` | `supabase/migrations/20260923160200_partial_pending_receipts.sql:37` |
| `public.receive_pending_receival_with_reservation` | `supabase/migrations/20260923160200_partial_pending_receipts.sql:186` |
| `public.undo_pending_receival_receipt` | `supabase/migrations/20260923160200_partial_pending_receipts.sql:198` |
| `public.list_bid_owners` | `supabase/migrations/20260923215900_intake_early_access.sql:33` |
| `public.list_bids` | `supabase/migrations/20260923215900_intake_early_access.sql:54` |
| `public.list_bid_activity` | `supabase/migrations/20260923215900_intake_early_access.sql:92` |
| `public.list_bid_updates` | `supabase/migrations/20260923215900_intake_early_access.sql:113` |
| `public.list_bid_files` | `supabase/migrations/20260923215900_intake_early_access.sql:135` |
| `public.create_bid` | `supabase/migrations/20260923215900_intake_early_access.sql:159` |
| `public.update_bid` | `supabase/migrations/20260923215900_intake_early_access.sql:187` |
| `public.create_bid_update` | `supabase/migrations/20260923215900_intake_early_access.sql:265` |
| `public.begin_bid_file_upload` | `supabase/migrations/20260923215900_intake_early_access.sql:293` |
| `public.abort_bid_file_upload` | `supabase/migrations/20260923215900_intake_early_access.sql:324` |
| `public.finalize_bid_file_upload` | `supabase/migrations/20260923215900_intake_early_access.sql:351` |
| `public.prepare_bid_file_removal` | `supabase/migrations/20260923215900_intake_early_access.sql:380` |
| `public.cancel_bid_file_removal` | `supabase/migrations/20260923215900_intake_early_access.sql:406` |
| `public.finalize_bid_file_removal` | `supabase/migrations/20260923215900_intake_early_access.sql:430` |
| `public.create_bid_proposal` | `supabase/migrations/20260923215900_intake_early_access.sql:466` |
| `public.link_proposal_to_bid` | `supabase/migrations/20260923215900_intake_early_access.sql:500` |
| `public.link_sample_to_bid` | `supabase/migrations/20260923215900_intake_early_access.sql:535` |
| `public.create_sample` | `supabase/migrations/20260923215900_intake_early_access.sql:563` |
| `public.list_samples` | `supabase/migrations/20260923215900_intake_early_access.sql:588` |
| `public.set_bid_projected_window` | `supabase/migrations/20260923220000_intake_projected_planning.sql:31` |
| `public.convert_bid_to_production` | `supabase/migrations/20260923220000_intake_projected_planning.sql:48` |
| `public.protect_converted_bid_source` | `supabase/migrations/20260923220000_intake_projected_planning.sql:95` |
| `public.prepare_admin_delete_bid` | `supabase/migrations/20260923220000_intake_projected_planning.sql:114` |
| `public.production_job_delete_blockers` | `supabase/migrations/20260923220000_intake_projected_planning.sql:125` |
| `public.has_intake_training_access` | `supabase/migrations/20260924190000_intake_personal_training.sql:28` |
| `public.owns_intake_training_bid` | `supabase/migrations/20260924190000_intake_personal_training.sql:31` |
| `public.require_bid_management` | `supabase/migrations/20260924190000_intake_personal_training.sql:34` |
| `public.require_bid_file_management` | `supabase/migrations/20260924190000_intake_personal_training.sql:41` |
| `public.create_personal_test_bid` | `supabase/migrations/20260924190000_intake_personal_training.sql:46` |
| `public.protect_training_bid_identity` | `supabase/migrations/20260924190000_intake_personal_training.sql:56` |
| `public.guard_production_training_update` | `supabase/migrations/20260924190000_intake_personal_training.sql:72` |
| `public.can_manage_intake_storage` | `supabase/migrations/20260924190000_intake_personal_training.sql:87` |
| `public.abort_bid_file_upload` | `supabase/migrations/20260924190000_intake_personal_training.sql:99` |
| `public.begin_bid_file_upload` | `supabase/migrations/20260924190000_intake_personal_training.sql:120` |
| `public.cancel_bid_file_removal` | `supabase/migrations/20260924190000_intake_personal_training.sql:145` |
| `public.convert_bid_to_production` | `supabase/migrations/20260924190000_intake_personal_training.sql:163` |
| `public.create_bid_update` | `supabase/migrations/20260924190000_intake_personal_training.sql:216` |
| `public.finalize_bid_file_removal` | `supabase/migrations/20260924190000_intake_personal_training.sql:238` |
| `public.finalize_bid_file_upload` | `supabase/migrations/20260924190000_intake_personal_training.sql:268` |
| `public.prepare_bid_file_removal` | `supabase/migrations/20260924190000_intake_personal_training.sql:291` |
| `public.set_bid_projected_window` | `supabase/migrations/20260924190000_intake_personal_training.sql:311` |
| `public.update_bid` | `supabase/migrations/20260924190000_intake_personal_training.sql:334` |
| `public.assert_personal_test_cleanup` | `supabase/migrations/20260924190000_intake_personal_training.sql:406` |
| `public.reset_personal_test_workflow` | `supabase/migrations/20260924190000_intake_personal_training.sql:434` |
| `public.tenops_account_preferences_valid` | `supabase/migrations/20260924200000_manpower_analytics_preference.sql:26` |
| `public.delete_empty_manpower_reporting_group` | `supabase/migrations/20260924210000_manpower_anonymous_access.sql:45` |
| `public.has_app_capability` | `supabase/migrations/20260924210000_manpower_anonymous_access.sql:45` |
| `public.set_manpower_updated_at` | `supabase/migrations/20260924210000_manpower_anonymous_access.sql:45` |
| `public.validate_manpower_product_category` | `supabase/migrations/20260924210000_manpower_anonymous_access.sql:45` |
| `public.create_production_rework` | `supabase/migrations/20260924210100_production_rework_anonymous_access.sql:45` |
| `public.save_production_planning_schedule_batch` | `supabase/migrations/20260924210100_production_rework_anonymous_access.sql:45` |
| `public.save_production_rework_mixed_schedule_batch` | `supabase/migrations/20260924210100_production_rework_anonymous_access.sql:45` |
| `public.save_production_rework_schedule_batch` | `supabase/migrations/20260924210100_production_rework_anonymous_access.sql:45` |
| `public.touch_production_rework_cycle_updated_at` | `supabase/migrations/20260924210100_production_rework_anonymous_access.sql:45` |
| `public.update_production_rework_status` | `supabase/migrations/20260924210100_production_rework_anonymous_access.sql:45` |
| `public.begin_my_work_attachment_transfer` | `supabase/migrations/20260925120000_messaging_large_attachments.sql:15` |
| `public.my_work_attachment_transfer_status` | `supabase/migrations/20260925120000_messaging_large_attachments.sql:46` |
| `public.recover_my_work_attachment_transfer` | `supabase/migrations/20260925120000_messaging_large_attachments.sql:60` |
| `public.heartbeat_my_work_attachment_transfer` | `supabase/migrations/20260925120000_messaging_large_attachments.sql:70` |
| `public.guard_my_work_attachment_object` | `supabase/migrations/20260925120000_messaging_large_attachments.sql:89` |
| `public.finalize_my_work_inbox_message` | `supabase/migrations/20260925120000_messaging_large_attachments.sql:105` |
| `public.cancel_my_work_attachment_transfer` | `supabase/migrations/20260925120000_messaging_large_attachments.sql:124` |
| `public.discard_my_work_inbox_message_draft` | `supabase/migrations/20260925120000_messaging_large_attachments.sql:135` |
| `public.claim_abandoned_my_work_transfers` | `supabase/migrations/20260925120000_messaging_large_attachments.sql:148` |
| `public.finish_abandoned_my_work_transfer` | `supabase/migrations/20260925120000_messaging_large_attachments.sql:161` |
| `public.require_bid_management` | `supabase/migrations/20260925180000_intake_early_access_editing.sql:21` |
| `public.convert_bid_to_production` | `supabase/migrations/20260925180000_intake_early_access_editing.sql:34` |
| `public.guard_my_work_message_job_retirement` | `supabase/migrations/20260925200000_messaging_v11.sql:14` |
| `public.reserve_my_work_attachment_preview` | `supabase/migrations/20260925200000_messaging_v11.sql:55` |
| `public.admin_permanently_delete_my_work_message` | `supabase/migrations/20260925200000_messaging_v11.sql:84` |
| `public.begin_my_work_attachment_transfer` | `supabase/migrations/20260925200000_messaging_v11.sql:113` |
| `public.guard_my_work_attachment_object` | `supabase/migrations/20260925200000_messaging_v11.sql:149` |
| `public.prepare_admin_delete_my_work_message` | `supabase/migrations/20260925200000_messaging_v11.sql:178` |
| `public.list_my_work_message_page_v11` | `supabase/migrations/20260925200000_messaging_v11.sql:200` |
| `public.list_my_work_conversations_v11` | `supabase/migrations/20260925200000_messaging_v11.sql:224` |
| `public.broadcast_my_work_message_v11` | `supabase/migrations/20260925200000_messaging_v11.sql:245` |
| `public.save_sample_operational_profile` | `supabase/migrations/20260930170000_sample_batch_chip_basis.sql:9` |
| `public.normalize_sample_formulation` | `supabase/migrations/20260930170000_sample_batch_chip_basis.sql:27` |
| `public.save_sample_draft` | `supabase/migrations/20260930170000_sample_batch_chip_basis.sql:45` |
| `public.restore_sample_working_version` | `supabase/migrations/20260930170000_sample_batch_chip_basis.sql:63` |
| `public.issue_sample_form` | `supabase/migrations/20260930170000_sample_batch_chip_basis.sql:77` |
| `public.save_sample_operational_profile` | `supabase/migrations/20260930220000_sample_batch_reference_thickness.sql:9` |
| `public.normalize_sample_formulation` | `supabase/migrations/20260930220000_sample_batch_reference_thickness.sql:27` |
| `public.save_sample_draft` | `supabase/migrations/20260930220000_sample_batch_reference_thickness.sql:45` |
| `public.sample_batch_component` | `supabase/migrations/20261001010000_sample_batch_first_authority.sql:21` |
| `public.save_sample_operational_profile` | `supabase/migrations/20261001010000_sample_batch_first_authority.sql:43` |
| `public.normalize_sample_formulation` | `supabase/migrations/20261001010000_sample_batch_first_authority.sql:59` |
| `public.save_sample_draft` | `supabase/migrations/20261001010000_sample_batch_first_authority.sql:92` |
| `public.create_sample` | `supabase/migrations/20261001010000_sample_batch_first_authority.sql:137` |
| `public.issue_sample_form` | `supabase/migrations/20261001010000_sample_batch_first_authority.sql:154` |
| `public.save_sample_draft` | `supabase/migrations/20261001013000_sample_batch_first_history.sql:8` |
| `public.normalize_sample_formulation` | `supabase/migrations/20261001150000_sample_batch_filler_override.sql:16` |
| `public.save_sample_operational_profile` | `supabase/migrations/20261001150000_sample_batch_filler_override.sql:65` |
| `public.issue_sample_form` | `supabase/migrations/20261002120000_sample_normal_resin_profiles.sql:20` |
| `public.has_app_capability` | `supabase/migrations/20261005120000_read_only_messaging_write.sql:14` |
| `public.get_my_app_access` | `supabase/migrations/20261005120000_read_only_messaging_write.sql:22` |
| `public.admin_list_app_access` | `supabase/migrations/20261005120000_read_only_messaging_write.sql:30` |
| `public.admin_set_app_access` | `supabase/migrations/20261005120000_read_only_messaging_write.sql:41` |
| `public.guard_tenops_business_write` | `supabase/migrations/20261005120000_read_only_messaging_write.sql:64` |
| `public.guard_tenops_messaging_write` | `supabase/migrations/20261005120000_read_only_messaging_write.sql:97` |
| `public.guard_tenops_notification_write` | `supabase/migrations/20261005120000_read_only_messaging_write.sql:122` |
| `public.guard_tenops_storage_write` | `supabase/migrations/20261005120000_read_only_messaging_write.sql:161` |
| `public.protect_issued_production_blend` | `supabase/migrations/20261005150000_production_blend_plans.sql:27` |
| `public.persist_production_blend` | `supabase/migrations/20261005150000_production_blend_plans.sql:36` |
| `public.has_app_capability` | `supabase/migrations/20261005170000_production_blend_capability.sql:6` |
| `public.get_my_app_access` | `supabase/migrations/20261005170000_production_blend_capability.sql:17` |
| `public.admin_list_app_access` | `supabase/migrations/20261005170000_production_blend_capability.sql:26` |
| `public.admin_set_app_access_v2` | `supabase/migrations/20261005170000_production_blend_capability.sql:38` |
| `public.persist_production_blend` | `supabase/migrations/20261005170000_production_blend_capability.sql:56` |
| `public.issue_sample_form` | `supabase/migrations/20261006120000_sample_audience_pdf_version.sql:6` |
| `public.sample_color_plate_next_sequence` | `supabase/migrations/20261006190000_sample_color_plate_allocation.sql:12` |
| `public.lock_sample_color_plate_identity` | `supabase/migrations/20261006190000_sample_color_plate_allocation.sql:31` |
| `public.suggest_sample_color_plate_number` | `supabase/migrations/20261006190000_sample_color_plate_allocation.sql:41` |
| `public.create_sample_with_formulation` | `supabase/migrations/20261006190000_sample_color_plate_allocation.sql:53` |
| `public.sample_nonnegative_numeric` | `supabase/migrations/20261009120000_sample_decimal_input_parsing.sql:4` |
| `public.has_app_capability` | `supabase/migrations/20261013180000_sample_label_capability.sql:6` |
| `public.get_my_app_access` | `supabase/migrations/20261013180000_sample_label_capability.sql:17` |
| `public.admin_list_app_access` | `supabase/migrations/20261013180000_sample_label_capability.sql:27` |
| `public.admin_set_app_access_v3` | `supabase/migrations/20261013180000_sample_label_capability.sql:40` |
| `public.authorize_sample_color_plate_label` | `supabase/migrations/20261013180000_sample_label_capability.sql:59` |
| `public.can_manage_production_contacts` | `supabase/migrations/20261014190000_production_contact_configuration.sql:39` |
| `public.get_production_contact` | `supabase/migrations/20261014190000_production_contact_configuration.sql:55` |
| `public.search_production_contacts` | `supabase/migrations/20261014190000_production_contact_configuration.sql:65` |
| `public.save_production_contact` | `supabase/migrations/20261014190000_production_contact_configuration.sql:84` |
| `public.guard_project_contact_snapshot` | `supabase/migrations/20261014190000_production_contact_configuration.sql:119` |
| `public.search_production_contacts` | `supabase/migrations/20261014210000_production_customer_list.sql:11` |
| `public.save_production_contact` | `supabase/migrations/20261014210000_production_customer_list.sql:30` |
| `public.get_production_customer` | `supabase/migrations/20261014210000_production_customer_list.sql:66` |
| `public.search_production_customers` | `supabase/migrations/20261014210000_production_customer_list.sql:75` |
| `public.list_production_company_contacts` | `supabase/migrations/20261014210000_production_customer_list.sql:89` |
| `public.save_production_customer` | `supabase/migrations/20261014210000_production_customer_list.sql:101` |
| `public.archive_production_customer` | `supabase/migrations/20261014210000_production_customer_list.sql:119` |
| `public.guard_project_archived_customer` | `supabase/migrations/20261014210000_production_customer_list.sql:131` |
| `public.guard_project_contact_snapshot` | `supabase/migrations/20261014220000_protected_job_contacts.sql:25` |
| `public.guard_project_archived_customer` | `supabase/migrations/20261014220000_protected_job_contacts.sql:40` |
| `public.detach_project_contact_on_customer_change` | `supabase/migrations/20261014220000_protected_job_contacts.sql:56` |
| `public.save_production_project` | `supabase/migrations/20261014220000_protected_job_contacts.sql:65` |
| `public.detach_project_contact_on_customer_change` | `supabase/migrations/20261014221000_defer_project_contact_detachment.sql:4` |
| `public.save_production_project` | `supabase/migrations/20261014222000_preserve_archived_project_contact_refresh.sql:3` |
| `public.import_approved_historical_customers_20261014` | `supabase/migrations/20261014230000_approved_historical_customer_names.sql:4` |
| `public.can_publish_sample_to_job` | `supabase/migrations/20261015170000_sample_job_update_publishing.sql:10` |
| `public.can_upload_sample_update` | `supabase/migrations/20261015170000_sample_job_update_publishing.sql:19` |
| `public.search_sample_update_jobs` | `supabase/migrations/20261015170000_sample_job_update_publishing.sql:39` |
| `public.publish_sample_job_update` | `supabase/migrations/20261015170000_sample_job_update_publishing.sql:54` |
| `public.prepare_tenops_rich_release_communication` | `supabase/migrations/20261015230000_rich_release_communications.sql:17` |
| `public.deliver_tenops_release_communication_to_user` | `supabase/migrations/20261015230000_rich_release_communications.sql:74` |
| `public.deliver_tenops_release_communication` | `supabase/migrations/20261015230000_rich_release_communications.sql:129` |
| `public.complete_tenops_rich_release_message` | `supabase/migrations/20261015230000_rich_release_communications.sql:158` |

## indexes

| Name | Source |
|---|---|
| `jobs_planned_start_idx` | `supabase/migrations/20260713_002_production_mvp_jobs.sql:133` |
| `jobs_planned_end_idx` | `supabase/migrations/20260713_002_production_mvp_jobs.sql:136` |
| `jobs_production_status_idx` | `supabase/migrations/20260713_002_production_mvp_jobs.sql:139` |
| `jobs_material_status_idx` | `supabase/migrations/20260713_002_production_mvp_jobs.sql:142` |
| `jobs_requested_delivery_date_idx` | `supabase/migrations/20260713_002_production_mvp_jobs.sql:145` |
| `jobs_archived_at_idx` | `supabase/migrations/20260713_002_production_mvp_jobs.sql:148` |
| `jobs_monday_item_id_unique_idx` | `supabase/migrations/20260713_002_production_mvp_jobs.sql:151` |
| `job_activity_job_occurred_idx` | `supabase/migrations/20260713_002_production_mvp_jobs.sql:202` |
| `job_activity_event_type_idx` | `supabase/migrations/20260713_002_production_mvp_jobs.sql:205` |
| `job_attachments_job_created_idx` | `supabase/migrations/20260713_003_job_attachments.sql:33` |
| `manpower_workers_display_name_unique_idx` | `supabase/migrations/20260714_001_manpower_reporting_mvp.sql:15` |
| `manpower_workers_active_sort_idx` | `supabase/migrations/20260714_001_manpower_reporting_mvp.sql:17` |
| `manpower_tasks_display_name_unique_idx` | `supabase/migrations/20260714_001_manpower_reporting_mvp.sql:30` |
| `manpower_tasks_active_sort_idx` | `supabase/migrations/20260714_001_manpower_reporting_mvp.sql:32` |
| `manpower_entries_work_date_idx` | `supabase/migrations/20260714_001_manpower_reporting_mvp.sql:65` |
| `manpower_entries_job_date_idx` | `supabase/migrations/20260714_001_manpower_reporting_mvp.sql:67` |
| `manpower_entries_worker_date_idx` | `supabase/migrations/20260714_001_manpower_reporting_mvp.sql:69` |
| `manpower_reporting_groups_name_idx` | `supabase/migrations/20260714_002_manpower_reporting_groups_and_import_correction.sql:12` |
| `manpower_entries_reporting_group_date_idx` | `supabase/migrations/20260714_002_manpower_reporting_groups_and_import_correction.sql:23` |
| `pending_receivals_production_job_idx` | `supabase/migrations/20260714_005_inventory_production_job_reservations.sql:170` |
| `inventory_items_production_job_idx` | `supabase/migrations/20260714_005_inventory_production_job_reservations.sql:172` |
| `inventory_transactions_production_job_idx` | `supabase/migrations/20260714_005_inventory_production_job_reservations.sql:174` |
| `material_usage_reports_date_updated_idx` | `supabase/migrations/20260720_001_material_usage_reporting.sql:175` |
| `material_usage_reports_job_date_idx` | `supabase/migrations/20260720_001_material_usage_reporting.sql:177` |
| `material_usage_lines_report_sort_idx` | `supabase/migrations/20260720_001_material_usage_reporting.sql:179` |
| `inventory_transactions_pending_receival_idx` | `supabase/migrations/20260722_001_pending_receival_undo.sql:15` |
| `inventory_transactions_reversal_idx` | `supabase/migrations/20260722_001_pending_receival_undo.sql:19` |
| `vendors_canonical_name_unique_idx` | `supabase/migrations/20260722_002_purchasing_phase1.sql:18` |
| `purchase_orders_po_number_unique_idx` | `supabase/migrations/20260722_002_purchasing_phase1.sql:59` |
| `purchase_orders_status_order_date_idx` | `supabase/migrations/20260722_002_purchasing_phase1.sql:60` |
| `purchase_orders_family_revision_idx` | `supabase/migrations/20260722_002_purchasing_phase1.sql:61` |
| `purchase_orders_vendor_idx` | `supabase/migrations/20260722_002_purchasing_phase1.sql:62` |
| `chip_po_details_job_idx` | `supabase/migrations/20260722_002_purchasing_phase1.sql:103` |
| `chip_po_details_material_idx` | `supabase/migrations/20260722_002_purchasing_phase1.sql:104` |
| `purchase_orders_production_job_idx` | `supabase/migrations/20260722_003_purchasing_phase1_1_simplification.sql:11` |
| `vendor_contacts_identity_unique_idx` | `supabase/migrations/20260722_005_purchasing_vendor_configuration.sql:31` |
| `vendor_contacts_one_default_idx` | `supabase/migrations/20260722_005_purchasing_vendor_configuration.sql:33` |
| `vendor_contacts_vendor_idx` | `supabase/migrations/20260722_005_purchasing_vendor_configuration.sql:35` |
| `vendor_catalog_v2_vendor_idx` | `supabase/migrations/20260722_005_purchasing_vendor_configuration.sql:45` |
| `vendor_catalog_v2_vendor_sku_unique_idx` | `supabase/migrations/20260722_005_purchasing_vendor_configuration.sql:47` |
| `purchase_orders_po_number_normalized_unique_idx` | `supabase/migrations/20260723_001_purchase_order_issuance.sql:19` |
| `purchase_order_issuances_order_idx` | `supabase/migrations/20260723_001_purchase_order_issuance.sql:42` |
| `purchase_order_documents_status_idx` | `supabase/migrations/20260723_004_purchase_order_pdf_documents.sql:29` |
| `vendor_catalog_vendor_sku_search_idx` | `supabase/migrations/20260723_007_arim_catalog_skus.sql:54` |
| `pending_receivals_purchase_order_source_uidx` | `supabase/migrations/20260723_008_purchase_order_pending_receivals.sql:31` |
| `pending_receivals_purchase_order_number_idx` | `supabase/migrations/20260723_008_purchase_order_pending_receivals.sql:39` |
| `job_updates_job_created_idx` | `supabase/migrations/20260727_001_production_job_updates.sql:43` |
| `job_updates_open_follow_up_idx` | `supabase/migrations/20260727_001_production_job_updates.sql:46` |
| `job_attachments_job_update_idx` | `supabase/migrations/20260727_001_production_job_updates.sql:56` |
| `job_transmittals_number_uidx` | `supabase/migrations/20260728_001_job_transmittals.sql:33` |
| `job_transmittals_job_issued_idx` | `supabase/migrations/20260728_001_job_transmittals.sql:35` |
| `whiteboard_cards_job_idx` | `supabase/migrations/20260731_001_whiteboard_mvp.sql:24` |
| `whiteboard_cards_owner_idx` | `supabase/migrations/20260731_001_whiteboard_mvp.sql:25` |
| `whiteboard_cards_category_idx` | `supabase/migrations/20260731_001_whiteboard_mvp.sql:26` |
| `whiteboard_cards_timeline_idx` | `supabase/migrations/20260731_001_whiteboard_mvp.sql:27` |
| `planning_phases_timeline_idx` | `supabase/migrations/20260731_003_planning_phases_items.sql:39` |
| `planning_items_phase_idx` | `supabase/migrations/20260731_003_planning_phases_items.sql:69` |
| `planning_phase_library_order_idx` | `supabase/migrations/20260731_003_planning_phases_items.sql:79` |
| `planning_phase_library_items_idx` | `supabase/migrations/20260731_003_planning_phases_items.sql:87` |
| `production_rework_one_active_per_job_idx` | `supabase/migrations/20260817_003_production_rework_cycles.sql:31` |
| `production_rework_job_history_idx` | `supabase/migrations/20260817_003_production_rework_cycles.sql:34` |
| `production_rework_schedule_idx` | `supabase/migrations/20260817_003_production_rework_cycles.sql:36` |
| `job_updates_follow_up_assignee_user_open_idx` | `supabase/migrations/20260818_001_rbac_identity_infrastructure.sql:174` |
| `account_notifications_user_unread_idx` | `supabase/migrations/20260818_004_final_compatibility_support.sql:141` |
| `job_update_mentions_user_idx` | `supabase/migrations/20260819_001_job_update_account_collaboration.sql:13` |
| `account_notifications_user_history_idx` | `supabase/migrations/20260819_002_legacy_job_update_enrollment_notifications.sql:6` |
| `manpower_entries_rework_date_idx` | `supabase/migrations/20260824_002_manpower_rework_attribution.sql:20` |
| `jobs_job_number_normalized_unique` | `supabase/migrations/20260827_009_job_number_uniqueness.sql:18` |
| `work_tasks_assignee_open_idx` | `supabase/migrations/20260827_012_my_work_mvp.sql:21` |
| `work_tasks_creator_shared_idx` | `supabase/migrations/20260827_012_my_work_mvp.sql:22` |
| `work_tasks_context_idx` | `supabase/migrations/20260827_012_my_work_mvp.sql:23` |
| `work_task_attachments_task_created_idx` | `supabase/migrations/20260831_015_my_work_task_attachments.sql:34` |
| `my_work_messages_sender_created_idx` | `supabase/migrations/20260831_016_my_work_inbox.sql:14` |
| `my_work_messages_recipient_created_idx` | `supabase/migrations/20260831_016_my_work_inbox.sql:15` |
| `my_work_messages_recipient_unread_idx` | `supabase/migrations/20260831_016_my_work_inbox.sql:16` |
| `my_work_message_attachments_message_idx` | `supabase/migrations/20260831_017_my_work_inbox_attachments.sql:25` |
| `my_work_messages_system_delivery_unique` | `supabase/migrations/20260831_018_durable_release_communications.sql:45` |
| `my_work_message_versions_message_idx` | `supabase/migrations/20260831_020_my_work_lifecycle_admin_cleanup.sql:18` |
| `bids_status_updated_idx` | `supabase/migrations/20260901_001_preproduction_bids.sql:17` |
| `bids_owner_updated_idx` | `supabase/migrations/20260901_001_preproduction_bids.sql:18` |
| `bid_activity_bid_occurred_idx` | `supabase/migrations/20260901_001_preproduction_bids.sql:29` |
| `bid_updates_bid_created_idx` | `supabase/migrations/20260901_002_bid_operational_context.sql:40` |
| `bid_file_relationships_file_idx` | `supabase/migrations/20260901_003_bid_files.sql:38` |
| `canonical_record_deletion_audit_record_idx` | `supabase/migrations/20260901_004_admin_canonical_cleanup.sql:14` |
| `samples_bid_updated_idx` | `supabase/migrations/20260901_005_sample_color_plate_generator.sql:29` |
| `samples_job_updated_idx` | `supabase/migrations/20260901_005_sample_color_plate_generator.sql:30` |
| `bid_proposal_relationships_bid_linked_idx` | `supabase/migrations/20260902_002_bid_proposal_relationships.sql:13` |
| `my_work_task_groups_owner_idx` | `supabase/migrations/20260902_004_my_work_task_groups.sql:13` |
| `my_work_task_group_memberships_group_idx` | `supabase/migrations/20260902_004_my_work_task_groups.sql:23` |
| `proposal_estimates_defaults_version_idx` | `supabase/migrations/20260908_004_proposal_generator_v2.sql:59` |
| `sample_working_versions_sample_idx` | `supabase/migrations/20260917_001_sample_formulation_foundation.sql:35` |
| `purchase_orders_recovery_key_unique_idx` | `supabase/migrations/20260917_005_purchase_order_recovery_idempotency.sql:13` |
| `sample_formulation_profiles_one_default` | `supabase/migrations/20260918_003_sample_formula_volumetric_profiles.sql:20` |
| `manpower_product_categories_name_unique` | `supabase/migrations/20260921_001_manpower_product_categories.sql:18` |
| `manpower_product_categories_order_idx` | `supabase/migrations/20260921_001_manpower_product_categories.sql:20` |
| `manpower_entries_job_product_date_idx` | `supabase/migrations/20260921_001_manpower_product_categories.sql:64` |
| `sample_operational_profiles_name` | `supabase/migrations/20260923160000_sample_operational_profiles.sql:20` |
| `pending_receivals_purchase_order_source_uidx` | `supabase/migrations/20260923160100_po_reservation_allocations.sql:84` |
| `pending_receivals_allocation_source_uidx` | `supabase/migrations/20260923160100_po_reservation_allocations.sql:85` |
| `bids_projected_window_idx` | `supabase/migrations/20260923220000_intake_projected_planning.sql:17` |
| `manpower_entries_job_date_idx` | `supabase/migrations/20260924210000_manpower_anonymous_access.sql:45` |
| `manpower_entries_job_product_date_idx` | `supabase/migrations/20260924210000_manpower_anonymous_access.sql:45` |
| `manpower_entries_pkey` | `supabase/migrations/20260924210000_manpower_anonymous_access.sql:45` |
| `manpower_entries_reporting_group_date_idx` | `supabase/migrations/20260924210000_manpower_anonymous_access.sql:45` |
| `manpower_entries_rework_date_idx` | `supabase/migrations/20260924210000_manpower_anonymous_access.sql:45` |
| `manpower_entries_work_date_idx` | `supabase/migrations/20260924210000_manpower_anonymous_access.sql:45` |
| `manpower_entries_worker_date_idx` | `supabase/migrations/20260924210000_manpower_anonymous_access.sql:45` |
| `manpower_reporting_groups_name_idx` | `supabase/migrations/20260924210000_manpower_anonymous_access.sql:45` |
| `manpower_reporting_groups_pkey` | `supabase/migrations/20260924210000_manpower_anonymous_access.sql:45` |
| `manpower_tasks_active_sort_idx` | `supabase/migrations/20260924210000_manpower_anonymous_access.sql:45` |
| `manpower_tasks_display_name_unique_idx` | `supabase/migrations/20260924210000_manpower_anonymous_access.sql:45` |
| `manpower_tasks_pkey` | `supabase/migrations/20260924210000_manpower_anonymous_access.sql:45` |
| `manpower_workers_active_sort_idx` | `supabase/migrations/20260924210000_manpower_anonymous_access.sql:45` |
| `manpower_workers_display_name_unique_idx` | `supabase/migrations/20260924210000_manpower_anonymous_access.sql:45` |
| `manpower_workers_pkey` | `supabase/migrations/20260924210000_manpower_anonymous_access.sql:45` |
| `production_rework_cycle_sequence_unique` | `supabase/migrations/20260924210100_production_rework_anonymous_access.sql:45` |
| `production_rework_cycles_id_job_unique` | `supabase/migrations/20260924210100_production_rework_anonymous_access.sql:45` |
| `production_rework_cycles_pkey` | `supabase/migrations/20260924210100_production_rework_anonymous_access.sql:45` |
| `production_rework_job_history_idx` | `supabase/migrations/20260924210100_production_rework_anonymous_access.sql:45` |
| `production_rework_one_active_per_job_idx` | `supabase/migrations/20260924210100_production_rework_anonymous_access.sql:45` |
| `production_rework_schedule_idx` | `supabase/migrations/20260924210100_production_rework_anonymous_access.sql:45` |
| `my_work_messages_upload_cleanup_idx` | `supabase/migrations/20260925120000_messaging_large_attachments.sql:10` |
| `my_work_attachment_previews_message_idx` | `supabase/migrations/20260925200000_messaging_v11.sql:45` |
| `production_blend_plans_sample_idx` | `supabase/migrations/20261005150000_production_blend_plans.sql:20` |
| `production_companies_search` | `supabase/migrations/20261014190000_production_contact_configuration.sql:26` |
| `production_contacts_search` | `supabase/migrations/20261014190000_production_contact_configuration.sql:27` |
| `production_contacts_company` | `supabase/migrations/20261014190000_production_contact_configuration.sql:28` |
| `jobs_customer_company` | `supabase/migrations/20261014190000_production_contact_configuration.sql:35` |
| `jobs_customer_contact` | `supabase/migrations/20261014190000_production_contact_configuration.sql:36` |
| `production_companies_active_search` | `supabase/migrations/20261014210000_production_customer_list.sql:9` |

## triggers

| Name | Source |
|---|---|
| `trg_jobs_updated_at` | `supabase/migrations/20260713_002_production_mvp_jobs.sql:171` |
| `trg_manpower_workers_updated_at` | `supabase/migrations/20260714_001_manpower_reporting_mvp.sql:82` |
| `trg_manpower_tasks_updated_at` | `supabase/migrations/20260714_001_manpower_reporting_mvp.sql:86` |
| `trg_manpower_entries_updated_at` | `supabase/migrations/20260714_001_manpower_reporting_mvp.sql:90` |
| `trg_manpower_reporting_groups_updated_at` | `supabase/migrations/20260714_002_manpower_reporting_groups_and_import_correction.sql:15` |
| `trg_material_usage_reports_updated_at` | `supabase/migrations/20260720_001_material_usage_reporting.sql:194` |
| `trg_material_usage_lines_updated_at` | `supabase/migrations/20260720_001_material_usage_reporting.sql:199` |
| `purchase_order_issuances_guard_immutable` | `supabase/migrations/20260723_001_purchase_order_issuance.sql:58` |
| `purchase_orders_guard_issued` | `supabase/migrations/20260723_001_purchase_order_issuance.sql:74` |
| `purchase_order_lines_guard_issued` | `supabase/migrations/20260723_001_purchase_order_issuance.sql:98` |
| `chip_purchase_order_details_guard_issued` | `supabase/migrations/20260723_001_purchase_order_issuance.sql:123` |
| `purchase_order_issuances_capture_pdf_fields` | `supabase/migrations/20260723_004_purchase_order_pdf_documents.sql:82` |
| `purchase_order_issuances_initialize_document` | `supabase/migrations/20260723_004_purchase_order_pdf_documents.sql:101` |
| `trg_job_attachments_validate_update_job` | `supabase/migrations/20260727_001_production_job_updates.sql:80` |
| `job_transmittals_immutable` | `supabase/migrations/20260728_001_job_transmittals.sql:194` |
| `job_transmittals_no_delete` | `supabase/migrations/20260728_001_job_transmittals.sql:203` |
| `trg_whiteboard_cards_updated_at` | `supabase/migrations/20260731_001_whiteboard_mvp.sql:33` |
| `trg_whiteboard_cards_dependency` | `supabase/migrations/20260731_001_whiteboard_mvp.sql:48` |
| `trg_planning_items_updated_at` | `supabase/migrations/20260731_003_planning_phases_items.sql:90` |
| `trg_planning_phase_library_updated_at` | `supabase/migrations/20260731_003_planning_phases_items.sql:91` |
| `trg_planning_phase_library_items_updated_at` | `supabase/migrations/20260731_003_planning_phases_items.sql:92` |
| `trg_planning_phases_limit` | `supabase/migrations/20260803_001_planning_library_colors_and_phase_cap.sql:104` |
| `production_rework_cycles_touch_updated_at` | `supabase/migrations/20260817_003_production_rework_cycles.sql:63` |
| `app_users_touch_updated_at` | `supabase/migrations/20260818_001_rbac_identity_infrastructure.sql:70` |
| `jobs_rbac_update_guard` | `supabase/migrations/20260818_002_rbac_final_enforcement_DO_NOT_APPLY.sql:168` |
| `purchase_order_issuance_apply_job_reference` | `supabase/migrations/20260818_004_final_compatibility_support.sql:120` |
| `account_user_preferences_touch_updated_at` | `supabase/migrations/20260821_002_friday_welcome_and_job_update_seen.sql:195` |
| `proposals_touch_updated_at` | `supabase/migrations/20260827_004_proposal_generator_v1.sql:70` |
| `proposal_lines_touch_updated_at` | `supabase/migrations/20260827_004_proposal_generator_v1.sql:71` |
| `proposal_pdf_documents_touch_updated_at` | `supabase/migrations/20260827_004_proposal_generator_v1.sql:72` |
| `proposal_issued_immutable` | `supabase/migrations/20260827_004_proposal_generator_v1.sql:79` |
| `proposal_line_issued_immutable` | `supabase/migrations/20260827_004_proposal_generator_v1.sql:87` |
| `proposal_acceptance_defaults` | `supabase/migrations/20260827_007_proposal_acceptance_defaults.sql:20` |
| `proposal_clarification_revision_defaults` | `supabase/migrations/20260827_008_proposal_commercial_clarifications.sql:20` |
| `jobs_canonicalize_job_number` | `supabase/migrations/20260827_009_job_number_uniqueness.sql:14` |
| `work_tasks_touch_updated_at` | `supabase/migrations/20260827_012_my_work_mvp.sql:28` |
| `app_users_deliver_current_tenops_onboarding` | `supabase/migrations/20260831_018_durable_release_communications.sql:149` |
| `bids_touch_updated_at` | `supabase/migrations/20260901_001_preproduction_bids.sql:31` |
| `sample_issued_document_snapshot_immutable` | `supabase/migrations/20260901_005_sample_color_plate_generator.sql:75` |
| `samples_touch_updated_at` | `supabase/migrations/20260901_005_sample_color_plate_generator.sql:77` |
| `proposals_inherit_bid_relationship` | `supabase/migrations/20260902_002_bid_proposal_relationships.sql:38` |
| `proposals_initialize_estimate_v2` | `supabase/migrations/20260908_004_proposal_generator_v2.sql:713` |
| `proposal_estimating_defaults_immutable` | `supabase/migrations/20260908_004_proposal_generator_v2.sql:1136` |
| `proposal_estimate_issued_immutable` | `supabase/migrations/20260908_004_proposal_generator_v2.sql:1162` |
| `proposal_estimates_touch_updated_at` | `supabase/migrations/20260908_004_proposal_generator_v2.sql:1166` |
| `sample_working_version_immutable` | `supabase/migrations/20260917_001_sample_formulation_foundation.sql:44` |
| `manpower_product_category_audit` | `supabase/migrations/20260921_001_manpower_product_categories.sql:47` |
| `manpower_entry_product_category_guard` | `supabase/migrations/20260921_001_manpower_product_categories.sql:93` |
| `zz_capture_po_allocation_intent` | `supabase/migrations/20260923160100_po_reservation_allocations.sql:80` |
| `bids_protect_converted_source` | `supabase/migrations/20260923220000_intake_projected_planning.sql:101` |
| `protect_training_bid_identity` | `supabase/migrations/20260924190000_intake_personal_training.sql:64` |
| `guard_production_training_update` | `supabase/migrations/20260924190000_intake_personal_training.sql:83` |
| `manpower_entry_product_category_guard` | `supabase/migrations/20260924210000_manpower_anonymous_access.sql:45` |
| `trg_manpower_entries_updated_at` | `supabase/migrations/20260924210000_manpower_anonymous_access.sql:45` |
| `trg_manpower_reporting_groups_updated_at` | `supabase/migrations/20260924210000_manpower_anonymous_access.sql:45` |
| `trg_manpower_tasks_updated_at` | `supabase/migrations/20260924210000_manpower_anonymous_access.sql:45` |
| `trg_manpower_workers_updated_at` | `supabase/migrations/20260924210000_manpower_anonymous_access.sql:45` |
| `production_rework_cycles_touch_updated_at` | `supabase/migrations/20260924210100_production_rework_anonymous_access.sql:45` |
| `guard_my_work_attachment_object` | `supabase/migrations/20260925120000_messaging_large_attachments.sql:103` |
| `bids_protect_converted_source` | `supabase/migrations/20260925180000_intake_early_access_editing.sql:17` |
| `bids_touch_updated_at` | `supabase/migrations/20260925180000_intake_early_access_editing.sql:17` |
| `protect_training_bid_identity` | `supabase/migrations/20260925180000_intake_early_access_editing.sql:17` |
| `guard_production_training_update` | `supabase/migrations/20260925180000_intake_early_access_editing.sql:17` |
| `jobs_canonicalize_job_number` | `supabase/migrations/20260925180000_intake_early_access_editing.sql:17` |
| `trg_jobs_updated_at` | `supabase/migrations/20260925180000_intake_early_access_editing.sql:17` |
| `guard_my_work_message_job_retirement` | `supabase/migrations/20260925200000_messaging_v11.sql:23` |
| `broadcast_my_work_message_v11` | `supabase/migrations/20260925200000_messaging_v11.sql:256` |
| `tenops_business_write_guard` | `supabase/migrations/20261005120000_read_only_messaging_write.sql:85` |
| `tenops_messaging_write_guard` | `supabase/migrations/20261005120000_read_only_messaging_write.sql:117` |
| `tenops_notification_write_guard` | `supabase/migrations/20261005120000_read_only_messaging_write.sql:138` |
| `tenops_storage_bucket_write_guard` | `supabase/migrations/20261005120000_read_only_messaging_write.sql:158` |
| `tenops_storage_write_guard` | `supabase/migrations/20261005120000_read_only_messaging_write.sql:177` |
| `protect_issued_production_blend` | `supabase/migrations/20261005150000_production_blend_plans.sql:34` |
| `sample_color_plate_identity_lock` | `supabase/migrations/20261006190000_sample_color_plate_allocation.sql:38` |
| `jobs_contact_snapshot_guard` | `supabase/migrations/20261014190000_production_contact_configuration.sql:147` |
| `jobs_customer_list_guard` | `supabase/migrations/20261014210000_production_customer_list.sql:143` |
| `project_contact_validate` | `supabase/migrations/20261014220000_protected_job_contacts.sql:53` |
| `project_contact_customer_available` | `supabase/migrations/20261014220000_protected_job_contacts.sql:54` |
| `project_contact_detach` | `supabase/migrations/20261014220000_protected_job_contacts.sql:62` |

## policies

| Name | Source |
|---|---|
| `"Allow anon read jobs"` | `supabase/migrations/20260713_002_production_mvp_jobs.sql:224` |
| `"Allow anon insert jobs"` | `supabase/migrations/20260713_002_production_mvp_jobs.sql:230` |
| `"Allow anon update jobs"` | `supabase/migrations/20260713_002_production_mvp_jobs.sql:236` |
| `"Allow anon delete jobs"` | `supabase/migrations/20260713_002_production_mvp_jobs.sql:243` |
| `"Allow anon read job activity"` | `supabase/migrations/20260713_002_production_mvp_jobs.sql:254` |
| `"Allow anon insert job activity"` | `supabase/migrations/20260713_002_production_mvp_jobs.sql:260` |
| `"Allow anon update job activity"` | `supabase/migrations/20260713_002_production_mvp_jobs.sql:266` |
| `"Allow anon delete job activity"` | `supabase/migrations/20260713_002_production_mvp_jobs.sql:273` |
| `"Allow anon read job attachments"` | `supabase/migrations/20260713_003_job_attachments.sql:42` |
| `"Allow anon insert job attachments"` | `supabase/migrations/20260713_003_job_attachments.sql:45` |
| `"Allow anon delete job attachments"` | `supabase/migrations/20260713_003_job_attachments.sql:48` |
| `"Allow anon read job attachment objects"` | `supabase/migrations/20260713_003_job_attachments.sql:61` |
| `"Allow anon upload job attachment objects"` | `supabase/migrations/20260713_003_job_attachments.sql:65` |
| `"Allow anon delete job attachment objects"` | `supabase/migrations/20260713_003_job_attachments.sql:69` |
| `"Allow anon read manpower workers"` | `supabase/migrations/20260714_001_manpower_reporting_mvp.sql:112` |
| `"Allow anon insert manpower workers"` | `supabase/migrations/20260714_001_manpower_reporting_mvp.sql:114` |
| `"Allow anon update manpower workers"` | `supabase/migrations/20260714_001_manpower_reporting_mvp.sql:116` |
| `"Allow anon read manpower tasks"` | `supabase/migrations/20260714_001_manpower_reporting_mvp.sql:119` |
| `"Allow anon insert manpower tasks"` | `supabase/migrations/20260714_001_manpower_reporting_mvp.sql:121` |
| `"Allow anon update manpower tasks"` | `supabase/migrations/20260714_001_manpower_reporting_mvp.sql:123` |
| `"Allow anon read manpower entries"` | `supabase/migrations/20260714_001_manpower_reporting_mvp.sql:126` |
| `"Allow anon insert manpower entries"` | `supabase/migrations/20260714_001_manpower_reporting_mvp.sql:128` |
| `"Allow anon update manpower entries"` | `supabase/migrations/20260714_001_manpower_reporting_mvp.sql:130` |
| `"Allow anon read manpower reporting groups"` | `supabase/migrations/20260714_002_manpower_reporting_groups_and_import_correction.sql:34` |
| `"Allow anon insert manpower reporting groups"` | `supabase/migrations/20260714_002_manpower_reporting_groups_and_import_correction.sql:36` |
| `"Allow anon update manpower reporting groups"` | `supabase/migrations/20260714_002_manpower_reporting_groups_and_import_correction.sql:38` |
| `"Allow anon delete manpower entries"` | `supabase/migrations/20260714_004_manpower_entries_delete_policy.sql:5` |
| `"Allow anon read material usage reports"` | `supabase/migrations/20260720_001_material_usage_reporting.sql:437` |
| `"Allow authenticated read material usage reports"` | `supabase/migrations/20260720_001_material_usage_reporting.sql:439` |
| `"Allow anon read material usage lines"` | `supabase/migrations/20260720_001_material_usage_reporting.sql:441` |
| `"Allow authenticated read material usage lines"` | `supabase/migrations/20260720_001_material_usage_reporting.sql:443` |
| `"Purchasing reference read"` | `supabase/migrations/20260722_002_purchasing_phase1.sql:166` |
| `"Purchase Order read"` | `supabase/migrations/20260722_002_purchasing_phase1.sql:167` |
| `"Purchase Order line read"` | `supabase/migrations/20260722_002_purchasing_phase1.sql:168` |
| `"Chip PO detail read"` | `supabase/migrations/20260722_002_purchasing_phase1.sql:169` |
| `"Vendor contact read"` | `supabase/migrations/20260722_005_purchasing_vendor_configuration.sql:140` |
| `"Purchase Order issuance read"` | `supabase/migrations/20260723_001_purchase_order_issuance.sql:47` |
| `"Purchase Order document read"` | `supabase/migrations/20260723_004_purchase_order_pdf_documents.sql:34` |
| `"Allow anon read job updates"` | `supabase/migrations/20260727_001_production_job_updates.sql:124` |
| `"Allow authenticated read job updates"` | `supabase/migrations/20260727_001_production_job_updates.sql:127` |
| `"Allow anon insert job updates"` | `supabase/migrations/20260727_001_production_job_updates.sql:130` |
| `"Allow authenticated insert job updates"` | `supabase/migrations/20260727_001_production_job_updates.sql:133` |
| `"job_transmittals_read"` | `supabase/migrations/20260728_001_job_transmittals.sql:41` |
| `"Allow anon read whiteboard cards"` | `supabase/migrations/20260731_001_whiteboard_mvp.sql:52` |
| `"Allow anon insert whiteboard cards"` | `supabase/migrations/20260731_001_whiteboard_mvp.sql:53` |
| `"Allow anon update whiteboard cards"` | `supabase/migrations/20260731_001_whiteboard_mvp.sql:54` |
| `"Allow anon delete whiteboard cards"` | `supabase/migrations/20260731_001_whiteboard_mvp.sql:55` |
| `"Allow authenticated read whiteboard cards"` | `supabase/migrations/20260731_001_whiteboard_mvp.sql:56` |
| `"Allow authenticated insert whiteboard cards"` | `supabase/migrations/20260731_001_whiteboard_mvp.sql:57` |
| `"Allow authenticated update whiteboard cards"` | `supabase/migrations/20260731_001_whiteboard_mvp.sql:58` |
| `"Allow authenticated delete whiteboard cards"` | `supabase/migrations/20260731_001_whiteboard_mvp.sql:59` |
| `"Compatibility read Production Rework"` | `supabase/migrations/20260817_003_production_rework_cycles.sql:69` |
| `app_users_read_self` | `supabase/migrations/20260818_001_rbac_identity_infrastructure.sql:220` |
| `role_capabilities_read_active` | `supabase/migrations/20260818_001_rbac_identity_infrastructure.sql:222` |
| `"RBAC create jobs"` | `supabase/migrations/20260818_002_rbac_final_enforcement_DO_NOT_APPLY.sql:134` |
| `"RBAC update jobs"` | `supabase/migrations/20260818_002_rbac_final_enforcement_DO_NOT_APPLY.sql:135` |
| `"RBAC delete jobs"` | `supabase/migrations/20260818_002_rbac_final_enforcement_DO_NOT_APPLY.sql:142` |
| `"RBAC read job attachment objects"` | `supabase/migrations/20260818_002_rbac_final_enforcement_DO_NOT_APPLY.sql:247` |
| `"RBAC upload job attachment objects"` | `supabase/migrations/20260818_002_rbac_final_enforcement_DO_NOT_APPLY.sql:249` |
| `"RBAC delete job attachment objects"` | `supabase/migrations/20260818_002_rbac_final_enforcement_DO_NOT_APPLY.sql:251` |
| `"Compatibility authenticated read jobs"` | `supabase/migrations/20260818_003_rbac_compatibility_authenticated_access.sql:12` |
| `"Compatibility authenticated insert jobs"` | `supabase/migrations/20260818_003_rbac_compatibility_authenticated_access.sql:13` |
| `"Compatibility authenticated update jobs"` | `supabase/migrations/20260818_003_rbac_compatibility_authenticated_access.sql:14` |
| `"Compatibility authenticated delete jobs"` | `supabase/migrations/20260818_003_rbac_compatibility_authenticated_access.sql:15` |
| `"Compatibility authenticated read job activity"` | `supabase/migrations/20260818_003_rbac_compatibility_authenticated_access.sql:22` |
| `"Compatibility authenticated insert job activity"` | `supabase/migrations/20260818_003_rbac_compatibility_authenticated_access.sql:23` |
| `"Compatibility authenticated update job activity"` | `supabase/migrations/20260818_003_rbac_compatibility_authenticated_access.sql:24` |
| `"Compatibility authenticated delete job activity"` | `supabase/migrations/20260818_003_rbac_compatibility_authenticated_access.sql:25` |
| `"Compatibility authenticated read job attachments"` | `supabase/migrations/20260818_003_rbac_compatibility_authenticated_access.sql:32` |
| `"Compatibility authenticated insert job attachments"` | `supabase/migrations/20260818_003_rbac_compatibility_authenticated_access.sql:33` |
| `"Compatibility authenticated delete job attachments"` | `supabase/migrations/20260818_003_rbac_compatibility_authenticated_access.sql:34` |
| `"Compatibility authenticated read job attachment objects"` | `supabase/migrations/20260818_003_rbac_compatibility_authenticated_access.sql:40` |
| `"Compatibility authenticated upload job attachment objects"` | `supabase/migrations/20260818_003_rbac_compatibility_authenticated_access.sql:42` |
| `"Compatibility authenticated delete job attachment objects"` | `supabase/migrations/20260818_003_rbac_compatibility_authenticated_access.sql:44` |
| `"Compatibility authenticated read manpower workers"` | `supabase/migrations/20260818_003_rbac_compatibility_authenticated_access.sql:52` |
| `"Compatibility authenticated insert manpower workers"` | `supabase/migrations/20260818_003_rbac_compatibility_authenticated_access.sql:53` |
| `"Compatibility authenticated update manpower workers"` | `supabase/migrations/20260818_003_rbac_compatibility_authenticated_access.sql:54` |
| `"Compatibility authenticated read manpower tasks"` | `supabase/migrations/20260818_003_rbac_compatibility_authenticated_access.sql:60` |
| `"Compatibility authenticated insert manpower tasks"` | `supabase/migrations/20260818_003_rbac_compatibility_authenticated_access.sql:61` |
| `"Compatibility authenticated update manpower tasks"` | `supabase/migrations/20260818_003_rbac_compatibility_authenticated_access.sql:62` |
| `"Compatibility authenticated read manpower entries"` | `supabase/migrations/20260818_003_rbac_compatibility_authenticated_access.sql:69` |
| `"Compatibility authenticated insert manpower entries"` | `supabase/migrations/20260818_003_rbac_compatibility_authenticated_access.sql:70` |
| `"Compatibility authenticated update manpower entries"` | `supabase/migrations/20260818_003_rbac_compatibility_authenticated_access.sql:71` |
| `"Compatibility authenticated delete manpower entries"` | `supabase/migrations/20260818_003_rbac_compatibility_authenticated_access.sql:72` |
| `"Compatibility authenticated read manpower reporting groups"` | `supabase/migrations/20260818_003_rbac_compatibility_authenticated_access.sql:78` |
| `"Compatibility authenticated insert manpower reporting groups"` | `supabase/migrations/20260818_003_rbac_compatibility_authenticated_access.sql:79` |
| `"Compatibility authenticated update manpower reporting groups"` | `supabase/migrations/20260818_003_rbac_compatibility_authenticated_access.sql:80` |
| `account_notifications_read_self` | `supabase/migrations/20260818_004_final_compatibility_support.sql:147` |
| `job_update_mentions_authenticated_read` | `supabase/migrations/20260819_001_job_update_account_collaboration.sql:20` |
| `job_update_seen_state_read_self` | `supabase/migrations/20260821_002_friday_welcome_and_job_update_seen.sql:33` |
| `account_user_preferences_read_self` | `supabase/migrations/20260821_002_friday_welcome_and_job_update_seen.sql:201` |
| `"Pending Receivals RBAC insert"` | `supabase/migrations/20260824_001_pending_receival_rbac_enforcement.sql:37` |
| `"Pending Receivals RBAC update"` | `supabase/migrations/20260824_001_pending_receival_rbac_enforcement.sql:41` |
| `"Pending Receivals RBAC delete"` | `supabase/migrations/20260824_001_pending_receival_rbac_enforcement.sql:46` |
| `proposal_access_self` | `supabase/migrations/20260827_004_proposal_generator_v1.sql:94` |
| `proposal_authorized_all` | `supabase/migrations/20260827_004_proposal_generator_v1.sql:95` |
| `proposal_lines_authorized_all` | `supabase/migrations/20260827_004_proposal_generator_v1.sql:96` |
| `proposal_documents_authorized_all` | `supabase/migrations/20260827_004_proposal_generator_v1.sql:97` |
| `proposal_pdf_authorized_read` | `supabase/migrations/20260827_004_proposal_generator_v1.sql:98` |
| `proposal_storage_read` | `supabase/migrations/20260827_004_proposal_generator_v1.sql:163` |
| `proposal_storage_service` | `supabase/migrations/20260827_004_proposal_generator_v1.sql:164` |
| `work_tasks_participant_select` | `supabase/migrations/20260827_012_my_work_mvp.sql:32` |
| `work_task_preferences_self_select` | `supabase/migrations/20260828_013_my_work_enrichment.sql:14` |
| `work_task_attachments_participant_select` | `supabase/migrations/20260831_015_my_work_task_attachments.sql:37` |
| `work_task_attachments_participant_insert` | `supabase/migrations/20260831_015_my_work_task_attachments.sql:46` |
| `work_task_attachments_authorized_delete` | `supabase/migrations/20260831_015_my_work_task_attachments.sql:56` |
| `my_work_attachment_object_select` | `supabase/migrations/20260831_015_my_work_task_attachments.sql:71` |
| `my_work_attachment_object_insert` | `supabase/migrations/20260831_015_my_work_task_attachments.sql:81` |
| `my_work_attachment_object_delete` | `supabase/migrations/20260831_015_my_work_task_attachments.sql:91` |
| `my_work_messages_participant_select` | `supabase/migrations/20260831_016_my_work_inbox.sql:19` |
| `my_work_messages_participant_select` | `supabase/migrations/20260831_017_my_work_inbox_attachments.sql:8` |
| `my_work_message_attachments_participant_select` | `supabase/migrations/20260831_017_my_work_inbox_attachments.sql:28` |
| `my_work_message_attachments_sender_insert` | `supabase/migrations/20260831_017_my_work_inbox_attachments.sql:33` |
| `my_work_message_attachments_draft_delete` | `supabase/migrations/20260831_017_my_work_inbox_attachments.sql:37` |
| `my_work_inbox_attachment_object_select` | `supabase/migrations/20260831_017_my_work_inbox_attachments.sql:48` |
| `my_work_inbox_attachment_object_insert` | `supabase/migrations/20260831_017_my_work_inbox_attachments.sql:53` |
| `my_work_inbox_attachment_object_delete` | `supabase/migrations/20260831_017_my_work_inbox_attachments.sql:57` |
| `my_work_typing_participant_receive` | `supabase/migrations/20260831_019_private_my_work_typing_broadcast.sql:45` |
| `my_work_typing_participant_publish` | `supabase/migrations/20260831_019_private_my_work_typing_broadcast.sql:54` |
| `my_work_message_versions_participant_select` | `supabase/migrations/20260831_020_my_work_lifecycle_admin_cleanup.sql:21` |
| `my_work_inbox_attachment_object_admin_delete` | `supabase/migrations/20260831_020_my_work_lifecycle_admin_cleanup.sql:201` |
| `my_work_task_attachment_object_admin_delete` | `supabase/migrations/20260831_020_my_work_lifecycle_admin_cleanup.sql:206` |
| `bids_operational_select` | `supabase/migrations/20260901_001_preproduction_bids.sql:37` |
| `bid_activity_operational_select` | `supabase/migrations/20260901_001_preproduction_bids.sql:39` |
| `bid_updates_operational_select` | `supabase/migrations/20260901_002_bid_operational_context.sql:43` |
| `canonical_files_operational_select` | `supabase/migrations/20260901_003_bid_files.sql:45` |
| `bid_file_relationships_operational_select` | `supabase/migrations/20260901_003_bid_files.sql:49` |
| `bid_file_object_select` | `supabase/migrations/20260901_003_bid_files.sql:60` |
| `bid_file_object_insert` | `supabase/migrations/20260901_003_bid_files.sql:71` |
| `bid_file_object_delete` | `supabase/migrations/20260901_003_bid_files.sql:83` |
| `samples_operational_select` | `supabase/migrations/20260901_005_sample_color_plate_generator.sql:84` |
| `sample_blend_rows_operational_select` | `supabase/migrations/20260901_005_sample_color_plate_generator.sql:85` |
| `sample_issued_documents_operational_select` | `supabase/migrations/20260901_005_sample_color_plate_generator.sql:86` |
| `sample_document_storage_read` | `supabase/migrations/20260901_005_sample_color_plate_generator.sql:183` |
| `sample_document_storage_service` | `supabase/migrations/20260901_005_sample_color_plate_generator.sql:184` |
| `bid_proposal_relationships_authorized_all` | `supabase/migrations/20260902_002_bid_proposal_relationships.sql:17` |
| `proposal_estimating_defaults_authorized_read` | `supabase/migrations/20260908_004_proposal_generator_v2.sql:1173` |
| `proposal_estimates_authorized_read` | `supabase/migrations/20260908_004_proposal_generator_v2.sql:1176` |
| `sample_formulation_defaults_operational_select` | `supabase/migrations/20260917_001_sample_formulation_foundation.sql:23` |
| `sample_working_versions_operational_select` | `supabase/migrations/20260917_001_sample_formulation_foundation.sql:40` |
| `sample_formulation_profiles_operational_select` | `supabase/migrations/20260918_003_sample_formula_volumetric_profiles.sql:25` |
| `manpower_product_categories_read` | `supabase/migrations/20260921_001_manpower_product_categories.sql:54` |
| `manpower_product_categories_insert` | `supabase/migrations/20260921_001_manpower_product_categories.sql:56` |
| `manpower_product_categories_update` | `supabase/migrations/20260921_001_manpower_product_categories.sql:58` |
| `sample_operational_profiles_read` | `supabase/migrations/20260923160000_sample_operational_profiles.sql:25` |
| `po_allocations_read` | `supabase/migrations/20260923160100_po_reservation_allocations.sql:28` |
| `receipt_batches_read` | `supabase/migrations/20260923160200_partial_pending_receipts.sql:36` |
| `intake_early_access` | `supabase/migrations/20260923215900_intake_early_access.sql:12` |
| `intake_early_access` | `supabase/migrations/20260923215900_intake_early_access.sql:13` |
| `intake_early_access` | `supabase/migrations/20260923215900_intake_early_access.sql:14` |
| `intake_early_access` | `supabase/migrations/20260923215900_intake_early_access.sql:15` |
| `intake_early_access` | `supabase/migrations/20260923215900_intake_early_access.sql:16` |
| `intake_file_early_access` | `supabase/migrations/20260923215900_intake_early_access.sql:17` |
| `intake_file_early_access` | `supabase/migrations/20260923215900_intake_early_access.sql:20` |
| `intake_view` | `supabase/migrations/20260924180000_intake_view_access.sql:15` |
| `intake_manage_insert` | `supabase/migrations/20260924180000_intake_view_access.sql:17` |
| `intake_manage_update` | `supabase/migrations/20260924180000_intake_view_access.sql:19` |
| `intake_manage_delete` | `supabase/migrations/20260924180000_intake_view_access.sql:21` |
| `intake_view` | `supabase/migrations/20260924180000_intake_view_access.sql:27` |
| `intake_manage_insert` | `supabase/migrations/20260924180000_intake_view_access.sql:29` |
| `intake_manage_update` | `supabase/migrations/20260924180000_intake_view_access.sql:31` |
| `intake_manage_delete` | `supabase/migrations/20260924180000_intake_view_access.sql:33` |
| `intake_view` | `supabase/migrations/20260924180000_intake_view_access.sql:39` |
| `intake_manage_insert` | `supabase/migrations/20260924180000_intake_view_access.sql:41` |
| `intake_manage_update` | `supabase/migrations/20260924180000_intake_view_access.sql:43` |
| `intake_manage_delete` | `supabase/migrations/20260924180000_intake_view_access.sql:45` |
| `intake_view` | `supabase/migrations/20260924180000_intake_view_access.sql:51` |
| `intake_manage_insert` | `supabase/migrations/20260924180000_intake_view_access.sql:53` |
| `intake_manage_update` | `supabase/migrations/20260924180000_intake_view_access.sql:55` |
| `intake_manage_delete` | `supabase/migrations/20260924180000_intake_view_access.sql:57` |
| `intake_view` | `supabase/migrations/20260924180000_intake_view_access.sql:63` |
| `intake_manage_insert` | `supabase/migrations/20260924180000_intake_view_access.sql:65` |
| `intake_manage_update` | `supabase/migrations/20260924180000_intake_view_access.sql:67` |
| `intake_manage_delete` | `supabase/migrations/20260924180000_intake_view_access.sql:69` |
| `intake_view` | `supabase/migrations/20260924180000_intake_view_access.sql:75` |
| `intake_manage_insert` | `supabase/migrations/20260924180000_intake_view_access.sql:77` |
| `intake_manage_update` | `supabase/migrations/20260924180000_intake_view_access.sql:79` |
| `intake_manage_delete` | `supabase/migrations/20260924180000_intake_view_access.sql:81` |
| `intake_view` | `supabase/migrations/20260924180000_intake_view_access.sql:87` |
| `intake_manage_insert` | `supabase/migrations/20260924180000_intake_view_access.sql:89` |
| `intake_manage_update` | `supabase/migrations/20260924180000_intake_view_access.sql:91` |
| `intake_manage_delete` | `supabase/migrations/20260924180000_intake_view_access.sql:93` |
| `training_read` | `supabase/migrations/20260924190000_intake_personal_training.sql:19` |
| `my_work_inbox_attachment_object_insert` | `supabase/migrations/20260925120000_messaging_large_attachments.sql:81` |
| `messaging_preview_participant_select` | `supabase/migrations/20260925200000_messaging_v11.sql:47` |
| `my_work_inbox_attachment_object_insert` | `supabase/migrations/20260925200000_messaging_v11.sql:75` |
| `tenops_business_write_` | `supabase/migrations/20261005120000_read_only_messaging_write.sql:87` |
| `tenops_storage_write_insert` | `supabase/migrations/20261005120000_read_only_messaging_write.sql:179` |
| `tenops_storage_write_update` | `supabase/migrations/20261005120000_read_only_messaging_write.sql:181` |
| `tenops_storage_write_delete` | `supabase/migrations/20261005120000_read_only_messaging_write.sql:184` |
| `tenops_messaging_publish` | `supabase/migrations/20261005120000_read_only_messaging_write.sql:187` |
| `production_blend_admin_read` | `supabase/migrations/20261005150000_production_blend_plans.sql:22` |
| `production_blend_authorized_read` | `supabase/migrations/20261005170000_production_blend_capability.sql:54` |
| `production_companies_read` | `supabase/migrations/20261014190000_production_contact_configuration.sql:52` |
| `production_contacts_read` | `supabase/migrations/20261014190000_production_contact_configuration.sql:53` |
| `project_contact_read` | `supabase/migrations/20261014220000_protected_job_contacts.sql:21` |
| `project_contact_insert` | `supabase/migrations/20261014220000_protected_job_contacts.sql:22` |
| `project_contact_update` | `supabase/migrations/20261014220000_protected_job_contacts.sql:23` |
| `project_contact_delete` | `supabase/migrations/20261014220000_protected_job_contacts.sql:24` |
| `job_updates_post_permission` | `supabase/migrations/20261015170000_sample_job_update_publishing.sql:7` |
| `sample_update_upload` | `supabase/migrations/20261015170000_sample_job_update_publishing.sql:29` |
| `sample_update_immutable` | `supabase/migrations/20261015170000_sample_job_update_publishing.sql:31` |
| `sample_update_metadata_insert` | `supabase/migrations/20261015170000_sample_job_update_publishing.sql:34` |
| `sample_update_metadata_immutable` | `supabase/migrations/20261015170000_sample_job_update_publishing.sql:36` |

## references

| Name | Source |
|---|---|
| `public.jobs` | `supabase/migrations/20260713_002_production_mvp_jobs.sql:182` |
| `public.jobs` | `supabase/migrations/20260713_003_job_attachments.sql:5` |
| `public.manpower_workers` | `supabase/migrations/20260714_001_manpower_reporting_mvp.sql:38` |
| `public.manpower_tasks` | `supabase/migrations/20260714_001_manpower_reporting_mvp.sql:39` |
| `public.jobs` | `supabase/migrations/20260714_001_manpower_reporting_mvp.sql:40` |
| `public.manpower_reporting_groups` | `supabase/migrations/20260714_002_manpower_reporting_groups_and_import_correction.sql:21` |
| `public.jobs` | `supabase/migrations/20260714_005_inventory_production_job_reservations.sql:70` |
| `public.jobs` | `supabase/migrations/20260714_005_inventory_production_job_reservations.sql:74` |
| `public.jobs` | `supabase/migrations/20260714_005_inventory_production_job_reservations.sql:78` |
| `public.jobs` | `supabase/migrations/20260720_001_material_usage_reporting.sql:12` |
| `public.jobs` | `supabase/migrations/20260720_001_material_usage_reporting.sql:27` |
| `public.jobs` | `supabase/migrations/20260720_001_material_usage_reporting.sql:91` |
| `public.material_usage_reports` | `supabase/migrations/20260720_001_material_usage_reporting.sql:98` |
| `public.material_usage_reports` | `supabase/migrations/20260720_001_material_usage_reporting.sql:114` |
| `public.material_usage_reports` | `supabase/migrations/20260720_001_material_usage_reporting.sql:170` |
| `public.pending_receivals` | `supabase/migrations/20260722_001_pending_receival_undo.sql:4` |
| `public.inventory_items` | `supabase/migrations/20260722_001_pending_receival_undo.sql:5` |
| `public.inventory_transactions` | `supabase/migrations/20260722_001_pending_receival_undo.sql:6` |
| `public.inventory_items` | `supabase/migrations/20260722_001_pending_receival_undo.sql:11` |
| `public.inventory_transactions` | `supabase/migrations/20260722_001_pending_receival_undo.sql:12` |
| `public.vendors` | `supabase/migrations/20260722_002_purchasing_phase1.sql:25` |
| `public.purchase_orders` | `supabase/migrations/20260722_002_purchasing_phase1.sql:41` |
| `public.purchase_orders` | `supabase/migrations/20260722_002_purchasing_phase1.sql:66` |
| `public.purchase_order_lines` | `supabase/migrations/20260722_002_purchasing_phase1.sql:77` |
| `public.jobs` | `supabase/migrations/20260722_002_purchasing_phase1.sql:78` |
| `public.jobs` | `supabase/migrations/20260722_003_purchasing_phase1_1_simplification.sql:4` |
| `public.vendors` | `supabase/migrations/20260722_005_purchasing_vendor_configuration.sql:19` |
| `public.vendors` | `supabase/migrations/20260722_005_purchasing_vendor_configuration.sql:44` |
| `public.purchase_orders` | `supabase/migrations/20260723_001_purchase_order_issuance.sql:25` |
| `directly` | `supabase/migrations/20260723_003_purchase_order_issuance_column_resolution.sql:5` |
| `public.purchase_order_issuances` | `supabase/migrations/20260723_004_purchase_order_pdf_documents.sql:5` |
| `public.purchase_order_issuances` | `supabase/migrations/20260723_008_purchase_order_pending_receivals.sql:16` |
| `public.purchase_order_lines` | `supabase/migrations/20260723_008_purchase_order_pending_receivals.sql:18` |
| `public.jobs` | `supabase/migrations/20260727_001_production_job_updates.sql:5` |
| `public.job_updates` | `supabase/migrations/20260727_001_production_job_updates.sql:51` |
| `public.jobs` | `supabase/migrations/20260728_001_job_transmittals.sql:13` |
| `public.jobs` | `supabase/migrations/20260728_002_job_transmittal_hardening.sql:59` |
| `public.jobs` | `supabase/migrations/20260731_001_whiteboard_mvp.sql:5` |
| `public.whiteboard_cards` | `supabase/migrations/20260731_001_whiteboard_mvp.sql:15` |
| `public.planning_phases` | `supabase/migrations/20260731_003_planning_phases_items.sql:63` |
| `public.planning_phase_library` | `supabase/migrations/20260731_003_planning_phases_items.sql:82` |
| `public.planning_phase_library` | `supabase/migrations/20260803_001_planning_library_colors_and_phase_cap.sql:39` |
| `public.jobs` | `supabase/migrations/20260817_003_production_rework_cycles.sql:9` |
| `auth.users` | `supabase/migrations/20260818_001_rbac_identity_infrastructure.sql:7` |
| `auth.users` | `supabase/migrations/20260818_001_rbac_identity_infrastructure.sql:11` |
| `auth.users` | `supabase/migrations/20260818_001_rbac_identity_infrastructure.sql:12` |
| `auth.users` | `supabase/migrations/20260818_001_rbac_identity_infrastructure.sql:167` |
| `auth.users` | `supabase/migrations/20260818_001_rbac_identity_infrastructure.sql:168` |
| `auth.users` | `supabase/migrations/20260818_001_rbac_identity_infrastructure.sql:169` |
| `auth.users` | `supabase/migrations/20260818_001_rbac_identity_infrastructure.sql:170` |
| `auth.users` | `supabase/migrations/20260818_001_rbac_identity_infrastructure.sql:171` |
| `auth.users` | `supabase/migrations/20260818_001_rbac_identity_infrastructure.sql:172` |
| `and` | `supabase/migrations/20260818_004_final_compatibility_support.sql:1` |
| `public.app_users` | `supabase/migrations/20260818_004_final_compatibility_support.sql:126` |
| `public.job_updates` | `supabase/migrations/20260819_001_job_update_account_collaboration.sql:7` |
| `public.app_users` | `supabase/migrations/20260819_001_job_update_account_collaboration.sql:8` |
| `public.app_users` | `supabase/migrations/20260821_002_friday_welcome_and_job_update_seen.sql:21` |
| `public.jobs` | `supabase/migrations/20260821_002_friday_welcome_and_job_update_seen.sql:22` |
| `jsonb` | `supabase/migrations/20260821_002_friday_welcome_and_job_update_seen.sql:118` |
| `is` | `supabase/migrations/20260821_002_friday_welcome_and_job_update_seen.sql:129` |
| `public.app_users` | `supabase/migrations/20260821_002_friday_welcome_and_job_update_seen.sql:184` |
| `jsonb` | `supabase/migrations/20260821_002_friday_welcome_and_job_update_seen.sql:185` |
| `is` | `supabase/migrations/20260821_002_friday_welcome_and_job_update_seen.sql:191` |
| `owned` | `supabase/migrations/20260821_002_friday_welcome_and_job_update_seen.sql:192` |
| `for` | `supabase/migrations/20260821_002_friday_welcome_and_job_update_seen.sql:196` |
| `enable` | `supabase/migrations/20260821_002_friday_welcome_and_job_update_seen.sql:199` |
| `for` | `supabase/migrations/20260821_002_friday_welcome_and_job_update_seen.sql:201` |
| `from` | `supabase/migrations/20260821_002_friday_welcome_and_job_update_seen.sql:206` |
| `to` | `supabase/migrations/20260821_002_friday_welcome_and_job_update_seen.sql:207` |
| `jsonb` | `supabase/migrations/20260821_002_friday_welcome_and_job_update_seen.sql:215` |
| `into` | `supabase/migrations/20260821_002_friday_welcome_and_job_update_seen.sql:221` |
| `from` | `supabase/migrations/20260821_002_friday_welcome_and_job_update_seen.sql:221` |
| `where` | `supabase/migrations/20260821_002_friday_welcome_and_job_update_seen.sql:222` |
| `jsonb` | `supabase/migrations/20260821_002_friday_welcome_and_job_update_seen.sql:234` |
| `returning` | `supabase/migrations/20260821_002_friday_welcome_and_job_update_seen.sql:251` |
| `into` | `supabase/migrations/20260821_002_friday_welcome_and_job_update_seen.sql:252` |
| `public.production_rework_cycles` | `supabase/migrations/20260824_002_manpower_rework_attribution.sql:14` |
| `public.app_users` | `supabase/migrations/20260827_004_proposal_generator_v1.sql:5` |
| `public.app_users` | `supabase/migrations/20260827_004_proposal_generator_v1.sql:7` |
| `public.jobs` | `supabase/migrations/20260827_004_proposal_generator_v1.sql:26` |
| `public.proposals` | `supabase/migrations/20260827_004_proposal_generator_v1.sql:28` |
| `public.app_users` | `supabase/migrations/20260827_004_proposal_generator_v1.sql:42` |
| `public.app_users` | `supabase/migrations/20260827_004_proposal_generator_v1.sql:43` |
| `public.proposals` | `supabase/migrations/20260827_004_proposal_generator_v1.sql:48` |
| `public.proposals` | `supabase/migrations/20260827_004_proposal_generator_v1.sql:57` |
| `public.job_attachments` | `supabase/migrations/20260827_004_proposal_generator_v1.sql:58` |
| `public.app_users` | `supabase/migrations/20260827_004_proposal_generator_v1.sql:60` |
| `public.proposals` | `supabase/migrations/20260827_004_proposal_generator_v1.sql:64` |
| `public.app_users` | `supabase/migrations/20260827_012_my_work_mvp.sql:7` |
| `public.app_users` | `supabase/migrations/20260827_012_my_work_mvp.sql:8` |
| `public.work_tasks` | `supabase/migrations/20260828_013_my_work_enrichment.sql:6` |
| `public.app_users` | `supabase/migrations/20260828_013_my_work_enrichment.sql:7` |
| `enable` | `supabase/migrations/20260828_013_my_work_enrichment.sql:13` |
| `for` | `supabase/migrations/20260828_013_my_work_enrichment.sql:14` |
| `from` | `supabase/migrations/20260828_013_my_work_enrichment.sql:20` |
| `to` | `supabase/migrations/20260828_013_my_work_enrichment.sql:21` |
| `to` | `supabase/migrations/20260828_013_my_work_enrichment.sql:22` |
| `preference` | `supabase/migrations/20260828_013_my_work_enrichment.sql:33` |
| `is` | `supabase/migrations/20260828_013_my_work_enrichment.sql:116` |
| `for` | `supabase/migrations/20260828_013_my_work_enrichment.sql:116` |
| `public.work_tasks` | `supabase/migrations/20260831_015_my_work_task_attachments.sql:24` |
| `public.app_users` | `supabase/migrations/20260831_015_my_work_task_attachments.sql:25` |
| `public.app_users` | `supabase/migrations/20260831_016_my_work_inbox.sql:5` |
| `public.app_users` | `supabase/migrations/20260831_016_my_work_inbox.sql:6` |
| `public.jobs` | `supabase/migrations/20260831_016_my_work_inbox.sql:8` |
| `public.my_work_messages` | `supabase/migrations/20260831_017_my_work_inbox_attachments.sql:16` |
| `public.app_users` | `supabase/migrations/20260831_017_my_work_inbox_attachments.sql:17` |
| `public.my_work_messages` | `supabase/migrations/20260831_020_my_work_lifecycle_admin_cleanup.sql:11` |
| `public.app_users` | `supabase/migrations/20260831_020_my_work_lifecycle_admin_cleanup.sql:14` |
| `where` | `supabase/migrations/20260831_020_my_work_lifecycle_admin_cleanup.sql:186` |
| `preference` | `supabase/migrations/20260831_021_my_work_task_estimated_time.sql:20` |
| `public.app_users` | `supabase/migrations/20260901_001_preproduction_bids.sql:9` |
| `public.app_users` | `supabase/migrations/20260901_001_preproduction_bids.sql:10` |
| `public.bids` | `supabase/migrations/20260901_001_preproduction_bids.sql:22` |
| `public.app_users` | `supabase/migrations/20260901_001_preproduction_bids.sql:24` |
| `public.bids` | `supabase/migrations/20260901_002_bid_operational_context.sql:34` |
| `public.app_users` | `supabase/migrations/20260901_002_bid_operational_context.sql:35` |
| `public.app_users` | `supabase/migrations/20260901_003_bid_files.sql:20` |
| `public.bids` | `supabase/migrations/20260901_003_bid_files.sql:31` |
| `public.canonical_files` | `supabase/migrations/20260901_003_bid_files.sql:32` |
| `public.app_users` | `supabase/migrations/20260901_004_admin_canonical_cleanup.sql:9` |
| `public.bids` | `supabase/migrations/20260901_005_sample_color_plate_generator.sql:7` |
| `public.jobs` | `supabase/migrations/20260901_005_sample_color_plate_generator.sql:8` |
| `public.app_users` | `supabase/migrations/20260901_005_sample_color_plate_generator.sql:25` |
| `public.samples` | `supabase/migrations/20260901_005_sample_color_plate_generator.sql:34` |
| `public.samples` | `supabase/migrations/20260901_005_sample_color_plate_generator.sql:52` |
| `public.app_users` | `supabase/migrations/20260901_005_sample_color_plate_generator.sql:55` |
| `public.bids` | `supabase/migrations/20260902_002_bid_proposal_relationships.sql:6` |
| `public.proposals` | `supabase/migrations/20260902_002_bid_proposal_relationships.sql:7` |
| `public.app_users` | `supabase/migrations/20260902_002_bid_proposal_relationships.sql:8` |
| `public.app_users` | `supabase/migrations/20260902_004_my_work_task_groups.sql:6` |
| `public.work_tasks` | `supabase/migrations/20260902_004_my_work_task_groups.sql:16` |
| `public.app_users` | `supabase/migrations/20260902_004_my_work_task_groups.sql:17` |
| `public.my_work_task_groups` | `supabase/migrations/20260902_004_my_work_task_groups.sql:18` |
| `public.app_users` | `supabase/migrations/20260902_005_sample_recent_value_suggestions.sql:5` |
| `public.proposal_estimating_default_versions` | `supabase/migrations/20260908_004_proposal_generator_v2.sql:11` |
| `public.app_users` | `supabase/migrations/20260908_004_proposal_generator_v2.sql:13` |
| `public.proposals` | `supabase/migrations/20260908_004_proposal_generator_v2.sql:19` |
| `public.proposal_estimating_default_versions` | `supabase/migrations/20260908_004_proposal_generator_v2.sql:20` |
| `public.app_users` | `supabase/migrations/20260908_004_proposal_generator_v2.sql:27` |
| `public.app_users` | `supabase/migrations/20260908_004_proposal_generator_v2.sql:28` |
| `public.app_users` | `supabase/migrations/20260917_001_sample_formulation_foundation.sql:16` |
| `public.samples` | `supabase/migrations/20260917_001_sample_formulation_foundation.sql:27` |
| `public.app_users` | `supabase/migrations/20260917_001_sample_formulation_foundation.sql:31` |
| `public.app_users` | `supabase/migrations/20260921_001_manpower_product_categories.sql:14` |
| `public.app_users` | `supabase/migrations/20260921_001_manpower_product_categories.sql:15` |
| `public.manpower_product_categories` | `supabase/migrations/20260921_001_manpower_product_categories.sql:63` |
| `survive` | `supabase/migrations/20260921_001_manpower_product_categories.sql:74` |
| `public.app_users` | `supabase/migrations/20260923160000_sample_operational_profiles.sql:16` |
| `public.purchase_order_lines` | `supabase/migrations/20260923160100_po_reservation_allocations.sql:19` |
| `public.jobs` | `supabase/migrations/20260923160100_po_reservation_allocations.sql:20` |
| `public.pending_receivals` | `supabase/migrations/20260923160200_partial_pending_receipts.sql:22` |
| `public.inventory_transactions` | `supabase/migrations/20260923160200_partial_pending_receipts.sql:25` |
| `public.app_users` | `supabase/migrations/20260923160200_partial_pending_receipts.sql:26` |
| `public.app_users` | `supabase/migrations/20260923220000_intake_projected_planning.sql:7` |
| `public.jobs` | `supabase/migrations/20260923220000_intake_projected_planning.sql:9` |
| `public.app_users` | `supabase/migrations/20260923220000_intake_projected_planning.sql:10` |
| `public.app_users` | `supabase/migrations/20260924190000_intake_personal_training.sql:5` |
| `public.app_users` | `supabase/migrations/20260924190000_intake_personal_training.sql:10` |
| `public.bids` | `supabase/migrations/20260924190000_intake_personal_training.sql:11` |
| `public.jobs` | `supabase/migrations/20260924190000_intake_personal_training.sql:12` |
| `jsonb` | `supabase/migrations/20260924200000_manpower_analytics_preference.sql:26` |
| `is` | `supabase/migrations/20260924200000_manpower_analytics_preference.sql:37` |
| `survive` | `supabase/migrations/20260924210000_manpower_anonymous_access.sql:45` |
| `jobs` | `supabase/migrations/20260924210000_manpower_anonymous_access.sql:45` |
| `manpower_product_categories` | `supabase/migrations/20260924210000_manpower_anonymous_access.sql:45` |
| `manpower_reporting_groups` | `supabase/migrations/20260924210000_manpower_anonymous_access.sql:45` |
| `production_rework_cycles` | `supabase/migrations/20260924210000_manpower_anonymous_access.sql:45` |
| `manpower_tasks` | `supabase/migrations/20260924210000_manpower_anonymous_access.sql:45` |
| `manpower_workers` | `supabase/migrations/20260924210000_manpower_anonymous_access.sql:45` |
| `auth.users` | `supabase/migrations/20260924210100_production_rework_anonymous_access.sql:45` |
| `auth.users` | `supabase/migrations/20260924210100_production_rework_anonymous_access.sql:45` |
| `jobs` | `supabase/migrations/20260924210100_production_rework_anonymous_access.sql:45` |
| `app_users` | `supabase/migrations/20260925180000_intake_early_access_editing.sql:17` |
| `bids` | `supabase/migrations/20260925180000_intake_early_access_editing.sql:17` |
| `bids` | `supabase/migrations/20260925180000_intake_early_access_editing.sql:17` |
| `canonical_files` | `supabase/migrations/20260925180000_intake_early_access_editing.sql:17` |
| `bids` | `supabase/migrations/20260925180000_intake_early_access_editing.sql:17` |
| `app_users` | `supabase/migrations/20260925180000_intake_early_access_editing.sql:17` |
| `proposals` | `supabase/migrations/20260925180000_intake_early_access_editing.sql:17` |
| `app_users` | `supabase/migrations/20260925180000_intake_early_access_editing.sql:17` |
| `bids` | `supabase/migrations/20260925180000_intake_early_access_editing.sql:17` |
| `app_users` | `supabase/migrations/20260925180000_intake_early_access_editing.sql:17` |
| `app_users` | `supabase/migrations/20260925180000_intake_early_access_editing.sql:17` |
| `app_users` | `supabase/migrations/20260925180000_intake_early_access_editing.sql:17` |
| `jobs` | `supabase/migrations/20260925180000_intake_early_access_editing.sql:17` |
| `app_users` | `supabase/migrations/20260925180000_intake_early_access_editing.sql:17` |
| `app_users` | `supabase/migrations/20260925180000_intake_early_access_editing.sql:17` |
| `app_users` | `supabase/migrations/20260925180000_intake_early_access_editing.sql:17` |
| `bids` | `supabase/migrations/20260925180000_intake_early_access_editing.sql:17` |
| `jobs` | `supabase/migrations/20260925180000_intake_early_access_editing.sql:17` |
| `app_users` | `supabase/migrations/20260925180000_intake_early_access_editing.sql:17` |
| `public.my_work_message_attachments` | `supabase/migrations/20260925200000_messaging_v11.sql:36` |
| `public.my_work_messages` | `supabase/migrations/20260925200000_messaging_v11.sql:37` |
| `public.production_companies` | `supabase/migrations/20261014190000_production_contact_configuration.sql:15` |
| `public.production_companies` | `supabase/migrations/20261014190000_production_contact_configuration.sql:30` |
| `public.production_contacts` | `supabase/migrations/20261014190000_production_contact_configuration.sql:34` |
| `public.production_contacts` | `supabase/migrations/20261014210000_production_customer_list.sql:8` |
| `public.jobs` | `supabase/migrations/20261014220000_protected_job_contacts.sql:7` |
| `public.production_companies` | `supabase/migrations/20261014220000_protected_job_contacts.sql:8` |
| `public.production_contacts` | `supabase/migrations/20261014220000_protected_job_contacts.sql:12` |
| `public.app_users` | `supabase/migrations/20261015230000_rich_release_communications.sql:6` |
