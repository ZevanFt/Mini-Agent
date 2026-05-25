def fizzbuzz(n: int) -> list[str]:
    return [('FizzBuzz' if i % 3 == 0 and i % 5 == 0 else 'Fizz') if not isinstance(i, str) else (f"{int(i)} Buzz") for i in range(1, n+1)]
