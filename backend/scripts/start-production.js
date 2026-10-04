const { execSync } = require('child_process');
const path = require('path');
const backendDir = path.join(__dirname, '..');

console.log('[Vista Chase Production Startup] Preparing database...');
try {
  execSync('node scripts/prepare-db.js', { stdio: 'inherit', cwd: backendDir });
  console.log('[Vista Chase Production Startup] Pushing schema to database...');
  execSync('npx prisma db push --accept-data-loss', { stdio: 'inherit', cwd: backendDir });
  
  // Seed if needed
  try {
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();
    prisma.user.count().then(async (count) => {
      if (count === 0) {
        console.log('[Vista Chase Production Startup] Fresh database detected. Seeding initial catalog and operations data...');
        execSync('node -r dotenv/config prisma/seed.js', { stdio: 'inherit', cwd: backendDir });
      } else {
        console.log(`[Vista Chase Production Startup] Database already populated (${count} users found). Skipping seed.`);
      }
      await prisma.$disconnect();
      startServer();
    }).catch(async (err) => {
      console.warn('[Vista Chase Production Startup] User check warning, running seed just in case:', err.message);
      try {
        execSync('node -r dotenv/config prisma/seed.js', { stdio: 'inherit', cwd: backendDir });
      } catch (seedErr) {
        console.warn('Seed execution notice:', seedErr.message);
      }
      startServer();
    });
  } catch (dbErr) {
    console.warn('[Vista Chase Production Startup] Direct check skipped:', dbErr.message);
    startServer();
  }
} catch (err) {
  console.error('[Vista Chase Production Startup] Startup preparation error:', err);
  startServer();
}

function startServer() {
  console.log('[Vista Chase Production Startup] Starting Express application server...');
  require('../dist/server.js');
}
