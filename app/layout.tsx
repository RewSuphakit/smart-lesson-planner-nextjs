import type { Metadata, Viewport } from 'next';
import { IBM_Plex_Sans_Thai, Inter } from 'next/font/google';
import './globals.css';
import { Toaster as HotToaster } from 'react-hot-toast';
import { Toaster as SonnerToaster } from 'sonner';
import { AuthProvider } from '@/context/AuthContext';
import QueryProvider from '@/components/QueryProvider';
import { SemesterProvider } from '@/context/SemesterContext';
import { Analytics } from '@vercel/analytics/next';
import { SpeedInsights } from '@vercel/speed-insights/next';

const ibmPlexSansThai = IBM_Plex_Sans_Thai({
  weight: ['300', '400', '500', '600', '700'],
  subsets: ['thai', 'latin'],
  display: 'swap',
  variable: '--font-ibm-plex-sans-thai',
});

const inter = Inter({
  weight: ['300', '400', '500', '600', '700', '800'],
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
});

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: '#6366f1',
};

export const metadata: Metadata = {
  title: 'Smart Lesson Planner — ระบบวางแผนการสอนอัจฉริยะ',
  description: 'ระบบวางแผนการสอนอัจฉริยะด้วย AI สำหรับครูและผู้สอน',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="th" className={`h-full antialiased ${ibmPlexSansThai.variable} ${inter.variable}`}>
      <body className="min-h-full flex flex-col">
        <QueryProvider>
          <AuthProvider>
            <SemesterProvider>
              <HotToaster
                position="top-right"
                toastOptions={{
                  style: {
                    background: '#ffffff',
                    color: '#334155',
                    border: '1px solid rgba(165, 180, 252, 0.4)',
                    borderRadius: '12px',
                    boxShadow: '0 4px 12px rgba(99, 102, 241, 0.08)',
                  },
                  success: { iconTheme: { primary: '#10b981', secondary: '#fff' } },
                  error: { iconTheme: { primary: '#ef4444', secondary: '#fff' } },
                }}
              />
              <SonnerToaster richColors position="top-right" closeButton />
              {children}
              <Analytics />
              <SpeedInsights />
            </SemesterProvider>
          </AuthProvider>
        </QueryProvider>
      </body>
    </html>
  );
}

