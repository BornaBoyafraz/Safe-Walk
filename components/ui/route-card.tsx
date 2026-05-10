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
        'w-full cursor-pointer rounded-xl border p-4 text-left transition-all duration-200',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        active
          ? 'border-border/60 bg-card ring-1 ring-inset ring-white/[0.06] shadow-sm scale-[1.005]'
          : 'border-border/25 bg-card/35 hover:bg-card/55 hover:border-border/45',
      )}
      aria-pressed={active}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          {isSafest
            ? <Shield className="h-4 w-4 shrink-0" style={{ color: 'hsl(var(--safe))' }} />
            : <Zap    className="h-4 w-4 shrink-0 text-blue-400" />
          }
          <span className={cn('text-sm font-medium', active ? 'text-foreground' : 'text-muted-foreground')}>
            {isSafest ? 'Safest route' : 'Fastest route'}
          </span>
        </div>
        <SafetyMeter score={safetyScore} size="sm" animate={active} />
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
