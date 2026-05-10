import type { Metadata, Viewport } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

const mono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
});

export const viewport: Viewport = {
  themeColor: '#090a0c',
};

export const metadata: Metadata = {
  title: 'Safe Walk — Pedestrian Safety Intelligence',
  description:
    'Navigate Toronto with confidence. Safe Walk compares walking route alternatives with incident data, streetlight coverage, and community reports.',
  manifest: '/manifest.webmanifest',
  icons: {
    icon: [{ url: '/favicon.svg?v=2', type: 'image/svg+xml', sizes: 'any' }],
    shortcut: [{ url: '/favicon.svg?v=2', type: 'image/svg+xml' }],
    apple: [{ url: '/apple-icon', sizes: '180x180', type: 'image/png' }],
  },
  openGraph: {
    title: 'Safe Walk — Pedestrian Safety Intelligence',
    description: 'Pedestrian safety intelligence for Toronto.',
    type: 'website',
    images: [{ url: '/opengraph-image', width: 1200, height: 630, alt: 'Safe Walk' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Safe Walk — Pedestrian Safety Intelligence',
    description: 'Pedestrian safety intelligence for Toronto.',
    images: ['/opengraph-image'],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`dark ${inter.variable} ${mono.variable}`}>
      <body className="min-h-screen bg-background font-sans antialiased">
        {children}
      </body>
    </html>
  );
}
