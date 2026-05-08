import { ImageResponse } from 'next/og';

export const alt = 'Safe Walk — Pedestrian Safety Intelligence';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OGImage() {
  return new ImageResponse(
    (
      <div
        style={{
          background: '#090a0c',
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          position: 'relative',
        }}
      >
        {/* Subtle grid */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage:
              'linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)',
            backgroundSize: '52px 52px',
          }}
        />

        {/* Twin Path mark */}
        <svg width="88" height="88" viewBox="0 0 24 24" fill="none">
          <path d="M 4 20 C 9 20 15 18 20 17" stroke="#e4e4e7" strokeWidth="1.75" strokeLinecap="round" />
          <path d="M 4 20 C 8 19 13 7 20 4" stroke="#e4e4e7" strokeWidth="1.75" strokeLinecap="round" />
          <circle cx="4" cy="20" r="1.75" fill="#e4e4e7" />
          <circle cx="20" cy="17" r="1.4" fill="#e4e4e7" fillOpacity={0.5} />
          <circle cx="20" cy="4" r="1.75" fill="#2fb872" />
        </svg>

        {/* Wordmark */}
        <div
          style={{
            color: '#f0f0f2',
            fontSize: 56,
            fontWeight: 600,
            letterSpacing: '-0.02em',
            marginTop: 24,
          }}
        >
          Safe Walk
        </div>

        {/* Tagline */}
        <div
          style={{
            color: 'rgba(240, 240, 242, 0.48)',
            fontSize: 22,
            marginTop: 14,
            letterSpacing: '-0.01em',
          }}
        >
          Pedestrian safety intelligence for Toronto.
        </div>

        {/* Bottom-right badge */}
        <div
          style={{
            position: 'absolute',
            bottom: 44,
            right: 64,
            display: 'flex',
            alignItems: 'center',
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.09)',
            borderRadius: 999,
            padding: '6px 16px',
            color: 'rgba(240,240,242,0.38)',
            fontSize: 14,
            letterSpacing: '-0.005em',
          }}
        >
          TKS Moonshot 2026
        </div>

        {/* Top-left safe-green accent line */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: 2,
            background: 'linear-gradient(90deg, transparent, #2fb872 40%, transparent)',
            opacity: 0.6,
          }}
        />
      </div>
    ),
    { ...size },
  );
}
