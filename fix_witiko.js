const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany();
  const wititko = users.find(u => u.name === 'Wititko');
  if (wititko) {
    const updated = await prisma.equipment.updateMany({
      where: { location: 'Witiko' },
      data: { location: wititko.id }
    });
    console.log(`Updated ${updated.count} records for Witiko.`);
  }
}
main().catch(console.error).finally(() => prisma.$disconnect());
