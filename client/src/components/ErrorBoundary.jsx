import { Component } from 'react';

/**
 * Error Boundary Component
 *
 * Catches React component errors and displays a user-friendly fallback UI.
 * This prevents the entire app from crashing due to a single component error.
 *
 * Usage:
 *   <ErrorBoundary>
 *     <App />
 *   </ErrorBoundary>
 */
export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render will show the fallback UI
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    // Log the error to console for debugging
    console.error('Error Boundary caught an error:', error);
    console.error('Error Info:', errorInfo);

    // Store error details in state
    this.setState({
      error,
      errorInfo
    });
  }

  handleReload = () => {
    // Reload the page to recover from the error
    window.location.reload();
  };

  handleReset = () => {
    // Reset the error boundary to try rendering again
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          padding: '20px',
          backgroundColor: '#f5f5f5',
          color: '#333'
        }}>
          <div style={{
            maxWidth: '600px',
            backgroundColor: 'white',
            padding: '40px',
            borderRadius: '8px',
            boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
          }}>
            <h1 style={{ color: '#e74c3c', marginBottom: '20px' }}>
              Something went wrong
            </h1>
            <p style={{ marginBottom: '20px', lineHeight: '1.6' }}>
              The application encountered an unexpected error. You can try reloading the page
              or resetting the application state.
            </p>
            <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
              <button
                onClick={this.handleReload}
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#3498db',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '14px'
                }}
              >
                Reload Page
              </button>
              <button
                onClick={this.handleReset}
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#95a5a6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '14px'
                }}
              >
                Try Again
              </button>
            </div>
            {this.state.error && (
              <details style={{
                marginTop: '20px',
                padding: '15px',
                backgroundColor: '#f8f9fa',
                borderRadius: '4px',
                fontSize: '12px'
              }}>
                <summary style={{ cursor: 'pointer', marginBottom: '10px', fontWeight: 'bold' }}>
                  Error Details (for debugging)
                </summary>
                <pre style={{
                  overflow: 'auto',
                  maxHeight: '200px',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word'
                }}>
                  {this.state.error.toString()}
                  {this.state.errorInfo && this.state.errorInfo.componentStack}
                </pre>
              </details>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
