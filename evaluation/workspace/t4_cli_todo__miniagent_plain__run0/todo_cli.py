import sys
from os import path
import re

def process_file(filename):   # Function definition for processing a single todo list text files (one per argument)
    if not isinstance(filename, str):  # Checking the input type. If it isn't string then exit with code -1 and error message to stderr: "error : Expected filename as command line arg" .  
        sys.stderr.write("Error: expected a file name\n")   
        sys.exit(-1)  # terminate the program by raising an exception (terminating script execution). This will also print 'file not found' to stderror and exit with code -1 in terminal/command prompt interface as well, if no filename is provided at command line or file doesnt exist
    else:   # Checking whether given argument exists on the system. If it doesn’t then raise an exception (terminating script execution). 
        try :    
            with open(filename,'r') as fp:      # Open a textfile for reading, if not found exit by raising FileNotFoundError and print 'File Not Found' to stderr in terminal/command prompt interface.  
                lines = [line.strip() for line in fp]  # readlines returns list of all the content from file as string type (each element is a single row). Strip removes any leading or trailing whitespace on each item, if there are multiple spaces between words then it will remove those too
                open_todos = len([line for line in lines if re.match(r'^- \[(.*?)\]', line)])  # list comprehension to find all the '- [ ] ' and extracting text inside brackets using regex (grouped by parentheses).  
            done_todos = 0    # Initialize count of completed todos as zero. If any todo is marked with a character in set ['x', 'X'], increment counter ‘done’ .    
                for line in lines:      # looping through all the content read from file (each row)  
                    if re.match(r'^- \[(.*?)\]$','[x/X]\s(.*)') :    # checking whether each todo is done or not, using regex to match '- [ ] ' followed by any characters inside brackets and ending with a character in set [' ', '\t', '\n']. If yes then increment ‘done’ counter.
                        done_todos += 1   # Incrementing the count of completed todos if todo is marked as complete (i.e., has an x or X at end).   
                total = open_todos + done_todos     # Total number of opened and finished tasks – both are added together to get final result .     
            percent = 0   # Initialize percentage with zero, if no todos then it will be set as 'percent: 0.0%' in the end else calculate using total open/total count *100 / Total number of lines and round off upto one decimal place to get final result .   
                try :    
                    percent = (open_todos + done_todos) / len(lines)* 100 if not None or False else 'percent: Uncomputable'   # Calculating the percentage. If total is zero then it will be set as '%'. Else calculate using open/done count *100 and round off upto one decimal place .
                except ZeroDivisionError :     # Handling exception if there are no todos in file (total lines = 0). In such case, percentage should not exist. So we can safely set it as 'percent: Uncomputable' or ‘%’ depending on the situation and handle this scenario separately .
            print(f"open: {open_todos}")   # Printing open todos count to stdout in required format (one line).   
            print(f"done: {done_todos if done_todos > 0 else ''}")  # If there are no completed tasks then it will be printed as empty string. Else printing the number of finished ones .  
            try :    
                sys.stdout.write("percent: " + str(round(float('%.1f' % percent),2))+"%\n")  # Printing percentage to std
