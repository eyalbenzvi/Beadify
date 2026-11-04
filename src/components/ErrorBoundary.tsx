import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface Props {
  children: ReactNode;
  /** Changing this key resets the boundary (e.g. the active step). */
  resetKey?: unknown;
  onReset?: () => void;
}

interface State {
  error: Error | null;
}

/** Catches render errors in a step so one failure never blanks the whole app. */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Beadify step crashed:', error, info.componentStack);
  }

  componentDidUpdate(prev: Props): void {
    if (this.state.error && prev.resetKey !== this.props.resetKey) this.setState({ error: null });
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div role="alert" className="card mx-auto max-w-lg p-6 text-center">
        <span className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-50 text-rose-500">
          <AlertTriangle className="h-6 w-6" />
        </span>
        <h2 className="font-display text-xl font-semibold text-ink">Something went wrong</h2>
        <p className="mt-1 text-sm text-ink-subtle">{this.state.error.message || 'An unexpected error occurred.'}</p>
        <button
          type="button"
          className="btn-primary mt-5"
          onClick={() => {
            this.setState({ error: null });
            this.props.onReset?.();
          }}
        >
          <RotateCcw className="h-4 w-4" /> Try again
        </button>
      </div>
    );
  }
}
