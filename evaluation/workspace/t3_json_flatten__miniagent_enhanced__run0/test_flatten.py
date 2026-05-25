from flatten import flatten

def test_simple_nested():
    assert flatten({'a': {'b': 1, 'c': {'d': 2}}}) == {'a.b': 1, 'a.c.d': 2}

def test_flat():
    assert flatten({'a': 1, 'b': 2}) == {'a': 1, 'b': 2}

def test_empty():
    assert flatten({}) == {}

def test_custom_sep():
    assert flatten({'a': {'b': 1}}, sep='/') == {'a/b': 1}

def test_list_preserved():
    result = flatten({'a': [1, 2, 3], 'b': {'c': [4, 5]}})
    assert result == {'a': [1, 2, 3], 'b.c': [4, 5]}

def test_deep_nesting():
    assert flatten({'a': {'b': {'c': {'d': {'e': 'deep'}}}}}) == {'a.b.c.d.e': 'deep'}
