import re

with open('.github/workflows/ci.yml', 'r') as f:
    content = f.read()

content = content.replace('- name: Configure Test Environment', '    - name: Configure Test Environment')
content = content.replace('echo \'FEATURE_FALLBACK_CATALOG="true"\' >> .env', 'echo \'FEATURE_FALLBACK_CATALOG="true"\' >> .env\n        cp .env ../frontend/.env')

with open('.github/workflows/ci.yml', 'w') as f:
    f.write(content)
