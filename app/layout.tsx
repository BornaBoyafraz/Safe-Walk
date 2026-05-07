import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Safe Walk — Pedestrian Safety Intelligence',
  description:
    'Navigate Toronto with confidence. Safe Walk finds the safest walking route using real crime data, streetlight coverage, and community reports.',
  openGraph: {
    title: 'Safe Walk',
    description: 'Pedestrian safety intelligence for Toronto.',
    type: 'website',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-background font-sans antialiased">
        {children}
      </body>
    </html>
  );
}
