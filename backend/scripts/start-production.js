const { execSync } = require('child_process');
const path = require('path');
const backendDir = path.join(__dirname, '..');

console.log('[Vista Chase Production Startup] Preparing database...');
try {
  // We still run prepare-db.js to generate client if needed, though usually done at build.
  execSync('node scripts/prepare-db.js', { stdio: 'inherit', cwd: backendDir });
  
  console.log('[Vista Chase Production Startup] Deploying database migrations...');
  execSync('npx prisma migrate deploy', { stdio: 'inherit', cwd: backendDir });
  
  // NOTE: Seeding demo users and rewriting data is intentionally removed for production safety (Task F3).
  // Catalog loading should be done via a separate secure admin command or Bókun sync.

  startServer();
} catch (err) {
  console.error('[Vista Chase Production Startup] Startup preparation error:', err);
  process.exit(1);
}

function startServer() {
  console.log('[Vista Chase Production Startup] Starting Express application server...');
  require('../dist/server.js');
}
