import re

with open('.github/workflows/ci.yml', 'r') as f:
    content = f.read()

content = content.replace('npx prisma migrate deploy', 'npx prisma db push --accept-data-loss')

with open('.github/workflows/ci.yml', 'w') as f:
    f.write(content)
