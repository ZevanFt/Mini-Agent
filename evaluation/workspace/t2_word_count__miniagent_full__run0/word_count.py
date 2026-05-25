def count_words(text: str) -> dict[str, int]:
    # Convert text to lowercase and remove punctuation
    cleaned_text = ''.join(char.lower() for char in text if char.isalnum() or char.isspace())
    
    # Split the cleaned text into words
    words = cleaned_text.split()
    
    # Count the frequency of each word
    word_count = {}
    for word in words:
        if word:
            word_count[word] = word_count.get(word, 0) + 1
    
    return word_count

# Test cases
def test_empty():
    assert count_words("") == {}

def test_whitespace_only():
    assert count_words("   ") == {}

def test_multi_punct():
    assert count_words("Hello, world! Hello.") == {"hello": 2}
