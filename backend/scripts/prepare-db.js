const path = require('path');
const { execSync } = require('child_process');

console.log('[DB Init] Database is fixed to PostgreSQL. Dynamic schema rewriting removed.');

// Generate client
console.log('[DB Init] Generating Prisma client...');
execSync('npx prisma generate', { stdio: 'inherit', cwd: path.join(__dirname, '..') });
