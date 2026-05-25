def flatten(obj: dict, sep: str = '.') -> dict:
    def _flatten(d, parent_key='', result=None):
        if result is None:
            result = {}
        
        for key, value in d.items():
            new_key = f"{parent_key}{sep}{key}" if parent_key else key
            if isinstance(value, dict):
                _flatten(value, new_key, result)
            elif isinstance(value, list):
                result[new_key] = value
            else:
                result[new_key] = value
        
        return result
    
    return _flatten(obj)

# Example usage
print(flatten({'a': {'b': 1, 'c': {'d': 2}}}))
