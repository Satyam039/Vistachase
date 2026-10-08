import re

with open('src/routes/admin.routes.ts', 'r') as f:
    content = f.read()

replacement = """
import { Router } from "express";
import { PrismaClient } from "@prisma/client";
import { verifyToken } from "../lib/auth/auth";

const router = Router();
const prisma = new PrismaClient();

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

content = re.sub(r'import \{ Router \} from "express";[\s\S]*?next\(\);\n\}\);', replacement.strip(), content)

with open('src/routes/admin.routes.ts', 'w') as f:
    f.write(content)

