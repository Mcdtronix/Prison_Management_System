import urllib.request
import json
import urllib.error

url = "http://localhost:8000/api/auth/login/"
data = {"service_number": "1234567A", "password": "password"} # we don't have the password, we just want to see the 500 output
# But wait, maybe I can just grep the log file! Django runserver prints to stdout.
# Since the user started manage.py runserver, wait, it's running in terminal "running for 2h43m11s".
# The user sees the error on frontend, but what is output on backend?
# Let's write a wrapper that reads the system log or whatever, wait we don't have access to the user's terminal.
