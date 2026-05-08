'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

interface SafetyMeterProps {
  score: number; // 0–100
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  animate?: boolean;
}

function scoreColor(score: number) {
  if (score >= 70) return 'var(--safe)';
  if (score >= 40) return 'oklch(0.78 0.16 80)'; // amber
  return 'var(--danger)';
}

function scoreLabel(score: number) {
  if (score >= 80) return 'Very safe';
  if (score >= 65) return 'Safe';
  if (score >= 45) return 'Moderate';
  if (score >= 30) return 'Use caution';
  return 'High risk';
}

const sizeMap = {
  sm: { r: 28, strokeW: 3, fontSize: 'text-sm' },
  md: { r: 38, strokeW: 4, fontSize: 'text-base' },
  lg: { r: 52, strokeW: 5, fontSize: 'text-lg' },
};

export function SafetyMeter({ score, size = 'md', className, animate = true }: SafetyMeterProps) {
  const [displayed, setDisplayed] = useState(animate ? 0 : score);

  useEffect(() => {
    if (!animate) { setDisplayed(score); return; }
    const start = performance.now();
    const duration = 900;
    const from = displayed;

    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplayed(Math.round(from + (score - from) * eased));
      if (t < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [score]);

  const { r, strokeW, fontSize } = sizeMap[size];
  const circumference = 2 * Math.PI * r;
  const dash = (displayed / 100) * circumference;
  const gap  = circumference - dash;
  const svgSize = (r + strokeW + 4) * 2;
  const center  = svgSize / 2;
  const color   = scoreColor(score);

  return (
    <div
      className={cn('flex flex-col items-center gap-1', className)}
      role="img"
      aria-label={`Safety score: ${displayed}% — ${scoreLabel(score)}`}
    >
      <svg width={svgSize} height={svgSize} className="-rotate-90" aria-hidden="true">
        <circle
          cx={center} cy={center} r={r}
          fill="none"
          stroke="oklch(1 0 0 / 6%)"
          strokeWidth={strokeW}
        />
        <circle
          cx={center} cy={center} r={r}
          fill="none"
          stroke={color}
          strokeWidth={strokeW}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${gap}`}
          style={{
            transition: 'stroke-dasharray 0.6s cubic-bezier(0.22, 1, 0.36, 1)',
            filter: `drop-shadow(0 0 6px ${color}80)`,
          }}
        />
      </svg>
      <div className="flex flex-col items-center -mt-1">
        <span className={cn('font-mono font-semibold leading-none', fontSize)} style={{ color }}>
          {displayed}%
        </span>
        <span className="text-xs text-muted-foreground mt-0.5">{scoreLabel(score)}</span>
      </div>
    </div>
  );
}
