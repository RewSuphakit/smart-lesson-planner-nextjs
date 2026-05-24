const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const classrooms = await prisma.classroom.findMany();
  console.log('Classrooms in DB:');
  classrooms.forEach(c => {
    console.log(`ID: ${c.id}, Name: ${c.name}, totalClasses: ${c.totalClasses}`);
  });
  
  const scoreStructures = await prisma.scoreStructure.findMany();
  console.log('\nScore Structures Count per Classroom:');
  const counts = {};
  scoreStructures.forEach(s => {
    counts[s.classroomId] = (counts[s.classroomId] || 0) + 1;
  });
  console.log(counts);
}

main().catch(console.error).finally(() => prisma.$disconnect());
