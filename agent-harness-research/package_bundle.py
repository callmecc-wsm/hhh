"""Package the research without virtualenvs, cloned repositories or dependencies."""
import hashlib
import json
import shutil
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent
revisions = json.loads((ROOT / 'evidence/revisions.json').read_text())
license_dir = ROOT / 'licenses'
license_dir.mkdir(exist_ok=True)
lines = ['# Third-party source attribution', '',
         'This research quotes pinned public source excerpts for technical analysis. '
         'Upstream code retains its original copyright and license. No complete '
         'repository, installed dependency tree, private code or model weights are bundled.', '',
         '`experiments/kimi/conftest.py` is copied unchanged from the pinned Kimi CLI '
         'test fixture; see its Apache-2.0 license and NOTICE. The Gemini experiment '
         'extracts original declarations at runtime from the separately fetched checkout.', '',
         '| Repository | Pinned revision | License / notice copies |', '| --- | --- | --- |']
for r in revisions:
    copies = []
    repo_dir = ROOT / 'repos' / r['name']
    for name in ['LICENSE', 'LICENSE.md', 'LICENSE-CODE', 'LICENSE-MODEL', 'NOTICE', 'THIRD_PARTY_NOTICES.md']:
        source = repo_dir / name
        if source.exists():
            target = license_dir / (r['name'] + '-' + name)
            shutil.copyfile(source, target)
            copies.append(f'[{target.name}](licenses/{target.name})')
    lines.append(f"| [{r['repo']}](https://github.com/{r['repo']}) | [{r['sha'][:12]}](https://github.com/{r['repo']}/tree/{r['sha']}) | {', '.join(copies)} |")
lines += ['', 'Anthropic Claude Code and Agent SDK sources carry their own terms; '
          'public availability is not a claim that every component is open source. '
          'Consult the original license before reusing code beyond research citation.', '',
          'Official documentation snapshots retain their publishers’ rights. '
          'Original URLs and retrieval context are stored in `evidence/`.']
(ROOT / 'THIRD_PARTY.md').write_text('\n'.join(lines) + '\n')

files = {'index.html': ROOT / 'dist/index.html'}
for name in ['README.md', 'DESIGN.md', 'THIRD_PARTY.md', 'content.py', 'build_sources.py',
             'build_site.py', 'fetch_sources.py', 'package_bundle.py', 'requirements-lock.txt']:
    files[name] = ROOT / name
for dirname in ['site', 'experiments', 'evidence', 'qa', 'licenses']:
    for p in (ROOT / dirname).rglob('*'):
        rel = p.relative_to(ROOT)
        if not p.is_file() or p.is_symlink() or any(x in rel.parts for x in ['node_modules', '__pycache__', '.pytest_cache']):
            continue
        if p.suffix in {'.pyc', '.html', '.log'}:
            # Include human-readable official text snapshots and cited source data,
            # not incidental downloads or installation logs. Keep site/template.html.
            if dirname != 'site':
                continue
        files[str(rel)] = p

manifest = {name: {'sha256': hashlib.sha256(p.read_bytes()).hexdigest(), 'bytes': p.stat().st_size}
            for name, p in sorted(files.items())}
out = ROOT / 'dist/research-bundle.zip'
with zipfile.ZipFile(out, 'w', compression=zipfile.ZIP_DEFLATED, compresslevel=9) as z:
    for name, p in sorted(files.items()):
        z.write(p, name)
    z.writestr('MANIFEST.json', json.dumps(manifest, indent=2))
with zipfile.ZipFile(out) as z:
    assert z.testzip() is None
    for name, info in manifest.items():
        assert hashlib.sha256(z.read(name)).hexdigest() == info['sha256']
print(f'{out}: {len(files)} files, {out.stat().st_size:,} bytes; checksums verified')
