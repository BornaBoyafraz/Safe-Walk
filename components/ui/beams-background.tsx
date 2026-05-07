'use client';

import { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';

interface BeamsBackgroundProps {
  className?: string;
  intensity?: 'subtle' | 'medium' | 'strong';
}

export function BeamsBackground({ className, intensity = 'subtle' }: BeamsBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef  = useRef<number>(0);
  const startRef  = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const opacityMap = { subtle: 0.08, medium: 0.14, strong: 0.22 };
    const maxOpacity = opacityMap[intensity];

    const beams = Array.from({ length: 6 }, (_, i) => ({
      x:     0.1 + i * 0.15 + (Math.random() - 0.5) * 0.08,
      width: 0.04 + Math.random() * 0.06,
      speed: 0.00008 + Math.random() * 0.00006,
      phase: Math.random() * Math.PI * 2,
    }));

    function resize() {
      if (!canvas) return;
      canvas.width  = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    }

    function draw(ts: number) {
      if (!canvas || !ctx) return;
      if (!startRef.current) startRef.current = ts;
      const elapsed = ts - startRef.current;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      for (const beam of beams) {
        const sway   = Math.sin(elapsed * beam.speed + beam.phase) * 0.04;
        const cx     = (beam.x + sway) * canvas.width;
        const halfW  = beam.width * canvas.width * 0.5;

        const grad = ctx.createLinearGradient(cx, 0, cx, canvas.height);
        grad.addColorStop(0,   `rgba(160,180,255,0)`);
        grad.addColorStop(0.2, `rgba(160,180,255,${maxOpacity})`);
        grad.addColorStop(0.6, `rgba(130,150,255,${maxOpacity * 0.6})`);
        grad.addColorStop(1,   `rgba(100,120,255,0)`);

        const beamGrad = ctx.createRadialGradient(cx, canvas.height * 0.3, 0, cx, canvas.height * 0.3, halfW * 4);
        beamGrad.addColorStop(0,   `rgba(160,180,255,${maxOpacity})`);
        beamGrad.addColorStop(0.5, `rgba(140,160,255,${maxOpacity * 0.5})`);
        beamGrad.addColorStop(1,   `rgba(0,0,0,0)`);

        ctx.save();
        ctx.beginPath();
        ctx.moveTo(cx - halfW, 0);
        ctx.lineTo(cx + halfW, 0);
        ctx.lineTo(cx + halfW * 2.5, canvas.height);
        ctx.lineTo(cx - halfW * 2.5, canvas.height);
        ctx.closePath();
        ctx.fillStyle = grad;
        ctx.globalCompositeOperation = 'screen';
        ctx.fill();
        ctx.restore();
      }

      frameRef.current = requestAnimationFrame(draw);
    }

    resize();
    window.addEventListener('resize', resize);
    frameRef.current = requestAnimationFrame(draw);

    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(frameRef.current);
    };
  }, [intensity]);

  return (
    <canvas
      ref={canvasRef}
      className={cn('pointer-events-none absolute inset-0 h-full w-full', className)}
      aria-hidden
    />
  );
}
