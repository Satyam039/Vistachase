import re

with open('src/routes/admin.routes.ts', 'r') as f:
    content = f.read()

# Replace the middleware requirement with inline token extraction
replacement = """
import { verifyToken, TokenPayload } from "../lib/auth/auth";

// Define a local Express Request interface extension if needed or just use type assertion
interface AdminRequest extends req.Request {
  user?: TokenPayload;
}

// Only ADMIN and DISPATCHER can access these routes
router.use((req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  
  const token = authHeader.split(" ")[1];
  const payload = verifyToken(token);
  
  if (!payload || !["ADMIN", "DISPATCHER"].includes(payload.role)) {
    return res.status(403).json({ error: "Forbidden: Admin access required" });
  }
  
  (req as any).user = payload;
  next();
});
"""

content = re.sub(r'import \{ requireAuth \} from "\.\./middleware/auth\.middleware";\n\n// Only ADMIN and DISPATCHER can access these routes\nrouter\.use\(requireAuth\);\nrouter\.use\(\(req, res, next\) => \{\n  if \(\!req\.user \|\| \!\["ADMIN", "DISPATCHER"\]\.includes\(req\.user\.role\)\) \{\n    return res\.status\(403\)\.json\(\{ error: "Forbidden: Admin access required" \}\);\n  \}\n  next\(\);\n\}\);', replacement.strip(), content)

content = content.replace('req.user!', '(req as any).user')

with open('src/routes/admin.routes.ts', 'w') as f:
    f.write(content)

