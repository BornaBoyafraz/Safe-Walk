import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Safe Walk',
    short_name: 'Safe Walk',
    description: 'Pedestrian safety intelligence for Toronto.',
    start_url: '/',
    display: 'standalone',
    background_color: '#090a0c',
    theme_color: '#090a0c',
    icons: [
      { src: '/favicon.svg', sizes: 'any', type: 'image/svg+xml' },
      { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml' },
      { src: '/apple-icon', sizes: '180x180', type: 'image/png' },
    ],
  };
}
