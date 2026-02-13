'use client';

import { Component, type ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback || (
          <div className="flex flex-col items-center justify-center p-8 rounded-lg border border-destructive/50 bg-destructive/5">
            <AlertTriangle className="h-8 w-8 text-destructive mb-3" />
            <h3 className="text-lg font-semibold mb-1">Component Error</h3>
            <p className="text-sm text-muted-foreground text-center max-w-md">
              {this.state.error?.message || 'An unexpected error occurred.'}
            </p>
            <button
              onClick={() => this.setState({ hasError: false, error: null })}
              className="mt-4 px-4 py-2 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
            >
              Retry
            </button>
          </div>
        )
      );
    }
    return this.props.children;
  }
}
