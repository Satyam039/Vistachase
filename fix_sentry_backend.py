import re

with open('backend/src/server.ts', 'r') as f:
    content = f.read()

sentry_init = """
import * as Sentry from "@sentry/node";
import { nodeProfilingIntegration } from "@sentry/profiling-node";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  integrations: [
    nodeProfilingIntegration(),
  ],
  tracesSampleRate: 1.0, 
  profilesSampleRate: 1.0,
});
"""

if 'import * as Sentry' not in content:
    content = sentry_init.strip() + '\n\n' + content

with open('backend/src/server.ts', 'w') as f:
    f.write(content)

with open('backend/src/app.ts', 'r') as f:
    content2 = f.read()

sentry_app = """
import * as Sentry from "@sentry/node";

"""

if 'Sentry.setupExpressErrorHandler(app);' not in content2:
    content2 = content2.replace('import cors from "cors";', 'import cors from "cors";\nimport * as Sentry from "@sentry/node";')
    content2 = content2.replace('// Global error handler\napp.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {', 'Sentry.setupExpressErrorHandler(app);\n\n// Global error handler\napp.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {')

with open('backend/src/app.ts', 'w') as f:
    f.write(content2)

