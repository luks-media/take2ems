const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany();
  const equipment = await prisma.equipment.findMany();
  
  let updatedCount = 0;
  for (const item of equipment) {
    if (item.location && item.location !== '') {
      // If it's already an ID (starts with c, typical for cuid), skip
      if (item.location.startsWith('c') && item.location.length > 20) continue;
      
      const matchedUser = users.find(u => u.name.toLowerCase() === item.location.toLowerCase());
      if (matchedUser) {
        await prisma.equipment.update({
          where: { id: item.id },
          data: { location: matchedUser.id }
        });
        updatedCount++;
        console.log(`Updated ${item.name}: ${item.location} -> ${matchedUser.name} (${matchedUser.id})`);
      } else {
        console.log(`No user matched for location: ${item.location} in equipment ${item.name}`);
      }
    }
  }
  console.log(`Migration complete. Updated ${updatedCount} records.`);
}
main().catch(console.error).finally(() => prisma.$disconnect());
