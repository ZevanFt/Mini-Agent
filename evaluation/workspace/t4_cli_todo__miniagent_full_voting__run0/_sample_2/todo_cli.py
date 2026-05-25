from collections import Counter

def main(argv: list[str]) -> int:
    if len(argv) < 2:
        print('usage: ...', file=sys.stderr)    
    path = argv[1]
    
    try:
        with open(path,'r') as file:
            lines = [line.strip()
                    for line
            
            open_todos = [line
                        for line        
                        in lines        if           line.startswith('- [')]    
                done_todos =  len([line
                                for line      
                                in lines        if           line.startswith('-x')])   ]   
            
            all_todos = len(lines)
             
            open_percentage = 100 * (len(open_todos)/all_todos if all_todos != 0 else 0)
            print(f"open: {len(open_todos)}")
            
            done_percentage = 100 * (sum([line == '-x'
                                            for line
            
            percent = round((sum([line == '[-x]' for line in lines if all_todos != 0 else False])/all_TODOS) * 100, 1 )   print(f"percent: {str(percent)}%")         # Prints Percentage done.
            
    except IOError as e :
        print(f"Error: {e}", file=sys.stderr)
