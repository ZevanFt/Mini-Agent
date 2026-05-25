from collections import defaultdict
def count_words(text):
    text = re.sub('[^a-zA-Z0-9\s]', '', text).lower()
    word_count = defaultdict(int)
    word_count = {word: len(re.findall('\\b' + r'\w+', text)) for word in set([i[0] for i in re.findall("(\\b\\w+\\b)",text)])}
    return dict(word_count)
