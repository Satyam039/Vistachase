const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const schemaPath = path.join(__dirname, '..', 'prisma', 'schema.prisma');
let schema = fs.readFileSync(schemaPath, 'utf8');

const dbUrl = process.env.DATABASE_URL || '';
const isPostgres = dbUrl.startsWith('postgres://') || dbUrl.startsWith('postgresql://');

console.log(`[DB Init] DATABASE_URL detected: ${isPostgres ? 'PostgreSQL' : 'SQLite'}`);

if (isPostgres) {
  if (schema.includes('provider = "sqlite"')) {
    console.log('[DB Init] Switching Prisma datasource provider from sqlite to postgresql...');
    schema = schema.replace('provider = "sqlite"', 'provider = "postgresql"');
    fs.writeFileSync(schemaPath, schema, 'utf8');
  }
} else {
  if (schema.includes('provider = "postgresql"')) {
    console.log('[DB Init] Switching Prisma datasource provider from postgresql to sqlite...');
    schema = schema.replace('provider = "postgresql"', 'provider = "sqlite"');
    fs.writeFileSync(schemaPath, schema, 'utf8');
  }
}

// Generate client
console.log('[DB Init] Generating Prisma client...');
execSync('npx prisma generate', { stdio: 'inherit', cwd: path.join(__dirname, '..') });
