import json
import re

transcript_file = '/home/aqi/.gemini/antigravity-ide/brain/1edfaa02-3526-4860-854c-f25df98c67ca/.system_generated/logs/transcript.jsonl'

with open(transcript_file, 'r') as f:
    lines = f.readlines()

models_code = None

for line in reversed(lines):
    data = json.loads(line)
    if 'tool_calls' in data:
        for tool_call in data['tool_calls']:
            if tool_call['name'] == 'default_api:write_to_file':
                args = tool_call['arguments']
                if args.get('TargetFile', '').endswith('models.py'):
                    print("Found write_to_file for models.py")
                    models_code = args.get('CodeContent')
                    break

if models_code:
    with open('/home/aqi/Documents/Projects/Prison_Management_System/Reception/models.py', 'w') as f:
        f.write(models_code)
    print("Recovered from write_to_file.")
else:
    print("Could not find a full write_to_file. Trying to find the last complete output.")
