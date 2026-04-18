const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany();
  const equipment = await prisma.equipment.findMany({
    select: { id: true, name: true, location: true }
  });
  console.log('Users:', users.map(u => ({id: u.id, name: u.name})));
  console.log('Equipment locations:', equipment.filter(e => e.location !== null).map(e => ({id: e.id, name: e.name, location: e.location})));
}
main().catch(console.error).finally(() => prisma.$disconnect());
