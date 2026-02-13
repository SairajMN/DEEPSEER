'use client';

import { useWSStore } from '@/store';
import { WifiOff, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export function ConnectionBanner() {
  const { connected, reconnecting, error } = useWSStore();

  if (connected) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ height: 0, opacity: 0 }}
        animate={{ height: 'auto', opacity: 1 }}
        exit={{ height: 0, opacity: 0 }}
        className="bg-yellow-500/10 border-b border-yellow-500/30 px-4 py-2 flex items-center justify-center gap-2 text-sm"
      >
        {reconnecting ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin text-yellow-500" />
            <span className="text-yellow-600 dark:text-yellow-400">Reconnecting to live data feed...</span>
          </>
        ) : error ? (
          <>
            <WifiOff className="h-4 w-4 text-destructive" />
            <span className="text-destructive">{error}</span>
          </>
        ) : (
          <>
            <WifiOff className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">WebSocket disconnected — live updates paused.</span>
          </>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
