import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'

// Last line of defence: a render error would otherwise unmount everything and leave a black screen.
class ErrorBoundary extends React.Component {
  state = { error: null };
  static getDerivedStateFromError(error) { return { error }; }
  componentDidCatch(error, info) { console.error('Speedr crashed:', error, info?.componentStack); }
  render() {
    if (!this.state.error) return this.props.children;
    const btn = { padding: '12px 22px', border: 'none', borderRadius: 12, fontSize: 14, cursor: 'pointer', background: '#7c6af7', color: '#fff' };
    return (
      <div style={{ position: 'fixed', inset: 0, background: '#0d0d0d', color: '#e8e8e8', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24, textAlign: 'center', fontFamily: 'system-ui, sans-serif' }}>
        <div style={{ fontSize: 16 }}>Something went wrong.</div>
        <div style={{ fontSize: 12, color: '#666', maxWidth: 320, wordBreak: 'break-word' }}>{String(this.state.error?.message || this.state.error)}</div>
        <button style={btn} onClick={() => location.reload()}>Reload Speedr</button>
      </div>
    );
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
)
