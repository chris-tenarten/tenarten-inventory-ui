import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const migration=await readFile(new URL('../supabase/migrations/20260901_003_bid_files.sql',import.meta.url),'utf8');
const queries=await readFile(new URL('../src/modules/pre-production/queries.ts',import.meta.url),'utf8');
const workspace=await readFile(new URL('../src/modules/pre-production/BidWorkspace.tsx',import.meta.url),'utf8');
const types=await readFile(new URL('../src/modules/pre-production/types.ts',import.meta.url),'utf8');
const viewer=await readFile(new URL('../src/components/documents/DocumentViewer.tsx',import.meta.url),'utf8');

assert.match(migration,/insert into storage\.buckets[\s\S]*'bid-files','bid-files',false,26214400/);
assert.match(migration,/create table public\.canonical_files/);
assert.match(migration,/create table public\.bid_file_relationships/);
assert.match(migration,/primary key\(bid_id,file_id\)/);
assert.match(migration,/storage_path text not null unique/);
assert.match(migration,/references public\.bids\(id\) on delete restrict/);
assert.match(migration,/references public\.canonical_files\(id\) on delete restrict/);
assert.match(migration,/revoke all on public\.canonical_files,public\.bid_file_relationships from public,anon,authenticated/);
assert.doesNotMatch(migration,/grant (?:insert|update|delete|all) on public\.(?:canonical_files|bid_file_relationships)[^;]*authenticated/i);
assert.match(migration,/bid_file_object_select[\s\S]*has_app_capability\('readOperationalData'\)[\s\S]*actor\.is_active/);
assert.match(migration,/bid_file_object_insert[\s\S]*lifecycle_state='uploading'[\s\S]*uploader_user_id=auth\.uid\(\)/);
assert.match(migration,/bid_file_object_delete[\s\S]*relationship_state='removal_pending'/);
assert.match(migration,/begin_bid_file_upload[\s\S]*require_app_capability\('readOperationalData'\)/);
assert.match(migration,/finalize_bid_file_upload[\s\S]*storage\.objects[\s\S]*file_added/);
assert.match(migration,/abort_bid_file_upload[\s\S]*Uploaded bytes must be removed before aborting file metadata/);
assert.match(migration,/prepare_bid_file_removal[\s\S]*relationship_state='removal_pending'/);
assert.match(migration,/finalize_bid_file_removal[\s\S]*File bytes must be removed[\s\S]*file_removed/);
assert.match(migration,/cancel_bid_file_removal/);
assert.doesNotMatch(migration,/insert into public\.jobs|update public\.jobs|delete from public\.jobs|job_file|production_file/i);
assert.doesNotMatch(migration,/proposal|sample_form|tenops_files/i);

assert.match(types,/export type BidFile/);
for(const symbol of ['loadBidFiles','uploadBidFiles','openBidFile','removeBidFile'])assert.match(queries,new RegExp(`export async function ${symbol}`));
assert.match(queries,/begin_bid_file_upload[\s\S]*storage\.from\(BID_FILE_BUCKET\)\.upload[\s\S]*finalize_bid_file_upload/);
assert.match(queries,/removeBidFile[\s\S]*prepare_bid_file_removal[\s\S]*storage\.from\(BID_FILE_BUCKET\)\.remove[\s\S]*finalize_bid_file_removal/);
assert.match(workspace,/\['files',`Files/);
assert.match(workspace,/Take Photo/);
assert.match(workspace,/type="file" multiple/);
assert.match(workspace,/capture="environment"/);
assert.match(workspace,/file\.arrayBuffer\(\)/);
assert.match(viewer,/export const isDocumentPreviewSupported/);
assert.match(workspace,/import DocumentViewer,\{isDocumentPreviewSupported\}/);
assert.match(workspace,/isDocumentPreviewSupported\(file\.originalFilename,file\.contentType\)/);
assert.match(workspace,/if\(!isDocumentPreviewSupported[\s\S]*await openBidFile\(file\)/,'unsupported files must retain signed open/download behavior');
assert.match(workspace,/mode="embedded"[\s\S]*onOpenFullscreen/);
assert.match(workspace,/bid-file-fullscreen/);
assert.match(workspace,/Created \{formatCreatedDate\(draft\.createdAt\)\} by \{draft\.creatorName\}/);
assert.doesNotMatch(workspace,/Actual business date; prior dates are allowed\.|Created by <strong>/);

console.log('Bid Files verification passed.');
