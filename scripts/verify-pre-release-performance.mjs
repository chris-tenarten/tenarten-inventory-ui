import assert from 'node:assert/strict';
import fs from 'node:fs';

const bid=fs.readFileSync('src/modules/pre-production/BidWorkspace.tsx','utf8');
const sample=fs.readFileSync('src/modules/samples/SampleWorkspace.tsx','utf8');
const work=fs.readFileSync('src/modules/my-work/MyWorkPage.tsx','utf8');
const workQueries=fs.readFileSync('src/modules/my-work/queries.ts','utf8');
const messaging=fs.readFileSync('src/components/GlobalMessaging.tsx','utf8');
const production=fs.readFileSync('src/modules/production/jobs.ts','utf8');
const shell=fs.readFileSync('src/app/client-layout-shell.tsx','utf8');

const openBid=bid.match(/async function openBid[\s\S]*?async function selectWorkspaceTab/)?.[0]??'';
assert.match(openBid,/loadBidActivity/);
assert.doesNotMatch(openBid,/loadBidUpdates|loadBidFiles/,'Bid opening must not fetch unopened tab data');
assert.match(bid,/tab==='updates'[\s\S]*loadBidUpdates/);
assert.match(bid,/tab==='files'[\s\S]*loadBidFiles/);
assert.doesNotMatch(bid,/\[selectedId\]\);/,'selecting a Bid must not recreate the list refresh callback');

assert.match(sample,/const nextSamples=await loadSamples\(\);setSamples\(nextSamples\)/);
assert.match(sample,/void Promise\.all\(\[loadBids\(\),loadProductionJobOptions\(\{includeArchived:true\}\),loadVendors\(\)\]\)/);
assert.doesNotMatch(sample,/Promise\.all\(\[loadSamples\(\),loadBids/,'Sample list readiness must not wait for editor options');

assert.match(work,/loadMyWorkOverview/);
assert.match(work,/attachmentCountsRef\.current=counts/);
assert.match(work,/attachmentCount:attachmentCountsRef\.current\.get\(task\.id\)\?\?0/);
assert.match(workQueries,/return\{groups,tasks:/);
const secondaryOptions=work.match(/Promise\.all\(\[loadWorkCollaborators\(\),loadWorkJobs\(\),refreshAttachmentCounts\(\)\]\)/);
assert.ok(secondaryOptions,'secondary My Work options should not duplicate Task Groups');

assert.match(messaging,/recentLoadedRef/);
assert.match(messaging,/recentRequestRef/);
assert.match(messaging,/awarenessVisibleRef/);
assert.match(shell,/<GlobalMessaging key=\{auth\.profile\?\.userId\?\?'signed-out'\} \/>/,'Messaging caches must remount when canonical identity changes');
assert.match(messaging,/loadRecent\(true\)/);
const realtimeEffect=messaging.match(/useEffect\(\(\)=>\{if\(!currentUserId\)return;const refresh=[\s\S]*?\},\[currentUserId,loadRecent,refreshUnread\]\);/)?.[0]??'';
assert.match(realtimeEffect,/global-messaging-badge:/);
assert.doesNotMatch(realtimeEffect,/menuOpen|sidebarOpen|recentLoading/,'global Realtime must not resubscribe for presentation/loading changes');

assert.match(production,/ACTIVE_REWORK_COLUMNS/);
assert.match(production,/not\('production_status', 'in', '\(complete,cancelled\)'\)/);
const productionListLoader=production.match(/export async function loadProductionJobs[\s\S]*?\n\}/)?.[0]??'';
assert.doesNotMatch(productionListLoader,/production_rework_cycles'\)\.select\('\*'\)/);

console.log('Pre-release performance structure checks passed.');
