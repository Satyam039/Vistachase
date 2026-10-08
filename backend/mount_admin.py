import re

with open('src/app.ts', 'r') as f:
    content = f.read()

if 'import adminRoutes from "./routes/admin.routes";' not in content:
    content = content.replace('import webhookRoutes from "./routes/webhooks.routes";', 'import webhookRoutes from "./routes/webhooks.routes";\nimport adminRoutes from "./routes/admin.routes";')

if 'app.use("/api/admin", adminRoutes);' not in content:
    content = content.replace('app.use("/api/webhooks", webhookRoutes);', 'app.use("/api/webhooks", webhookRoutes);\napp.use("/api/admin", adminRoutes);')

with open('src/app.ts', 'w') as f:
    f.write(content)
