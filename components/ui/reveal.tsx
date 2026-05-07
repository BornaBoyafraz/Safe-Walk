'use client';

import { type ComponentProps } from 'react';
import { motion } from 'motion/react';
import { cn } from '@/lib/utils';

interface RevealProps extends ComponentProps<typeof motion.div> {
  delay?: number;
  className?: string;
}

const ease = [0.22, 1, 0.36, 1] as const;

export function Reveal({ delay = 0, className, children, ...props }: RevealProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.55, delay, ease }}
      className={cn(className)}
      {...props}
    >
      {children}
    </motion.div>
  );
}
