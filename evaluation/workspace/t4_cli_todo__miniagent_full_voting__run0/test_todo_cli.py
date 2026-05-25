import subprocess, sys, os, tempfile

SCRIPT = os.path.join(os.path.dirname(__file__), 'todo_cli.py')

def run(content_or_path, is_path=False):
    if is_path:
        path = content_or_path
    else:
        f = tempfile.NamedTemporaryFile('w', suffix='.md', delete=False, encoding='utf-8')
        f.write(content_or_path)
        f.close()
        path = f.name
    r = subprocess.run([sys.executable, SCRIPT, path], capture_output=True, text=True)
    if not is_path:
        os.unlink(path)
    return r

def test_basic_counts():
    r = run('- [ ] a\n- [x] b\n- [ ] c\n')
    assert r.returncode == 0
    out = r.stdout.strip().splitlines()
    assert out[0] == 'open: 2'
    assert out[1] == 'done: 1'
    assert out[2] == 'percent: 33.3%'

def test_all_done():
    r = run('- [x] a\n- [x] b\n')
    out = r.stdout.strip().splitlines()
    assert out[0] == 'open: 0'
    assert out[1] == 'done: 2'
    assert out[2] == 'percent: 100.0%'

def test_empty():
    r = run('')
    out = r.stdout.strip().splitlines()
    assert out[0] == 'open: 0'
    assert out[1] == 'done: 0'
    assert out[2] == 'percent: 0.0%'

def test_ignores_non_todo_lines():
    r = run('# Header\nsome text\n- [ ] task\nrandom\n- [x] done\n')
    out = r.stdout.strip().splitlines()
    assert out[0] == 'open: 1'
    assert out[1] == 'done: 1'
    assert out[2] == 'percent: 50.0%'

def test_file_not_found():
    r = run('/nonexistent_path_xyz_12345.txt', is_path=True)
    assert r.returncode == 1
    assert 'error' in r.stderr.lower() and 'not found' in r.stderr.lower()
