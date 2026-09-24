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
            key: 'X-DNS-Prefetch-Control',
            value: 'on',
          },
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), browsing-topics=()',
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains',
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
