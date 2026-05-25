class Calculator:
    def __init__(self):
        self.history: list = []

    def add(self, a: int, b: int) -> int:
        result = a + b
        self.history.append(('add', a, b, result))
        return result

    def sub(self, a: int, b: int) -> int:
        result = a - b
        self.history.append(('sub', a, b, result))
        return result

    def mul(self, a: int, b: int) -> int:
        result = a * b
        self.history.append(('mul', a, b, result))
        return result

    def div(self, a: int, b: int) -> float:
        if b == 0:
            raise ValueError('division by zero')
        result = a / b
        self.history.append(('div', a, b, result))
        return result

    def undo(self) -> tuple | None:
        if not self.history:
            return None
        last_operation = self.history.pop()
        return last_operation

    def clear(self) -> None:
        self.history.clear()

