import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('--- WEEKLY SCHEDULES ---');
  const weekly = await prisma.weeklySchedule.findMany({});
  console.log(`Total weekly schedules: ${weekly.length}`);
  console.log(JSON.stringify(weekly, null, 2));

  console.log('--- SCHEDULES ---');
  const schedules = await prisma.schedule.findMany({});
  console.log(`Total schedules: ${schedules.length}`);
  console.log(JSON.stringify(schedules.slice(0, 5), null, 2));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
