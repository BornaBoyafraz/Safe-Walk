import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

export function Section({ className, ...props }: ComponentProps<'section'>) {
  return (
    <section
      className={cn('px-6 py-24 md:py-32', className)}
      {...props}
    />
  );
}

export function SectionInner({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      className={cn('mx-auto max-w-6xl', className)}
      {...props}
    />
  );
}
