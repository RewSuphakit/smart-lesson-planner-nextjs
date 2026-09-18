import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  output: 'standalone',
  outputFileTracingRoot: path.join(__dirname),
  compress: true,
  poweredByHeader: false,
  allowedDevOrigins: ['192.168.56.1'],
  serverExternalPackages: ['bcryptjs', 'jsonwebtoken', 'pdfkit', 'pdf-parse', 'nodemailer'],
  experimental: {
    optimizePackageImports: [
      'lucide-react',
      'date-fns',
      '@tanstack/react-query',
      'sonner',
      'react-hot-toast',
      'axios',
    ],
  },
  images: {
    formats: ['image/avif', 'image/webp'],
    remotePatterns: [
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' },
    ],
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Cross-Origin-Opener-Policy',
            value: 'same-origin-allow-popups',
          },
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on',
          },
        ],
      },
      {
        source: '/_next/static/(.*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
    ];
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
