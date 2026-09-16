import type { Metadata } from 'next';
import NotFoundContent from '@/components/NotFoundContent';

export const metadata: Metadata = {
  title: '404 - ไม่พบหน้าเว็บ | Smart Lesson Planner',
  description: 'ขออภัย หน้าเว็บที่คุณกำลังเข้าถึงไม่มีอยู่ในระบบ Smart Lesson Planner',
};

export default function NotFound() {
  return <NotFoundContent />;
}
