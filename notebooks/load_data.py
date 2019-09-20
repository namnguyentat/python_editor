# Type your code here
import random

a = 1
b = True
c = 'String'
d = [1, 2, 3]


def print_random():
    print(random.randint(1, 10))
    print_hello()
    print(random.randint(1, 10))
    print_hello()
    return 4


def print_hello():
    if True:
        print('Hello')
        if True:
            print('World')


print('hello world')
print('aaaa')
print_random()
