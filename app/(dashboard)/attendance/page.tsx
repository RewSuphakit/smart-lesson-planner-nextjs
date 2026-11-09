import AttendancePage from '@/components/pages/Attendance';
import { getServerSession, getServerClassrooms } from '@/lib/server-session';
import type { Classroom } from '@/components/pages/attendance/types';

export default async function AttendanceRoutePage() {
  const { user } = await getServerSession();
  const initialClassrooms = user ? ((await getServerClassrooms(user.id)) as unknown as Classroom[]) : [];

  return <AttendancePage initialClassrooms={initialClassrooms} />;
}
