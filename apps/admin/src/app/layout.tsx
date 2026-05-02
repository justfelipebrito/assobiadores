import type { Metadata } from 'next';
import { Toaster } from 'sonner';
import { AdminShell } from '../components/admin-shell';
import './globals.css';

export const metadata: Metadata = {
  title: 'Admin - Batalha de Assobio',
  description: 'Painel administrativo',
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
