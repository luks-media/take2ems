const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany();
  const equipment = await prisma.equipment.findMany();
  
  let updatedCount = 0;
  for (const item of equipment) {
    if (item.location && item.location.startsWith('c') && item.location.length > 20) {
      const matchedUser = users.find(u => u.id === item.location);
      if (matchedUser) {
        await prisma.equipment.update({
          where: { id: item.id },
          data: { location: matchedUser.name }
        });
        updatedCount++;
      }
    }
  }
  console.log(`Reverse migration complete. Updated ${updatedCount} records.`);
}
main().catch(console.error).finally(() => prisma.$disconnect());
