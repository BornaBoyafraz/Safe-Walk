import { cn } from '@/lib/utils';

type LogoProps = {
  variant?: 'mark' | 'lockup';
  size?: 'sm' | 'md' | 'lg';
  tone?: 'brand' | 'mono';
  className?: string;
};

const sizeMap = { sm: 16, md: 20, lg: 28 };

export function Logo({ variant = 'lockup', size = 'md', tone = 'brand', className }: LogoProps) {
  const dim = sizeMap[size];
  return (
    <span className={cn('inline-flex items-center gap-2.5', variant === 'mark' && 'gap-0', className)}>
      <svg
        width={dim}
        height={dim}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        {/* Fastest route — shallower arc */}
        <path d="M 4 20 C 9 20 15 18 20 17" />
        {/* Safest route — curves strongly upward */}
        <path d="M 4 20 C 8 19 13 7 20 4" />
        {/* Shared origin */}
        <circle cx="4" cy="20" r="1.75" fill="currentColor" stroke="none" />
        {/* Fastest destination — dimmed */}
        <circle cx="20" cy="17" r="1.4" fill="currentColor" fillOpacity={0.5} stroke="none" />
        {/* Safest destination — green accent or inherit */}
        <circle
          cx="20"
          cy="4"
          r="1.75"
          fill="currentColor"
          stroke="none"
          style={tone === 'brand' ? { color: 'hsl(var(--safe))' } : undefined}
        />
      </svg>
      {variant === 'lockup' && (
        <span className="select-none text-sm font-semibold tracking-[-0.015em] text-foreground">
          Safe Walk
        </span>
      )}
    </span>
  );
}
