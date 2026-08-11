import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  output: 'standalone',
  outputFileTracingRoot: path.join(__dirname),
  serverExternalPackages: ['bcryptjs', 'jsonwebtoken', 'pdfkit', 'pdf-parse'],
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' },
    ],
  },
  async rewrites() {
    return [
      { source: '/api/grades/criteria/:classroomId', destination: '/api/grades?classroom_id=:classroomId&type=criteria' },
      { source: '/api/grades/report/:classroomId', destination: '/api/grades?classroom_id=:classroomId' },
      { source: '/api/scores/structure/:classroomId', destination: '/api/scores?classroom_id=:classroomId&type=structure' },
      { source: '/api/scores/structure', destination: '/api/scores?type=structure' },
      { source: '/api/scores/student/:classroomId/:lessonNumber', destination: '/api/scores?classroom_id=:classroomId&lesson_number=:lessonNumber' },
      { source: '/api/scores/student', destination: '/api/scores' },
      { source: '/api/scores/bulk-import', destination: '/api/scores' },
      { source: '/api/attendance/stats/:classroomId', destination: '/api/attendance?classroom_id=:classroomId' },
      { source: '/api/attendance/history/:studentId', destination: '/api/attendance?student_id=:studentId' },
      { source: '/api/files/upload', destination: '/api/files' },
      { source: '/api/timetable/clear', destination: '/api/timetable' },
    ];
  },
};

export default nextConfig;
