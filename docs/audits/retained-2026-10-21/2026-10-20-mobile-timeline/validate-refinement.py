from pathlib import Path
import json,re,hashlib,subprocess,zipfile
base=Path(__file__).resolve().parent
out=base/'refinement/evidence'
archive=base/'revisions/01-initial'
preserved=json.loads((out/'preserved-initial.json').read_text())
for f,sha in preserved.items(): assert hashlib.sha256((archive/f).read_bytes()).hexdigest()==sha, f
assert (base/'REPORT.md').read_bytes()==(archive/'REPORT.md').read_bytes()
for name in ['evidence','screenshots']:
    for p in (archive/name).rglob('*'):
        if p.is_file(): assert p.read_bytes()==(base/name/p.relative_to(archive/name)).read_bytes(),str(p)
broken=[];links=0
for p in base.rglob('*.md'):
    assert all(line==line.rstrip() for line in p.read_text().splitlines()),str(p)
    for link in re.findall(r'\]\(([^)]+)\)',p.read_text()):
        if link.startswith(('http:','https:','#')): continue
        links+=1
        target=(p.parent/link.split('#')[0]).resolve()
        if not target.exists() and target!=(out/'validation.json').resolve(): broken.append([str(p.relative_to(base)),link])
for p in base.rglob('*.json'): json.loads(p.read_text())
files=['serve.mjs','build.mjs','verify-refinement.cjs','verify-refinement-adapters.mjs','prototype/adapters.mjs','prototype/fixtures.mjs','prototype/semantics.mjs']
syntax={f:subprocess.run(['node','--check',str(base/f)],capture_output=True).returncode for f in files}
meta=json.loads((out/'bundle-inputs.json').read_text())
forbidden=[p for k in ['mobileInputs','referenceInputs'] for p in meta[k] if any(t in p for t in ['@supabase','src/lib/auth','src/lib/supabase','src/modules/pre-production/planning-data','src/modules/production/jobs.ts'])]
hits=[]
for p in base.rglob('*'):
    if p.is_file() and p.suffix in ['.js','.jsx','.mjs','.json','.md'] and any(t in p.read_text() for t in ['supabase.co','sb_secret_','sb_publishable_','-----BEGIN PRIVATE KEY-----']): hits.append(str(p.relative_to(base)))
browser=json.loads((out/'browser.json').read_text());adapters=json.loads((out/'adapters.json').read_text())
assert browser['result']=='PASS' and len(browser['checks'])==26 and all(c['passed'] for c in browser['checks'])
assert adapters['result']=='PASS' and len(adapters['checks'])==8
repo=base.parents[2];head=subprocess.check_output(['git','rev-parse','HEAD'],cwd=repo,text=True).strip()
tracked=subprocess.check_output(['git','diff','--name-only','HEAD'],cwd=repo,text=True).strip()
diff=subprocess.run(['git','diff','--check'],cwd=repo,capture_output=True)
assert head=='01e5e839fdba0256023077cf1d85c2d4dd15212c' and not tracked and diff.returncode==0
assert not broken and not any(syntax.values()) and not forbidden and not hits and not browser['errors'] and not browser['blocked']
result={'date':'2026-10-20 America/Chicago','risk':'Tier 2 isolated prototype refinement; focused checks, not an application release gate','head':head,'tracked_application_diff':tracked,'browser_groups_passed':len(browser['checks']),'adapter_groups_passed':len(adapters['checks']),'refinement_screenshots':len(list((base/'refinement/screenshots').glob('*.png'))),'preserved_initial_files_verified':len(preserved),'initial_report_and_original_evidence_unchanged':True,'local_links_checked':links,'broken_links':broken,'syntax_exit_codes':syntax,'forbidden_auth_data_modules':forbidden,'secret_or_hosted_configuration_patterns':hits,'client_errors':browser['errors'],'unexpected_external_requests':browser['blocked'],'git_diff_check':diff.returncode,'visual_review':['Production portrait','phase inspection','landscape pause inspection with visible actions','Key and source status patterns','Bids selected identity'],'safe_area_validation':'Chromium CDP override: portrait top 24/bottom 20; landscape left/right 40/bottom 20. Physical Safari not verified.','server':'Existing localhost:3018 process retained for review; no port 3000 process replaced','build':'Isolated research bundle only; no application Production build or broad suite','readiness':'Product review and operator/physical-iPhone pilot required before implementation acceptance'}
(out/'validation.json').write_text(json.dumps(result,indent=2))
assert (out/'validation.json').exists()
manifest=base/'SHA256SUMS.txt'
paths=sorted(p for p in base.rglob('*') if p.is_file() and p!=manifest)
manifest.write_text(''.join(hashlib.sha256(p.read_bytes()).hexdigest()+'  '+str(p.relative_to(base))+'\n' for p in paths))
z=base.parent/'2026-10-20-mobile-timeline-refinement-handoff.zip'
with zipfile.ZipFile(z,'w',zipfile.ZIP_DEFLATED) as package:
    for p in sorted(base.rglob('*')):
        if p.is_file(): package.write(p,Path(base.name)/p.relative_to(base))
with zipfile.ZipFile(z) as package: assert package.testzip() is None
print(json.dumps(result,indent=2));print('Package bytes',z.stat().st_size)
