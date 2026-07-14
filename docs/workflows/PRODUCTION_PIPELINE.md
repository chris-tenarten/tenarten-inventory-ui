# Production Pipeline

## Purpose

Provide the primary operational view of jobs that matter to the shop.

The pipeline begins when work becomes an operational commitment. It does not include every bid or estimate.

## Entry boundary

A record may enter the pipeline after:

- award
- approval to proceed
- deposit
- operational handoff

It may still lack:

- job number
- work-order number
- color plate
- planned dates
- complete material details

## Creation rules

Project name is the only required field.

All other values may be added later.

## Views

### Table

Primary data-entry and management view.

Expected behavior:

- inline editing
- save on blur
- Add Job at bottom
- compact filters
- compact search
- dense columns
- visible save/error feedback

### Timeline

Alternate scheduling visualization of the same records.

Display states:

- scheduled range
- delivery milestone
- unscheduled

## Terminology

Use:

- Production Pipeline
- Jobs in Queue
- Unscheduled
- Table
- Timeline
- Add Job

Avoid:

- Active Records
- Production Record
- Gantt, unless used internally in code

## Job-centered expansion

The table and Timeline should eventually open a unified Job Workspace containing:

- Overview
- Production
- Schedule
- Materials
- Labor
- Daily Production
- Attachments
- Forms
- Notes
- Activity
- QC
- Shipping
- Purchasing
