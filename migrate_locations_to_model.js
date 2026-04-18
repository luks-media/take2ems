const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany();
  const equipment = await prisma.equipment.findMany();

  let locationsMap = new Map();

  // Create a default location for each user with equipments
  for (const item of equipment) {
    if (item.location && item.location !== '') {
      const userName = item.location;
      const matchedUser = users.find(u => u.name.toLowerCase() === userName.toLowerCase());
      
      if (matchedUser) {
        if (!locationsMap.has(matchedUser.id)) {
          // Create or find location
          let loc = await prisma.location.findFirst({
            where: { name: userName, userId: matchedUser.id }
          });
          if (!loc) {
            loc = await prisma.location.create({
              data: {
                name: userName,
                userId: matchedUser.id
              }
            });
            console.log(`Created Location '${loc.name}' for user ${matchedUser.name}`);
          }
          locationsMap.set(matchedUser.id, loc.id);
        }
        
        await prisma.equipment.update({
          where: { id: item.id },
          data: { locationId: locationsMap.get(matchedUser.id) }
        });
        console.log(`Updated ${item.name} locationId to ${locationsMap.get(matchedUser.id)}`);
      }
    }
  }

  console.log('Migration complete.');
}
main().catch(console.error).finally(() => prisma.$disconnect());
