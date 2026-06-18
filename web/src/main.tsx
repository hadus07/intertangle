import { ReactFlowProvider } from '@xyflow/react'
import React, { Suspense } from 'react'
import ReactDOM from 'react-dom/client'
import '@xyflow/react/dist/style.css'
import './styles.css'
import App from './components/App'

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  state = { error: null }
  static getDerivedStateFromError(error: Error) {
    return { error }
  }
  render() {
    if (this.state.error) return <div className="loading">failed to load graph</div>
    return this.props.children
  }
}

const root = document.getElementById('root') as HTMLElement
ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <ReactFlowProvider>
      <ErrorBoundary>
        <Suspense fallback={<div className="loading">loading…</div>}>
          <App />
        </Suspense>
      </ErrorBoundary>
    </ReactFlowProvider>
  </React.StrictMode>,
)
