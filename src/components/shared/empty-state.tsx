'use client';

import { AlertCircle, WifiOff, Clock, ServerOff } from 'lucide-react';

type EmptyStateType = 'no-data' | 'offline' | 'pending' | 'error' | 'not-configured';

interface EmptyStateProps {
  type: EmptyStateType;
  title: string;
  description: string;
}

const icons: Record<EmptyStateType, React.ReactNode> = {
  'no-data': <AlertCircle className="h-10 w-10 text-muted-foreground" />,
  offline: <WifiOff className="h-10 w-10 text-destructive" />,
  pending: <Clock className="h-10 w-10 text-yellow-500" />,
  error: <ServerOff className="h-10 w-10 text-destructive" />,
  'not-configured': <ServerOff className="h-10 w-10 text-muted-foreground" />,
};

export function EmptyState({ type, title, description }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4">
      {icons[type]}
      <h3 className="mt-4 text-lg font-semibold">{title}</h3>
      <p className="mt-2 text-sm text-muted-foreground text-center max-w-md">{description}</p>
    </div>
  );
}
