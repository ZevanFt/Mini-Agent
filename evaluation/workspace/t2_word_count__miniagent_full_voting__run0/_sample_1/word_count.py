from string import punctuation, whitespace

def count_words(text):
    if not (text and text.strip()):  
        print("No valid input found!")    
        return {}     
        
    table = str.maketrans('', '', punctuation)
    stripped_text= text.translate(table).lower()
    else: 
        stripped_text = text.strip(whitespace).lower()
        print("Word Frequency Counts: ",collections.Counter(stripped_text))   #print the resulting counter 
    return stripped_text
