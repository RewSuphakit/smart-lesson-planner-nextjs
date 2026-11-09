import ClassroomsPage, { type Classroom } from '@/components/pages/Classrooms';
import { getServerSession, getServerClassrooms } from '@/lib/server-session';

export default async function ClassroomsRoutePage() {
  const { user } = await getServerSession();
  const initialClassrooms = user ? ((await getServerClassrooms(user.id)) as unknown as Classroom[]) : [];

  return <ClassroomsPage initialClassrooms={initialClassrooms} />;
}
