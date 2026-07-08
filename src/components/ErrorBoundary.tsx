import { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback || (
          <div className="flex h-screen flex-col items-center justify-center bg-bg-primary px-4">
            <div className="text-center">
              <h2 className="text-lg font-bold text-down">页面发生错误</h2>
              <p className="mt-2 text-sm text-text-secondary">
                {this.state.error?.message || '未知错误'}
              </p>
              <button
                onClick={() => window.location.reload()}
                className="mt-4 rounded-lg bg-accent-gold px-4 py-2 text-sm font-semibold text-bg-primary"
              >
                刷新页面
              </button>
            </div>
          </div>
        )
      );
    }

    return this.props.children;
  }
}
