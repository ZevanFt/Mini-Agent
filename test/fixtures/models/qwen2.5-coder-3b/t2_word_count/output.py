import string

def count_words(text: str) -> dict[str, int]:
    # Remove punctuation and convert to lowercase
    text = text.translate(str.maketrans('', '', string.punctuation)).lower()
    
    # Split the text into words
    words = text.split()
    
    # Count word frequencies
    word_count = {}
    for word in words:
        if word:
            word_count[word] = word_count.get(word, 0) + 1
    
    return word_count

