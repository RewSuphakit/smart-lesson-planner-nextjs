import type { Metadata } from 'next';
import './globals.css';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from '@/context/AuthContext';
import QueryProvider from '@/components/QueryProvider';
import { Analytics } from '@vercel/analytics/next';

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
    <html lang="th" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <QueryProvider>
          <AuthProvider>
            <Toaster
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
            {children}
            <Analytics />
          </AuthProvider>
        </QueryProvider>
        <Analytics />
      </body>
    </html>
  );
}

