import type { Metadata, Viewport } from 'next';
import { Toaster } from 'sonner';
import { AdsensePublisherScript } from '@/components/ads/adsense-publisher-script';
import { BottomAdBanner } from '@/components/ads/bottom-ad-banner';
import { GoogleAnalytics } from '@/components/analytics/google-analytics';
import { ReferralAttributionCapture } from '@/components/analytics/referral-attribution-capture';
import { Header } from '@/components/layout/header';
import { Sidebar } from '@/components/layout/sidebar';
import { Footer } from '@/components/layout/footer';
import { QualifierRegistrationNotice } from '@/components/qualifiers/qualifier-registration-notice';
import { PUBLIC_FAVICON_SRC, PUBLIC_LOGO_ICON_SRC } from '@/lib/public-assets';
import { PUBLIC_BRAND_DESCRIPTION, PUBLIC_BRAND_NAME } from '@/lib/public-brand';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: PUBLIC_BRAND_NAME,
    template: `%s | ${PUBLIC_BRAND_NAME}`,
  },
  description: PUBLIC_BRAND_DESCRIPTION,
  icons: {
    icon: PUBLIC_FAVICON_SRC,
    shortcut: PUBLIC_FAVICON_SRC,
    apple: PUBLIC_LOGO_ICON_SRC,
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
      <body className="min-h-screen">
        <GoogleAnalytics />
        <ReferralAttributionCapture />
        <Header />
        <Sidebar />
        <div className="flex min-h-screen flex-col lg:pl-56">
          <main className="flex-1">{children}</main>
          <Footer />
        </div>
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
