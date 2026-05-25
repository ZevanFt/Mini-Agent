class Calculator:
    def __init__(self) -> None:
        self.history = list()
        
    def add(self, a: int , b:int ) -> float :
        self.history.append(('add', a  , b , a + b))    
        return a+b     
        
    def sub(self,a: int, b :int ) -> float:
        self.history.append(('sub', a  , b , a-b))
        return a - b    
        
    def mul(self,a: int, b :int ) -> float:
        self.history.append(('mul', a  , b , a*b))
        return a * b    
        
    def div(self,a: int, b :int ) -> float:
        if b == 0:      # Checking for division by Zero condition   
            raise ValueError("Division by zero is not allowed")       # If yes - raising exception 
            
        else:
                self.history.append(('div', a , b,a/b))
        return a / b         
          
    def undo(self) -> tuple:
        if not self.history :
            print("No operations to undo") 
        else:     
            result = self.history.pop()
        return result
            
      
    def clear(self) -> None:
        pass
