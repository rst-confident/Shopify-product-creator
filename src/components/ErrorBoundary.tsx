import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    // Check if it's an App Bridge error that we can safely ignore
    if (error.name === 'AppBridgeError' || error.message?.includes('APP::ERROR::INVALID_CONFIG')) {
      // Don't set error state for App Bridge errors - just ignore them
      return { hasError: false, error: null };
    }
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Ignore App Bridge errors
    if (error.name === 'AppBridgeError' || error.message?.includes('APP::ERROR::INVALID_CONFIG')) {
      console.log('Suppressed App Bridge error (expected for standalone app)');
      return;
    }
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '20px', maxWidth: '600px', margin: '50px auto' }}>
          <h1>Something went wrong</h1>
          <p>Please refresh the page and try again.</p>
          {this.state.error && (
            <pre style={{ background: '#f5f5f5', padding: '10px', overflow: 'auto' }}>
              {this.state.error.toString()}
            </pre>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
