import sys

def count_todos(file_path):
    try:
        with open(file_path, 'r') as file:
            lines = file.readlines()
            open_count = sum(1 for line in lines if line.startswith('- [ ]'))
            done_count = sum(1 for line in lines if line.startswith('- [x]'))
            
            total = open_count + done_count
            percent_done = 0.0 if total == 0 else (done_count / total) * 100
            
            print(f"open: {open_count}")
            print(f"done: {done_count}")
            print(f"percent: {percent_done:.1f}%")
    
    except FileNotFoundError:
        sys.stderr.write("error: file not found\n")
        sys.exit(1)

if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: todo_cli.py <file_path>")
        sys.exit(1)
    
    count_todos(sys.argv[1])
