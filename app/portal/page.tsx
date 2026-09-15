import StudentPortal from '@/components/pages/StudentPortal';
import { Metadata } from 'next';
import { Suspense } from 'react';

export const metadata: Metadata = {
  title: 'ตรวจสอบผลการเรียนและเวลาเรียน · Smart Lesson Planner',
  description: 'ระบบตรวจสอบผลการเรียน คะแนนเก็บ งานค้าง และเวลาเรียนสำหรับนักเรียนและผู้ปกครอง',
};

export default function StudentPortalPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-slate-500 text-sm">กำลังโหลดพอร์ทัล...</div>
      </div>
    }>
      <StudentPortal />
    </Suspense>
  );
}
