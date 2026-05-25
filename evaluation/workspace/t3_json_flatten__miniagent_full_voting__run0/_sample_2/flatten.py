def flatten(obj: 'dict', sep='.') -> 'dict':
    if obj is None:
        return {}
    else:
        return {sep.join([k] + [str(v) if not isinstance(v, dict) else flatten({x: v[x]} , sep=sep).keys() for k, v in obj.items() ]):
