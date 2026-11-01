const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  // The password comes from the environment, not the command line, so it never lands in shell
  // history or the process list:  ADMIN_PASSWORD='…' node scripts/create-admin.js admin@vistachase.com
  // An email that already has a (guest) account: add --promote to make it an admin with this
  // password; its other sign-ins end.
  const args = process.argv.slice(2);
  const promote = args.includes('--promote');
  const email = (args.find((a) => !a.startsWith('--')) || '').trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD || '';

  if (!email || !password) {
    console.error("Usage: ADMIN_PASSWORD='<password>' node scripts/create-admin.js <email> [--promote]");
    process.exit(1);
  }
  if (password.length < 12) {
    console.error('Use an admin password of at least 12 characters.');
    process.exit(1);
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  const passwordHash = await bcrypt.hash(password, 10);
  if (existing) {
    if (!promote) {
      console.error(`User ${email} already exists (role ${existing.role}). Add --promote to make it an admin with this password.`);
      process.exit(1);
    }
    await prisma.user.update({
      where: { id: existing.id },
      data: { role: 'ADMIN', passwordHash, emailVerified: true, failedLoginAttempts: 0, lockedUntil: null, sessionsValidAfter: new Date() },
    });
    console.log(`✅ ${email} is now an admin (was ${existing.role}). Sign in at /admin/login.`);
    return;
  }
  
  await prisma.user.create({
    data: {
      email,
      passwordHash,
      name: 'Initial Admin',
      role: 'ADMIN',
    },
  });
  
  console.log(`✅ Admin user ${email} created successfully. Sign in at /admin/login.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
