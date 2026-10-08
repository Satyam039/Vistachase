import re

with open('src/lib/jobs/queue.ts', 'r') as f:
    content = f.read()

content = content.replace('import { reconcileBokunBookings } from "../../../scripts/bokun-reconciliation";', 'import { reconcileBokunBookings } from "../../../scripts/nightly-reconciliation";')

with open('src/lib/jobs/queue.ts', 'w') as f:
    f.write(content)
