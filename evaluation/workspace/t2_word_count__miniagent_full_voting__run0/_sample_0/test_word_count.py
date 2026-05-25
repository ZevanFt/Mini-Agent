from word_count import count_words

def test_simple():
    assert count_words('hello world hello') == {'hello': 2, 'world': 1}

def test_case_insensitive():
    assert count_words('Hello HELLO hello') == {'hello': 3}

def test_punctuation():
    assert count_words('hello, world! hello.') == {'hello': 2, 'world': 1}

def test_empty():
    assert count_words('') == {}

def test_whitespace_only():
    assert count_words('   \t\n  ') == {}

def test_multi_punct():
    assert count_words('What?! What?!') == {'what': 2}
