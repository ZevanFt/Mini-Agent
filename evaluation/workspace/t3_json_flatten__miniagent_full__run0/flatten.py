from typing import Dict

def flatten(obj: dict, sep: str = '.') -> dict:
    def _flatten(d: dict, parent_key: str = '') -> dict:
        items = {}
        for key, value in d.items():
            new_key = f"{parent_key}{sep}{key}" if parent_key else key
            if isinstance(value, dict):
                items.update(_flatten(value, new_key))
            elif isinstance(value, list):
                items[new_key] = value
        else:
                items[new_key] = value
        return items

    return _flatten(obj)

# Test cases
def test_custom_sep():
    assert flatten({'a': {'b': 1, 'c': {'d': 2}}}, sep=':') == {'a:b': 1, 'a:c:d': 2}

def test_list_preserved():
    assert flatten({'a': [1, 2, 3]}) == {'a': [1, 2, 3]}

def test_deep_nesting():
    assert flatten({'a': {'b': {'c': {'d': 4}}}}) == {'a.b.c.d': 4}
