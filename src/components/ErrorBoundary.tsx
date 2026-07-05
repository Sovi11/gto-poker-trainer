import { Component, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

// Last line of defence: any uncaught render/engine error shows a recoverable
// panel instead of a white screen. Local progress is untouched by a reload.
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div className="view">
          <div className="panel error-panel">
            <h2>♠ Something went wrong</h2>
            <p className="muted">
              The app hit an unexpected error. Your progress is saved locally — reloading is safe.
            </p>
            <pre className="error-detail">{this.state.error.message}</pre>
            <button className="primary" onClick={() => window.location.reload()}>
              Reload
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
