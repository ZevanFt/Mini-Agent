class Calculator:
    def __init__(self):
        self.history = []    
        
    def add(self, a: int , b:int) -> float :
        return (a + b), "add", a, b,(a+b) 
       
    
    def sub(self, a: int , b:int)->  float :
        return (a - b), "sub", a,b,(a-b) 
       
    def mul(self , a: int , b :int)->  float :
        return (a * b), "mul",  a,b,(a*b)   
       
    def div(self , a: int , b :int)->  float or None :
        try: 
            result = a / b  
            self.history .append(('div',a ,b,(result)))
        return (float) result     
            except ZeroDivisionError: 
                raise ValueError("division by zero")
               
        else : None         
    def undo(self)-> tuple or None:
        try:
            last_entry = self.history[-1]
            del self.history [-1 ]
        return (last_entry)
