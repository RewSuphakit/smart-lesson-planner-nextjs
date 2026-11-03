import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Smart Lesson Planner — ระบบวางแผนการสอนอัจฉริยะ',
    short_name: 'SmartPlanner',
    description: 'ระบบวางแผนการสอน เช็คชื่อ ตัดเกรด และรายงานผลการเรียนรู้สำหรับครูไทย',
    start_url: '/',
    id: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#f8fafc',
    theme_color: '#6366f1',
    lang: 'th',
    orientation: 'portrait-primary',
    icons: [
      {
        src: '/icon.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/logo.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}

