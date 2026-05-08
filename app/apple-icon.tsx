import { ImageResponse } from 'next/og';

export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          background: '#090a0c',
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 40,
        }}
      >
        <svg width="96" height="96" viewBox="0 0 24 24" fill="none">
          <path d="M 4 20 C 9 20 15 18 20 17" stroke="#e4e4e7" strokeWidth="1.75" strokeLinecap="round" />
          <path d="M 4 20 C 8 19 13 7 20 4" stroke="#e4e4e7" strokeWidth="1.75" strokeLinecap="round" />
          <circle cx="4" cy="20" r="1.75" fill="#e4e4e7" />
          <circle cx="20" cy="17" r="1.4" fill="#e4e4e7" fillOpacity={0.5} />
          <circle cx="20" cy="4" r="1.75" fill="#2fb872" />
        </svg>
      </div>
    ),
    { ...size },
  );
}
