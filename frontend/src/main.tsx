import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// Error boundary for catching runtime errors
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null; errorInfo: string }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: '' };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }
  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('❌ React Error Boundary:', error, errorInfo);
    this.setState({ errorInfo: errorInfo.componentStack || '' });
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          padding: 40, background: '#fff3f3', border: '2px solid #ff4d4f',
          borderRadius: 8, fontFamily: 'monospace', maxWidth: 800, margin: '40px auto'
        }}>
          <h1 style={{ color: '#ff4d4f' }}>❌ React 渲染错误</h1>
          <h2 style={{ color: '#333' }}>{this.state.error?.message}</h2>
          <pre style={{
            background: '#1a1a1a', color: '#fff', padding: 20, borderRadius: 8,
            overflow: 'auto', maxHeight: 400, fontSize: 12, lineHeight: 1.5,
            whiteSpace: 'pre-wrap', wordBreak: 'break-word'
          }}>
            {this.state.error?.stack}
            {'\n\n'}
            {this.state.errorInfo}
          </pre>
        </div>
      );
    }
    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
