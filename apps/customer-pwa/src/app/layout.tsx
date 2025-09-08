import type { Metadata } from 'next';
import '../styles/globals.css';
import { InstallPrompt } from '../components/InstallPrompt';
import { usePWAInstall } from '../components/usePWAInstall';
import { useServiceWorkerUpdate } from '../components/useServiceWorkerUpdate';
import { UpdateToast } from '../components/UpdateToast';
import { ClientLayout } from './client-layout';

export const metadata: Metadata = {
  title: 'AI Feedback Platform',
  description: 'Share your voice, earn cashback rewards',
  themeColor: '#2563eb',
  viewport: {
    width: 'device-width',
    initialScale: 1,
    maximumScale: 1,
    userScalable: false,
    viewportFit: 'cover',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Feedback',
  },
  formatDetection: {
    telephone: false,
  },
  other: {
    'mobile-web-app-capable': 'yes',
    'apple-touch-fullscreen': 'yes',
    'mobile-web-app-status-bar-style': 'default',
    'mobile-web-app-title': 'Feedback',
    'msapplication-tap-highlight': 'no',
  },
  icons: {
    icon: [
      { url: '/icons/icon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/icons/icon-32x32.png', sizes: '32x32', type: 'image/png' },
    ],
    apple: [
      { url: '/icons/icon-152x152.png', sizes: '152x152' },
      { url: '/icons/icon-180x180.png', sizes: '180x180' },
    ],
  },
  manifest: '/manifest.json',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="sv">
      <head>
        {/* Preconnect to API */}
        <link rel="preconnect" href="https://ai-feedback-api-gateway-production-352e.up.railway.app" />
        <link rel="dns-prefetch" href="https://ai-feedback-api-gateway-production-352e.up.railway.app" />
        {/* iOS startup image */}
        <link rel="apple-touch-startup-image" href="/icons/icon-512x512.png" />
      </head>
      <body>
        <ClientLayout>
          {children}
        </ClientLayout>
      </body>
    </html>
  );
}