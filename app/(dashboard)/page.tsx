import DashboardClient from '@/components/pages/DashboardClient';
import { getServerSession, getServerDashboardData } from '@/lib/server-session';

export default async function DashboardPage() {
  const { user } = await getServerSession();
  const initialData = user ? await getServerDashboardData(user.id) : null;

  return <DashboardClient initialData={initialData} />;
}
