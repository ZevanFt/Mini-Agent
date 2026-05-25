def flatten(obj :dict , sep= '.'):   #type hinting for function parameters and return value.
    """Flattern a nested dictionary using separator."""     #docstring explaining the purpose of this method, type hints are optional but recommended in Python3+ versions to make code more readable by IDEs/linters  etc..
                                                        #also helps with autocomplete and other features.  
    result = {}                          #initialize an empty dictionary for storing flattened data    
      
    def _helper(key, value):             #an inner function to handle recursion (flatterning) of nested dictionaries/lists 
        if isinstance(value, dict):         #if the current item's type in obj is a Dictionary then...  
            for k , v in value.items():    #iterate over all keys and values inside this dictionary..    
                new_key = f"{key}{sep}{k}" if key else k  #constructing full nested path using separator (default '.') or current inner-most dict's Key  
                                                                        #if it is the outer most then just use its value.   
                                                               
                _helper(new_key, v)          #call this function recursively for sub dictionaries..    
         elif isinstance(value, list):       #else if current item type in obj is a List...  
            i = 0                           #iterate over all items inside the lists.   
             while  i < len(value):        #loop until we reach end of this array/list..    
                new_key = f"{key}{sep}{i}" if key else str(i)      #constructing full nested path using separator (default '.') or current inner-most dict's Key  
                                                                         #if it is the outer most then just use its value.   
                 _helper(new_key,value[i])     #call this function recursively for sub lists.. 
                i += 1                        #increment index to move on next item in list/dictionary...     
        else:                               #if current type is neither dictionary nor a List then use it as key and value.   
            result[key] = value              #add this into the final flattened Dictionary..  
            
     _helper('', obj)                     #calling helper function with empty string (outer most level dict's Key).  This will start our recursion from here...     
      
         return result                      #return Final Flattern dictionary.
