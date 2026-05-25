import re
from collections import Counter

def count_words(text: str) -> dict[str, int]:
    # Remove non-alphanumeric characters and convert the string into a list of words. 
    wordlist = [word for word in re.sub("[^a-zA-Z0-9\s]", "", text).lower().split() if word != '']  
    
    # Use Counter to count frequency and return as dictionary with each unique word being a key, value is the corresponding occurrence of that word in `wordlist`. 
    return dict(Counter(wordlist))
