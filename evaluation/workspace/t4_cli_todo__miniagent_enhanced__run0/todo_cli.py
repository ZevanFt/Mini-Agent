import sys
from collections import Counter    # to count occurrences of each line prefix in file
import os                         # for checking if files exists or reading them respectively.
import re                        # regular expression module, used by the code below   (to find lines starting with '- [ ]' and '[- x]')    
from subprocess import CompletedProcess    # to handle errors when running external command line tools in python scripting language     

def calculate_percentage(total: int) -> float :      
        return round((100 * total / maximum), 1) if maximum > 0 else "error"     # returns percentage rounded to one decimal place. If no file or zero lines, it will print 'Error' in stderr and exit with code of `os._exit(1))`   
     
def main():                       # Main function where the program starts from 
        args = sys.argv[1:]           # Get all arguments except first one (script name itself) which are passed as command line argument to script file, e.g., python todo_cli.py filename or ./todo_cli.py /path/to/filename  
    
    if not args:                   # If no files provided in the cmd then print error and exit with code 1 (os._exit(1))      sys.stderr.write('error: No file specified\n')       os._exit(1)                 
        
        filename = args[0]              # Assign first command line argument to variable `filename`  
    
    if not os.path.isfile(filename):  # If the provided path is for a non-existing file then print error and exit with code of  `os._exit(1)`      sys.stderr.write('error: File {} does not exist\n'.format(filename))      
        os._exit(1)                 
    
    # Read the text from provided input, count lines starting ith '- [ ]' and '[- x]', store them in a dictionary with prefix as key & occurrences/counts of each line prefixed by that string.   try:      def main():                       # Main function where the program starts from
