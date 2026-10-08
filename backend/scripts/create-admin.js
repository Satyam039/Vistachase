const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  const email = process.argv[2];
  const password = process.argv[3];
  
  if (!email || !password) {
    console.error('Usage: node scripts/create-admin.js <email> <password>');
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
