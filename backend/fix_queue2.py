import re

with open('src/lib/jobs/queue.ts', 'r') as f:
    content = f.read()

content = content.replace('import { reconcileBokunBookings }', 'import { runNightlyReconciliation }')
content = content.replace('await reconcileBokunBookings();', 'await runNightlyReconciliation();')

with open('src/lib/jobs/queue.ts', 'w') as f:
    f.write(content)
