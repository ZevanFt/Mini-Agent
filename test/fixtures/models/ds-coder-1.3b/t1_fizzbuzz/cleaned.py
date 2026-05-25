=== STEPS: ['strip_markdown_and_prose']
=== SYNTAX OK: True 
=== CODE ===
def fizzbuzz(n: int) -> list[str]:
    return [f"FizzBuzz" if i % 3 == 0 and i % 5 == 0 else ("Fizz" if i % 3 == 0 else "Buzz") + str(i)] * n

