import re

with open('.github/workflows/ci.yml', 'r') as f:
    content = f.read()

# Instead of passing env to the step, let's write it to .env
replacement = """
    - name: Configure Test Environment
      working-directory: ./backend
      run: |
        echo 'DATABASE_URL="postgresql://postgres:vistachase_secret@localhost:5432/vistachase_test?schema=public"' > .env
        echo 'REDIS_URL="redis://localhost:6379"' >> .env
        echo 'JWT_SECRET="super-secret-test-key-must-be-32-chars!"' >> .env
        echo 'NODE_ENV="test"' >> .env
        echo 'STRIPE_SECRET_KEY="sk_test_mock"' >> .env
        echo 'FEATURE_FALLBACK_CATALOG="true"' >> .env
"""

content = content.replace('    - name: Generate Prisma Client', replacement.strip() + '\n\n    - name: Generate Prisma Client')

with open('.github/workflows/ci.yml', 'w') as f:
    f.write(content)
