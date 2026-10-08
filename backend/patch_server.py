import re

with open('src/server.ts', 'r') as f:
    content = f.read()

# Import the setup job
if 'setupRecurringJobs' not in content:
    content = content.replace('import app from "./app";', 'import app from "./app";\nimport { setupRecurringJobs } from "./lib/jobs/queue";')

# Call setupRecurringJobs
if 'setupRecurringJobs()' not in content:
    content = content.replace('app.listen(PORT, () => {', 'app.listen(PORT, async () => {\n  await setupRecurringJobs().catch(console.error);\n')

with open('src/server.ts', 'w') as f:
    f.write(content)
