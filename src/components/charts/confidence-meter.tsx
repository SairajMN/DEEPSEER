'use client';

import { motion } from 'framer-motion';

interface ConfidenceMeterProps {
  score: number | null;
}

export function ConfidenceMeter({ score }: ConfidenceMeterProps) {
  if (score === null) {
    return (
      <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
        Risk model not yet evaluated
      </div>
    );
  }

  const clamped = Math.max(0, Math.min(100, score));
  const radius = 56;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - clamped / 100);

  return (
    <div className="flex flex-col items-center justify-center gap-2">
      <svg width="150" height="150" viewBox="0 0 150 150">
        <circle cx="75" cy="75" r={radius} stroke="#1f2937" strokeWidth="10" fill="none" />
        <motion.circle
          cx="75"
          cy="75"
          r={radius}
          stroke={clamped >= 70 ? '#22c55e' : clamped >= 40 ? '#f59e0b' : '#ef4444'}
          strokeWidth="10"
          fill="none"
          strokeLinecap="round"
          transform="rotate(-90 75 75)"
          strokeDasharray={circumference}
          animate={{ strokeDashoffset: dashOffset }}
          transition={{ duration: 0.5 }}
        />
        <text x="75" y="78" textAnchor="middle" className="fill-foreground text-2xl font-bold">
          {clamped}
        </text>
        <text x="75" y="95" textAnchor="middle" className="fill-muted-foreground text-xs">
          / 100
        </text>
      </svg>
      <div className="text-xs text-muted-foreground">
        {clamped >= 70 ? 'High confidence' : clamped >= 40 ? 'Moderate confidence' : 'Low confidence'}
      </div>
    </div>
  );
}
