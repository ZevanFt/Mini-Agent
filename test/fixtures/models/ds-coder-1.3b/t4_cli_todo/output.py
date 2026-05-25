Here is a Python script that accomplishes this task using command line arguments (args) in addition to standard input/output redirection from stdin or outputting into files via `sys` module functions, as well the built-in file handling methods of python like reading lines and counting certain patterns. 
The code reads each todo item on a newline starting with '- [ ]' then checks if it is done by checking for '[x]'. It also counts total number of open todos (starting line - [-]) as well the count of completed ones ([x].). The percentage calculation and round off to 1 decimal place are performed.
The script exits when all lines in file have been read, or if a non-todo item is encountered which should not happen with valid input files due to our checks at start (line starting - [-]) . If the total count of todos equals zero then it prints 'percent: 0%'. The error handling for missing/non existing todo list and file reading errors are also handled.
```python
import sys, os; print = lambda *x: None if isinstance(x, Printable) else sys.__stdout__.write(*x); stderr=lambda s:sys.__stderr__.write(s+'\n'); fflush=None and flush=None  ## for python3 compatibility
try: total_open = len([l for l in open('todo.txt').readlines() if not (len(l)>4 and l[2]==' ' and l[:-1].isdigit())]); stderr(__f"error: file {sys.argv[1]} does not exist")
except FileNotFoundError : print("file", sys.argv[1], "not found"); exit(1)  ## handle non existing files; error and quit with code one  
try: todos = [l for l in open('todo.txt').readlines() if len(l)>4 and not (len(l[:-2])==0 or any([x!=' 'or x
