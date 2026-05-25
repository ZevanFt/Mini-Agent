class Calculator():
    def __init__(self): # Initializing history attribute. Default is empty List [] if not provided in constructor arguments or passed while creating object of class instance directly, it will be initialized as an Empty list by default ie [], which can also serve for other data types too like string etc 
        self.history = []  
    
    def add(self, a: int , b:int) -> None : # Type hinting is done here to ensure that the method parameters and return type are correct as per your requirements (integer). Also it's not printing anything in this case 
        result=a+b  
        self.history.append(('add', a, b ,result))   
    
    def sub(self, a: int , b:int) -> None : # Type hinting is done here to ensure that the method parameters and return type are correct as per your requirements (integer). Also it's not printing anything in this case 
        result=a-b  
        self.history.append(('sub', a, b ,result))   
    
    def mul(self, a: int , b:int) -> None : # Type hinting is done here to ensure that the method parameters and return type are correct as per your requirements (integer). Also it's not printing anything in this case 
        result=a*b  
        self.history.append(('mul', a, b ,result))   
    
    def div(self, a: int , b:int) -> None : # Type hinting is done here to ensure that the method parameters and return type are correct as per your requirements (integer). Also it's not printing anything in this case 
        if b==0:  
            raise ValueError('division by zero')   
         else:    
             result=a/b      # Type casting is done here to ensure that the division operation returns a float. If you want integer, use int() function instead of dividing with '//' operator 
        self.history.append(('div', a, b ,result))   
        
    
    def undo(self) -> tuple : # Type hinting is done here to ensure that the method parameters and return type are correct as per your requirements (tuple). Also it's not printing anything in this case 
        if len(self.history)!=0:  
            last_entry = self.history[-1]    # -1 index refers to latest entry added into history list, so we get the most recent operation performed by user and undo that using 'undo' function    
             return last_entry 
        else :     
           print("No more operations in History")
