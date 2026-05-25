def flatten(obj: dict, sep: str = '.') -> dict:
    if not isinstance(obj, dict):
        raise TypeError('Input must be a dictionary!')  
    
    flattened = {}          
        
    def _flatten(key, value):
        if isinstance(value, list) or (isinstance(value, dict) and not bool(value)):
            return                 
        if isinstance(key, str):
            new_key = f"{str(obj[key])} {sep}" + _flatten(*list((k, v) for k,v in obj.items() if not isinstance(v, list)))  -> str
        else:                       
            new_key = key
        
        if isinstance(value, list):
            new_key += f"[{str(i)}]" if isinstance(v, list) else ""
            flattened[new_key] = v
        else:                       
            flattened[new_key] = value
        
    _flatten(*list((k, v) for k,v in obj.items() if not isinstance(obj[k], list)))
    
    return flattened
