from string import punctuation

def count_words(text):
    # Remove Punctuations from text. 
    translator = str.maketrans('', '', punctuation)  
    
    if not text: return {}
        
    words_list  = list(collections.Counter(text.lower().translate(translator).split())) 
                                                    # Split the string into a word and count frequency, then convert to lower case  
    
    return dict((word,words_list.count(word)) for word in words_list)
