class Calculator:   # Define Class with name 'Calculator'.
    def __init__(self):
        self.history = []
        
    def add(self, a: int , b:int) -> float :
        result = a+b  # Calculate the Sum of Inputs..  
        self.history.append(('add',a, b ,result))
        
        return result
        
    def sub(self, a: int , b:int) -> float :
        result = a-b  # Calculate the Difference of Inputs..  
        self.history.append(('sub',a, b ,result))
        
        return result
        
    def mul(self, a: int , b:int) -> float :
        result = a*b  # Calculate the Product of Inputs..  
        self.history.append(('mul',a, b ,result))
        
        return result
        
    def div(self, a: int , b:int) -> float :
        if b == 0:
            raise ValueError("Division by Zero Error")    
            
        result = a/b.result = 1 if b == 0 else a / b
         
        self.history.append(('div',a, b , result))
        
        return result
        
    def undo(self) -> tuple :
        try:
            last_operation = self.history.pop()
            
            if last_operation:
                print(f"Undo operation: {last_operation}")
                
                if last_operation[0] == 'add':
                    print(f"Result after undo: {last_operation[3]}")
                    
                elif last_operation[0] == 'sub':
                    print(f"Result after undo: {last_operation[3]}")
                    
                elif last_operation[0] == 'mul':
                    print(f"Result after undo: {last_operation[3]}")
                    
                elif last_operation[0] == 'div':
