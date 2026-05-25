import pytest
from calculator import Calculator

def test_add():
    c = Calculator()
    assert c.add(2, 3) == 5
    assert c.history == [('add', 2, 3, 5)]

def test_all_ops():
    c = Calculator()
    c.add(1, 2)
    c.sub(5, 3)
    c.mul(4, 6)
    assert c.history == [('add', 1, 2, 3), ('sub', 5, 3, 2), ('mul', 4, 6, 24)]

def test_div():
    c = Calculator()
    assert c.div(10, 2) == 5
    assert c.history == [('div', 10, 2, 5.0)] or c.history == [('div', 10, 2, 5)]

def test_div_by_zero_raises():
    c = Calculator()
    with pytest.raises(ValueError, match='division by zero'):
        c.div(10, 0)
    assert c.history == []

def test_div_by_zero_after_ops_does_not_pollute():
    c = Calculator()
    c.add(1, 1)
    with pytest.raises(ValueError):
        c.div(5, 0)
    assert len(c.history) == 1

def test_undo():
    c = Calculator()
    c.add(1, 1)
    c.sub(5, 2)
    last = c.undo()
    assert last == ('sub', 5, 2, 3)
    assert len(c.history) == 1

def test_undo_empty():
    c = Calculator()
    assert c.undo() is None

def test_clear():
    c = Calculator()
    c.add(1, 1); c.add(2, 2)
    c.clear()
    assert c.history == []
