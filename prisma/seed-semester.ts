/**
 * Semester Migration Script
 * 
 * Creates a default "ภาคเรียนที่ 1" semester for each user that has classrooms,
 * and assigns all existing classrooms and weekly schedules to it.
 * 
 * Usage: npx tsx prisma/seed-semester.ts
 */

import { PrismaClient, CurriculumType } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🔄 Starting semester migration...\n');

  // Get all users who have at least one classroom
  const usersWithClassrooms = await prisma.user.findMany({
    where: {
      classrooms: { some: {} },
    },
    select: {
      id: true,
      name: true,
    },
  });

  console.log(`Found ${usersWithClassrooms.length} users with classrooms\n`);

  let totalSemestersCreated = 0;
  let totalClassroomsUpdated = 0;
  let totalTimetablesUpdated = 0;

  for (const user of usersWithClassrooms) {
    // Check if user already has semesters
    const existingSemester = await prisma.semester.findFirst({
      where: { userId: user.id },
    });

    if (existingSemester) {
      console.log(`  ⏭️  User "${user.name}" (id=${user.id}) already has semesters, skipping...`);
      continue;
    }

    // Get the user's first classroom to determine curriculum type and dates
    const firstClassroom = await prisma.classroom.findFirst({
      where: { userId: user.id },
      orderBy: { createdAt: 'asc' },
    });

    const curriculumType = firstClassroom?.curriculumType || CurriculumType.pvch;
    const totalWeeks = firstClassroom?.totalWeeks || (curriculumType === 'pvs' ? 15 : 18);
    const startDate = firstClassroom?.semesterStartDate || null;

    // Determine academic year (Thai Buddhist calendar)
    const now = new Date();
    const thaiYear = now.getFullYear() + 543;
    // If we're past May, it's the start of a new academic year in Thai system
    const academicYear = now.getMonth() >= 4 ? String(thaiYear) : String(thaiYear - 1);

    // Create default semester
    const semester = await prisma.semester.create({
      data: {
        userId: user.id,
        name: `ภาคเรียนที่ 1/${academicYear}`,
        termNumber: 1,
        academicYear,
        startDate,
        isActive: true,
        curriculumType,
        totalWeeks,
      },
    });

    totalSemestersCreated++;
    console.log(`  ✅ Created semester "${semester.name}" for user "${user.name}"`);

    // Assign all unassigned classrooms to this semester
    const classroomUpdateResult = await prisma.classroom.updateMany({
      where: {
        userId: user.id,
        semesterId: null,
      },
      data: {
        semesterId: semester.id,
      },
    });
    totalClassroomsUpdated += classroomUpdateResult.count;
    console.log(`     📚 Assigned ${classroomUpdateResult.count} classrooms`);

    // Assign all unassigned weekly schedules to this semester
    const timetableUpdateResult = await prisma.weeklySchedule.updateMany({
      where: {
        userId: user.id,
        semesterId: null,
      },
      data: {
        semesterId: semester.id,
      },
    });
    totalTimetablesUpdated += timetableUpdateResult.count;
    console.log(`     📅 Assigned ${timetableUpdateResult.count} timetable entries`);
  }

  console.log('\n' + '='.repeat(50));
  console.log('📊 Migration Summary:');
  console.log(`   Semesters created: ${totalSemestersCreated}`);
  console.log(`   Classrooms assigned: ${totalClassroomsUpdated}`);
  console.log(`   Timetable entries assigned: ${totalTimetablesUpdated}`);
  console.log('='.repeat(50));
  console.log('\n✅ Semester migration complete!');
}

main()
  .catch((e) => {
    console.error('❌ Migration failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
