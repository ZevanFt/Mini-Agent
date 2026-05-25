def flatten(obj, sep='.'):
    def helper(key, value):
        if type(value) == dict:  # recursive case for dictionaries.
            return {k + sep + str(v) : v2 for k1, (k, v), v2 in flatten_helper(id(value), key+sep+str(k1))}
        elif type(value) == list:
            return {key + sep + str(i): val for i, val in enumerate(value)}
        
    def flatten_helper(id_, parent=None):  
        seen = set()          
                
        while id_ in obj and (not isinstance(obj[id_], dict) or not hasattr(obj[id_][0], '__iter__')):
            if parent is None : key = next(k for k, v in obdictitems()if id_(v)) else f'{parent}{sep}{key}'            
                
                seen.add(id_)  
                    
        return zip_longest([], obj[id_].__iter__(), keys=False) if isinstance(obj[id_][0] ,dict )else [[(next(k for k, v in obdictitems()if id_(v)),  value)] ] + \   flatten_helper ( next(k for k, v in obj.obdictiterators ()), parent=key)
            
    return { key: val if isinstance(val , dict ) else helper('',obj[i])for i,(next(keys()),value))}
