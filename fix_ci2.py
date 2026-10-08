import re

with open('.github/workflows/ci.yml', 'r') as f:
    content = f.read()

content = content.replace('run: npm run build', 'env:\n        FEATURE_FALLBACK_CATALOG: "true"\n      run: npm run build')

with open('.github/workflows/ci.yml', 'w') as f:
    f.write(content)
