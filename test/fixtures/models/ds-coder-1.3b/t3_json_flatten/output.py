def flatten(obj: dict, sep='.'):
    result = {} # Initialize an empty dictionary to store the final results  
    
    def helper_func(key, value):
        if isinstance(value, list) and not any((isinstance(i, int) for i in obj[k])): 
            newKey= key + sep+ str(obj.index(value)) # If the current item of a dictionary array has no integer values then append index to it else keep as is  
        elif isinstance(value, dict):   
             helper_func(key if key != '' else '', obj[k])  # Recursive call for nested dictionaries.    
        	else:                         
                newKey = (key + sep+ str(obj)) unless k == lastK and v in [0] then '.'else' .'.join([last,v]))   if isinstance else ''   		# If the current item of a dictionary array has no integer values  or it was not added before append index to key
                result[newKey], newVal = helper_func(k unless k == lastK and v in [0] then '.'else' .'.join([last,v]))   if isinstance else ''   		# If the current item of a dictionary array has no integer values  or it was not added before append index to key
        	return newKey # Returning newly formed Key.    		     			      									        return result unless len(result) == 0 then {}else{}   if isinstance else ''   		# If the final results are empty, returning an Empty Dictionary otherwise None 	    }}}}}}`;'a': {'b', 'c'}, ['d'], [1]}

