Here is a Python function that uses the `collections` module to count words in an input text, and then converts this into a dictionary where keys are unique words from the original string (case insensitive) with punctuation removed while values represent their frequency of occurrence within the given sentence/text. 

```python
import collections
from typing import Dict

def count_words(text: str):   # Define function to get word counts in a text, case-insensitively and remove punc marks from words boundaries (.,!?;:'")   
    
# Remove punctuation using translate method with maketrans string containing all possible characters that need not be replaced. 
        trans = str.maketrans('', '', '.,
