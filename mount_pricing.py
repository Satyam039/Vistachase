import re

with open('backend/src/app.ts', 'r') as f:
    content = f.read()

if 'import pricingRoutes' not in content:
    content = content.replace('import trackingRoutes from "./routes/tracking.routes";', 'import trackingRoutes from "./routes/tracking.routes";\nimport pricingRoutes from "./routes/pricing.routes";')

if '/api/pricing' not in content:
    content = content.replace('app.use("/api/tracking", trackingRoutes);', 'app.use("/api/tracking", trackingRoutes);\napp.use("/api/pricing", pricingRoutes);')

with open('backend/src/app.ts', 'w') as f:
    f.write(content)
