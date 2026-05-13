import type { Metadata } from 'next';
import { Toaster } from 'sonner';
import { AdminShell } from '../components/admin-shell';
import './globals.css';

export const metadata: Metadata = {
  title: 'Admin ERP - Absolute Assobio',
  description: 'Painel administrativo operacional do Absolute Assobio',
  robots: {
    index: false,
    follow: false,
  },
  icons: {
    icon: '/favicon.png',
    shortcut: '/favicon.png',
    apple: '/logo.png',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="min-h-screen">
        <AdminShell>{children}</AdminShell>
        <Toaster position="top-center" richColors />
      </body>
    </html>
  );
}
