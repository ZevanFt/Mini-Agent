from collections import Counter

def count_todos(file):  # counts open/done todos in file.txt
    with open(file) as f:  
        lines = [line for line in f if line[0] == '-' and '[' in line ]    
        
    done, total =  Counter([l[2:] for l in lines])
      
    return len(lines), sum((v-d) for d, v in zip(list(done.values()), list(total.values()))
    
def main():
    if (len(sys.argv)) < 2:
        print('error: file not found',file=sys.stderr) 
        sys.exit(1)
    
    file = sys.argv[1]
    
    try:
        lines_open, todos = count_todos(file)
        
        print('Open:',lines_open )
        if todos == 0 :
            print('percent:', '{:.1f}'.format(float("inf")))
        elif lines_open == 0 :
            print('percent:', '{:.1f}'.format(float("inf")))
    else:
            print('percent:', '{:.1f}'.format((todos/lines_open)* 100))
        
except FileNotFoundError :      # Catch the file not found exception.   
        print('error:', sys.argv[1], 'not found')
        
if __name__ == "__main__":
        main()
