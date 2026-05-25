from collections import Counter

def count_todos(file):
    counter = Counter()  
    
    for line in file:      
        if not line or '[X' not in line and len(line) > 4 :
            continue            
        
        counter.update([line])  
    return tuple(counter['- [ ]'] for _ in range(2))
      
def calculate_percentage(open, total):
    return round((100 * (min(open, total) / max(total, 1)))    
        
          
      
def main():       
    try:         
        file = open(sys.argv[1],'r')
            
    except FileNotFoundError as e :
        print('error:',str(e), sep=" ")     , file = sys.stderr      
         
     
    open_todos, done_todos =  count_todos(file)  
          
    if not (open_todos or done_todos):
            print('percent:', calculate_percentage(0 ,1), '%' )     
        
    total = open_todos + done_todos          
         
    percentage =  round((calculate_percentage (open_todos,total) ),2  )
           
        print('Open:', open_todos , file=sys.stderr)         ;print ('Done :' , done_todos ,file = sys.stderr);    print( 'Percentage Done:' + str (percentage )+ '%')  # printing the results to stdout
     
if __name__ == "__main__" :      
    main()
