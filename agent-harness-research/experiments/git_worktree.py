"""Real Git worktree experiment in a fresh temporary repository."""
import tempfile,pathlib,subprocess,json
with tempfile.TemporaryDirectory(prefix='harness-worktree-') as d:
    root=pathlib.Path(d);main=root/'main';main.mkdir()
    def git(*args):return subprocess.run(['git',*args],cwd=main,text=True,capture_output=True,check=True).stdout
    git('init','-q');git('config','user.name','Harness experiment');git('config','user.email','lab@example.invalid')
    (main/'calc.txt').write_text('original');git('add','.');git('commit','-qm','baseline')
    child=root/'child';git('worktree','add','-qb','lab-child',str(child))
    (child/'calc.txt').write_text('child change');before=(main/'calc.txt').read_text()
    (child/'../main/neighbor.txt').write_text('reachable from sibling worktree')
    out={'kind':'real isolated temporary Git repository experiment','main_file':before,'child_file':(child/'calc.txt').read_text(),'sibling_write_possible':(main/'neighbor.txt').exists(),'worktrees':git('worktree','list','--porcelain'),'conclusion':'Worktree separates working files and branch state; it is not an OS security boundary.'}
    (pathlib.Path(__file__).resolve().parents[1]/'evidence/git-worktree.json').write_text(json.dumps(out,indent=2))
    print(json.dumps(out,indent=2))
