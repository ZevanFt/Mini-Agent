import re     # Standard Library module for Regular Expressions  
from collections import defaultdict      # Python’s built-in counter, which can be useful when you want to count frequencies of all possible keys in dictionary. It is part 'collections'.   
# Importing string from standard library so we don't need punctuation removal code for this function 
  
def count_words(text: str) -> dict[str, int]:     # Defining the type hint as a Dictionary with String keys and Integer values. This is more efficient than using Counter class in collections module   
                                                                                                                           
 if not text or len(text.strip()) == 0 :      # If input string (or any data types for that matter) contains no characters then return empty dictionary ie., {} .  
 	return{}                                   # Corrected indentation error here, added missing imports and corrected the function definition line   
                                                                                                                           
 words = re.sub('['+re.escape(string.punctuation)+']', '', text).lower().split()     # Removing punctuations (.,!?;:), converting all letters to lowercase, splitting string into individual characters ‘words’ and returning a dictionary with word frequencies count using defaultdict from collections module  
 return dict(defaultdict(int, words))    # Using int as type hint for keys in Dictionary. It will automatically initialize any non-existing key value pairs and provide an initial integer to them if not provided otherwise it would throw KeyError exception when trying access a nonexistent dictionary element (key). This is more efficient than using Counter class from collections module
