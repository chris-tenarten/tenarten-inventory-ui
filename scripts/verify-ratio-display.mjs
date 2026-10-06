import assert from 'node:assert/strict';
import {displayRatioPart,displayRatio,displayProfileRatio} from '../supabase/functions/_shared/ratio-display.mjs';
for(const [input,expected] of [['5.0000','5'],['4.0000','4'],['4.5000','4.5'],['4.2500','4.25'],['4.2500000000000000000010','4.250000000000000000001']])assert.equal(displayRatioPart(input),expected);
assert.equal(displayRatio('5.0000','1.0000'),'5:1');
for(const name of ['MTT','Key Resin','Terroxy'])assert.equal(displayProfileRatio(`${name} — 5.0000:1`),`${name} — 5:1`);
assert.equal(displayProfileRatio('Sherwin — 4.0000:1'),'Sherwin — 4:1');
console.log('PASS shared display formatter trims trailing zeros without rounding or changing stored values.');
