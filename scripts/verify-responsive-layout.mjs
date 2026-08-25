import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const styles = read('src/app/globals.css');
const workspace = read('src/modules/production/ProductionWorkspace.tsx');
const productionTag = read('src/modules/production/components/production-tag.ts');
const queue = read('src/modules/production/components/ProductionQueue.tsx');
const table = read('src/modules/production/components/ProductionTable.tsx');
const reworkBadge = read('src/modules/production/components/ReworkBadge.tsx');

assert.match(styles, /html \{[\s\S]*font-size: 16px;/,
  'Native readability must keep a fixed root instead of implementing page zoom');
assert.doesNotMatch(styles, /zoom:\s*1\.25|transform:\s*scale\(1\.25\)|--tenops-root-font-size/);
assert.match(styles, /--tenops-type-label:/);
assert.match(styles, /--tenops-type-caption:/);
assert.match(styles, /--tenops-type-small:/);
assert.match(styles, /html\[data-display-size="large"\] \{[\s\S]*--tenops-type-label: 14px;[\s\S]*--tenops-type-caption: 16px;[\s\S]*--tenops-type-small: 18px;/,
  'Large must increase actual glyph size meaningfully above the native default');
assert.doesNotMatch(styles, /data-display-size="large"[\s\S]{0,500}(letter-spacing|word-spacing|transform:)/,
  'Display size must not simulate larger text through tracking or transforms');
assert.match(styles, /body \.text-\\\[12px\\\][\s\S]{0,100}var\(--tenops-type-caption\)/,
  'Header navigation typography must participate in the user display-size preference');
assert.match(styles, /\[data-welcome-hero\],[\s\S]{0,80}\[data-welcome-hero-cover\][\s\S]{0,240}--tenops-type-label: 14px;[\s\S]{0,120}--tenops-type-body: 20px;/,
  'Both viewport-composed Welcome surfaces must use fixed Large typography independent of account readability sizing');
assert.match(styles, /--tenops-type-compact-tag: 10px;/,
  'Fixed-density operational tags must have a semantic type token independent of readability scaling');
assert.match(styles, /\.tenops-compact-type \{[\s\S]*font-size: var\(--tenops-type-compact-tag\) !important;/,
  'Compact tag typography must opt into the semantic fixed-density token');
assert.match(productionTag, /tenops-compact-type/,
  'The canonical Production tag shell must consume compact tag typography');
assert.match(queue, /productionTagClassName[\s\S]{0,1800}No Material Use Linked/,
  'Overview material-use actions must reuse the canonical compact tag shell');
assert.match(table, /productionTagClassName[\s\S]{0,2200}No Material Use Linked/,
  'Table material-use actions must remain compact under native readability scaling');
assert.match(reworkBadge, /productionTagClassName/,
  'Rework labels must reuse the canonical compact tag shell');

assert.match(workspace, /data-production-toolbar[\s\S]{0,300}lg:flex-wrap/,
  'The Production toolbar must intentionally reflow before controls overflow');
assert.match(workspace, /data-production-search[\s\S]{0,500}lg:min-w-64[\s\S]{0,100}lg:flex-\[1_1_20rem\]/,
  'Production Search must retain a meaningful desktop width and flex priority');
assert.match(workspace, /data-production-refresh[\s\S]{0,500}shrink-0/,
  'Refresh must remain contained and must never collapse');

console.log('TenOps responsive layout checks passed.');
