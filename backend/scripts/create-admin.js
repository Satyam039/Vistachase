const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  // The password comes from the environment, not the command line, so it never lands in shell
  // history or the process list:  ADMIN_PASSWORD='…' node scripts/create-admin.js admin@vistachase.com
  const email = (process.argv[2] || '').trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD || '';

  if (!email || !password) {
    console.error("Usage: ADMIN_PASSWORD='<password>' node scripts/create-admin.js <email>");
    process.exit(1);
  }
  if (password.length < 12) {
    console.error('Use an admin password of at least 12 characters.');
    process.exit(1);
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.error(`User ${email} already exists.`);
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(password, 10);
  
  await prisma.user.create({
    data: {
      email,
      passwordHash,
      name: 'Initial Admin',
      role: 'ADMIN',
    },
  });
  
  console.log(`✅ Admin user ${email} created successfully.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
