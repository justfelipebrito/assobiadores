import type { Metadata, Viewport } from 'next';
import { Toaster } from 'sonner';
import { AdsensePublisherScript } from '@/components/ads/adsense-publisher-script';
import { BottomAdBanner } from '@/components/ads/bottom-ad-banner';
import { GoogleAnalytics } from '@/components/analytics/google-analytics';
import { Header } from '@/components/layout/header';
import { Footer } from '@/components/layout/footer';
import { QualifierRegistrationNotice } from '@/components/qualifiers/qualifier-registration-notice';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'A casa do assobiador',
    template: '%s | A casa do assobiador',
  },
  description: 'A casa do assobiador: competicoes, rankings e destaques de assobio no Brasil.',
  icons: {
    icon: '/favicon.png',
    shortcut: '/favicon.png',
    apple: '/logo.png',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#0f172a',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className="dark">
      <head>
        <AdsensePublisherScript />
      </head>
      <body className="flex min-h-screen flex-col">
        <GoogleAnalytics />
        <Header />
        <main className="flex-1">{children}</main>
        <Footer />
        <BottomAdBanner />
        <QualifierRegistrationNotice />
        <Toaster
          position="top-center"
          richColors
          theme="dark"
          toastOptions={{
            style: {
              background: 'rgba(30, 41, 59, 0.95)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              color: '#fff',
              backdropFilter: 'blur(12px)',
            },
          }}
        />
      </body>
    </html>
  );
}
