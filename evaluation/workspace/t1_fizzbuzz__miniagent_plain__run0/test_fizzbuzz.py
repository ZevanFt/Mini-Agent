from fizzbuzz import fizzbuzz

def test_basic():
    assert fizzbuzz(15) == ['1','2','Fizz','4','Buzz','Fizz','7','8','Fizz','Buzz','11','Fizz','13','14','FizzBuzz']

def test_length():
    assert len(fizzbuzz(100)) == 100

def test_n_one():
    assert fizzbuzz(1) == ['1']

def test_n_three():
    assert fizzbuzz(3) == ['1','2','Fizz']

def test_n_five():
    assert fizzbuzz(5) == ['1','2','Fizz','4','Buzz']
