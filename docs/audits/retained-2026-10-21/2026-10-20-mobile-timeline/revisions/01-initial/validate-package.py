from pathlib import Path
import json,re,hashlib,subprocess,zipfile
base=Path(__file__).resolve().parent
broken=[];links=0
for p in base.rglob('*.md'):
    assert all(line==line.rstrip() for line in p.read_text().splitlines()), str(p)
    for link in re.findall(r'\]\(([^)]+)\)',p.read_text()):
        if link.startswith(('http:','https:','#')): continue
        links+=1
        if not (p.parent/link.split('#')[0]).exists(): broken.append([str(p),link])
for p in (base/'evidence').glob('*.json'): json.loads(p.read_text())
checks={f:subprocess.run(['node','--check',str(base/f)],capture_output=True).returncode for f in ['serve.mjs','build.mjs','verify.cjs','verify-adapters.mjs','prototype/adapters.mjs','prototype/fixtures.mjs']}
meta=json.loads((base/'evidence/bundle-inputs.json').read_text())
forbidden=[p for k in ['mobileInputs','referenceInputs'] for p in meta[k] if any(t in p for t in ['@supabase','src/lib/auth','src/lib/supabase','src/modules/pre-production/planning-data','src/modules/production/jobs.ts'])]
patterns=['supabase.co','sb_secret_','sb_publishable_','-----BEGIN PRIVATE KEY-----']
hits=[str(p) for p in base.rglob('*') if p.is_file() and p.suffix in ['.js','.jsx','.mjs','.json','.md'] and any(t in p.read_text() for t in patterns)]
browser=json.loads((base/'evidence/browser.json').read_text());adapter=json.loads((base/'evidence/adapters.json').read_text())
repo=base.parents[2]
tracked=subprocess.check_output(['git','diff','--name-only','HEAD'],cwd=repo,text=True).strip()
diff=subprocess.run(['git','diff','--check'],cwd=repo,capture_output=True)
assert not broken and not any(checks.values()) and not forbidden and not hits and not tracked and diff.returncode==0
assert browser['result']=='PASS' and all(c['passed'] for c in browser['checks']) and adapter['result']=='PASS'
result={'date':'2026-10-20 America/Chicago','risk':'Tier 2 isolated prototype; focused behavior and helper validation, not application release gates','browser_groups_passed':len(browser['checks']),'adapter_groups_passed':len(adapter['checks']),'client_errors':browser['errors'],'unexpected_external_destinations':browser['blocked'],'screenshots':len(list((base/'screenshots').glob('*.png'))),'local_links_checked':links,'broken_links':broken,'script_syntax_exit_codes':checks,'forbidden_data_auth_modules':forbidden,'hosted_config_or_secret_patterns':hits,'tracked_source_diff':tracked,'git_diff_check':diff.returncode,'visual_review':['Production/Bids portrait','Production landscape','Bids Combined source controls','date review'],'server':'Left running at http://localhost:3018 for Product review','port_3000':'Not stopped or replaced','device_limits':'Chromium touch emulation only. Physical Safari/Home Screen/edge gestures/keyboard unverified.','package':'Compiled artifact runnable with Node standard library; rebuild requires repository dependencies'}
(base/'evidence/validation.json').write_text(json.dumps(result,indent=2))
files=sorted(p for p in base.rglob('*') if p.is_file() and p.name!='SHA256SUMS.txt')
(base/'SHA256SUMS.txt').write_text(''.join(hashlib.sha256(p.read_bytes()).hexdigest()+'  '+str(p.relative_to(base))+'\n' for p in files))
z=base.parent/'2026-10-20-mobile-timeline-handoff.zip'
with zipfile.ZipFile(z,'w',zipfile.ZIP_DEFLATED) as out:
    for p in sorted(base.rglob('*')):
        if p.is_file(): out.write(p,Path(base.name)/p.relative_to(base))
with zipfile.ZipFile(z) as out: assert out.testzip() is None
print(json.dumps(result,indent=2));print('ZIP bytes',z.stat().st_size)
