"""Fetch public code at the exact recorded SHAs. Never change an existing checkout."""
import json,subprocess
from pathlib import Path
ROOT=Path(__file__).resolve().parent
for r in json.loads((ROOT/'evidence/revisions.json').read_text()):
    d=ROOT/'repos'/r['name']
    if d.exists():
        actual=subprocess.check_output(['git','-C',str(d),'rev-parse','HEAD'],text=True).strip()
        if actual!=r['sha']:raise RuntimeError(f'{d}: expected {r["sha"]}, found {actual}; refusing to change existing checkout')
        print(r['name'],'already pinned');continue
    d.mkdir(parents=True)
    subprocess.run(['git','init','-q',str(d)],check=True)
    subprocess.run(['git','-C',str(d),'remote','add','origin','https://github.com/'+r['repo']+'.git'],check=True)
    subprocess.run(['git','-C',str(d),'fetch','--depth','1','origin',r['sha']],check=True)
    subprocess.run(['git','-C',str(d),'checkout','--detach','FETCH_HEAD'],check=True)
