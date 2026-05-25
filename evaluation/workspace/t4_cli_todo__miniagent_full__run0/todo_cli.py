def main(argv: list[str]) -> int:
    if len(argv) < 2:
        print('usage: todo_cli.py <file>', file=sys.stderr)
        return 1
    
    path = argv[1]
    
    try:
        with open(path, 'r') as file:
            lines = file.readlines()
            
            open_count = sum(1 for line in lines if line.startswith('- [ ]'))
            done_count = sum(1 for line in lines if line.startswith('- [x]'))
            
            total_count = open_count + done_count
            
            percent_done = 0.0
            if total_count > 0:
                percent_done = (done_count / total_count) * 100
            
            print(f'open: {open_count}')
            print(f'done: {done_count}')
            print(f'percent: {percent_done:.1f}%')
    
    except FileNotFoundError:
        print('error: file not found', file=sys.stderr)
        return 1
    
    return 0

if __name__ == '__main__':
    sys.exit(main(sys.argv))
