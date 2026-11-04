import type { Metadata, Viewport } from 'next';
import { Sarabun } from 'next/font/google';
import './globals.css';
import { Toaster as HotToaster } from 'react-hot-toast';

import { AuthProvider } from '@/context/AuthContext';
import QueryProvider from '@/components/QueryProvider';
import { SemesterProvider } from '@/context/SemesterContext';
import { ThemeProvider } from '@/context/ThemeContext';
import { Analytics } from '@vercel/analytics/next';
import { SpeedInsights } from '@vercel/speed-insights/next';
import { getServerSession } from '@/lib/server-session';
import PwaRegister from '@/components/PwaRegister';

const sarabun = Sarabun({
  weight: ['400', '500', '600', '700'],
  subsets: ['thai', 'latin'],
  display: 'swap',
  variable: '--font-sarabun',
});

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: '#6366f1',
};

export const metadata: Metadata = {
  title: 'Smart Lesson Planner — ระบบวางแผนการสอนอัจฉริยะ',
  description: 'ระบบวางแผนการสอน เช็คชื่อ ตัดเกรด และรายงานผลการเรียนรู้สำหรับครูไทย',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'SmartPlanner',
  },
  icons: {
    icon: [
      { url: '/icon.png', sizes: '192x192', type: 'image/png' },
      { url: '/favicon.ico', sizes: 'any' },
    ],
    apple: [
      { url: '/apple-icon.png', sizes: '180x180', type: 'image/png' },
    ],
  },
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user: initialUser, semesters: initialSemesters } = await getServerSession();

  return (
    <html lang="th" className={`h-full antialiased ${sarabun.variable}`} suppressHydrationWarning>
      <head suppressHydrationWarning>
        <script
          suppressHydrationWarning
          dangerouslySetInnerHTML={{
            __html: `(function() {
              try {
                var t = localStorage.getItem('smart_planner_theme');
                var d = window.matchMedia('(prefers-color-scheme: dark)').matches;
                if (t === 'dark' || (!t && d)) {
                  document.documentElement.classList.add('dark');
                  document.documentElement.style.colorScheme = 'dark';
                } else {
                  document.documentElement.classList.remove('dark');
                  document.documentElement.style.colorScheme = 'light';
                }
              } catch (e) {}
            })();`,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        <QueryProvider>
          <AuthProvider initialUser={initialUser}>
            <SemesterProvider initialSemesters={initialSemesters}>
              <ThemeProvider>
                <HotToaster
                  position="top-right"
                  toastOptions={{
                    style: {
                      background: 'var(--toast-bg, #ffffff)',
                      color: 'var(--toast-color, #334155)',
                      border: '1px solid var(--toast-border, rgba(165, 180, 252, 0.4))',
                      borderRadius: '12px',
                      boxShadow: '0 4px 12px rgba(99, 102, 241, 0.08)',
                    },
                    success: { iconTheme: { primary: '#10b981', secondary: '#fff' } },
                    error: { iconTheme: { primary: '#ef4444', secondary: '#fff' } },
                  }}
                />

                <PwaRegister />
                {children}
                <Analytics />
                <SpeedInsights />
              </ThemeProvider>
            </SemesterProvider>
          </AuthProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
