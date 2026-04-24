import React, { Component } from "react";

class ErrorBoundary extends Component {
  state = {
    hasError: false,
    error: null
  };

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ 
          minHeight: '100vh', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center', 
          backgroundColor: '#f9fafb',
          padding: '20px',
          fontFamily: 'sans-serif'
        }}>
          <div style={{ 
            maxWidth: '400px', 
            width: '100%', 
            backgroundColor: '#fff', 
            padding: '30px', 
            borderRadius: '16px', 
            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)',
            border: '1px solid #fee2e2',
            textAlign: 'center'
          }}>
            <div style={{ 
              width: '64px', 
              height: '64px', 
              backgroundColor: '#fee2e2', 
              color: '#dc2626', 
              borderRadius: '50%', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              margin: '0 auto 24px',
              fontSize: '24px',
              fontWeight: 'bold'
            }}>!</div>
            <h1 style={{ fontSize: '24px', fontWeight: '900', color: '#111827', marginBottom: '16px' }}>Application Error</h1>
            <p style={{ color: '#4b5563', marginBottom: '24px', lineHeight: '1.5' }}>
              AutoVet encountered an unexpected error. This usually happens when the backend returns an invalid response structure.
            </p>
            <div style={{ 
              backgroundColor: '#fff1f2', 
              padding: '16px', 
              borderRadius: '12px', 
              marginBottom: '24px', 
              textAlign: 'left', 
              overflow: 'auto', 
              maxHeight: '150px' 
            }}>
              <p style={{ fontSize: '12px', fontFamily: 'monospace', color: '#9f1239', wordBreak: 'break-all', whiteSpace: 'pre-wrap', margin: 0 }}>
                {this.state.error?.toString()}
              </p>
            </div>
            <button
              onClick={() => window.location.reload()}
              style={{ 
                width: '100%', 
                padding: '12px', 
                backgroundColor: '#111827', 
                color: '#fff', 
                fontWeight: 'bold', 
                borderRadius: '12px', 
                border: 'none',
                cursor: 'pointer'
              }}
            >
              Refresh Application
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
