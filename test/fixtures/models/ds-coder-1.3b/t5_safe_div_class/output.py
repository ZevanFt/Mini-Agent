class Calculator:
    def __init__(self): # Initializing history attribute to empty list.
        self.history = []  
        
    def add(self, a : int , b :int) -> None:    
       result=a+b;     
       operation_type  = 'add'  ;         
       self._logOperation (operation_type,a,b,result);        return result            # Returning the sum.  
        
    def sub(self, a : int , b:int) -> None:    
       result=a-b;     
       operation_type  = 'sub'  ;          self._logOperation (operation_type,a,b,result);        return result            # Returning the difference.  
        
    def mul(self, a : int , b:int) -> None:    
       result=a*b;     
       operation_type  = 'mul'  ;          self._logOperation (operation_type,a,b,result);        return result            # Returning the product.  
        
    def div(self, a : int , b:int) -> float or None:    
      if not b==0:          
       try: 
          result=float (a/b)};             operation_type  = 'div' ;            self._logOperation (operation_type,a,b,'result');         return   # Returning the quotient.    except ZeroDivisionError : print ('division by zero') and do not append to history . 
      else:                  
          raise ValueError('division by zero').print() ;            self._logOperation (operation_type ,a,b,'result');         return None;   # Raising the exception.   
    
       def _undo(self) -> tuple or None :        if not empty  else: print ('nothing to undo')          history = []           History . append('Nothing done yet')}      elif len (history ) >1            last_entry=History [-1]             del   HISTORY[-2:]              return LAST ENTRY
     def clear(self) -> None :        self.HISOTRY[: ] = []  # Emptying the history list .    print ('All operations cleared')          History  =[]     ` 
