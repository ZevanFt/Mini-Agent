class Calculator:
    def __init__(self):
        self.history = []  
    
    def add(self, a: int , b:int) -> float :     
        result=a+b        
        operation_result  = ('add', a, b, result )      
        self.history.append(operation_result)  # Appends the tuple to history list    
        return result  
    def sub(self, a: int , b:int)-> float :     
        result=a-b         
        operation_result  = ('sub', a, b, result )      
        self.history.append(operation_result)  # Appends the tuple to history list    
        return result  
    def mul(self, a: int , b:int)-> float :     
        result=a*b         
        operation_result  = ('mul', a, b, result )      
        self.history.append(operation_result)  # Appends the tuple to history list    
        return result  
    def div(self, a: int , b:int)-> float :     
        if b == 0:           
            raise ValueError('division by zero')         
        else          
                result=a/b      
                operation_result  = ('div', a, b, result )       
                self.history.append(operation_result)  # Appends the tuple to history list    
                return result  
    def undo(self)->tuple :     
        if not len(self.history):           
            print('Nothing can be undone')         
        else          
                last_operation= self.history.pop()  # Removes the tuple from history list    
                return last_operation  
    def clear(self)->None :     
        self.history = []
