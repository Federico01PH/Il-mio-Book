import type { Metadata } from 'next';
import { Toaster } from 'sonner';
import { env } from '../lib/env';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: env.siteName,
    template: `%s · ${env.siteName}`
  },
  description: 'Portfolio fotografico minimal con accesso su invito.',
  robots: { index: false, follow: false }
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="it">
      <body>
        {children}
        <Toaster position="top-center" theme="dark" richColors />
      </body>
    </html>
  );
}
