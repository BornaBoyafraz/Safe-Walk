'use client';

import { cn } from '@/lib/utils';
import { Clock, MapPin, Shield, Zap } from 'lucide-react';
import { SafetyMeter } from './safety-meter';

interface RouteCardProps {
  type: 'safest' | 'fastest';
  durationMin: number;
  distanceKm: number;
  safetyScore: number; // 0–100
  active?: boolean;
  onClick?: () => void;
}

function formatDuration(min: number) {
  if (min < 60) return `${min} min`;
  return `${Math.floor(min / 60)}h ${min % 60}m`;
}

function formatDistance(km: number) {
  return km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`;
}

export function RouteCard({ type, durationMin, distanceKm, safetyScore, active, onClick }: RouteCardProps) {
  const isSafest = type === 'safest';

  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full rounded-xl border p-4 text-left transition-all duration-200',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        active
          ? 'border-border/40 bg-card shadow-[0_0_0_1px_oklch(1_0_0/8%)] ring-1 ring-inset ring-white/5'
          : 'border-border/20 bg-card/40 hover:bg-card/60 opacity-60 hover:opacity-80',
      )}
      aria-pressed={active}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          {isSafest
            ? <Shield className="h-4 w-4 shrink-0" style={{ color: 'var(--safe)' }} />
            : <Zap    className="h-4 w-4 shrink-0 text-blue-400" />
          }
          <span className="text-sm font-medium text-foreground">
            {isSafest ? 'Safest route' : 'Fastest route'}
          </span>
        </div>
        {active && <SafetyMeter score={safetyScore} size="sm" animate />}
      </div>

      <div className="mt-3 flex items-center gap-4 text-sm text-muted-foreground">
        <span className="flex items-center gap-1">
          <Clock className="h-3.5 w-3.5" />
          {formatDuration(durationMin)}
        </span>
        <span className="flex items-center gap-1">
          <MapPin className="h-3.5 w-3.5" />
          {formatDistance(distanceKm)}
        </span>
      </div>
    </button>
  );
}
