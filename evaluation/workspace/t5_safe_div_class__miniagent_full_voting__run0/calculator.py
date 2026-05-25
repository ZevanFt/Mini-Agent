class Calculator:
    def __init__(self):
        self.history: list = []
        
    def add(self, a : int , b :int) -> float:
        result = a + b                         
        self.history.append(('add',a,b,result))
        return result
        
    def sub(self, a: int, b :int)-> float:
        result = a - b                         
        self.history.append(('sub',a,b,result))
        return result
        
    def mul(self, a: int, b :int)-> float:
        result = a * b                         
        self.history.append(('mul',a,b,result))
        return result
        
    def div(self, a: int, b :int)-> float:
        if b == 0:
            raise ValueError('division by zero')   
            
        result = a / b                         
        self.history.append(('div',a,b,result))
        
        return result
            
    def undo(self)-> tuple:
        try :
            return self.history.pop()
            
        except IndexError:
            print(None)
