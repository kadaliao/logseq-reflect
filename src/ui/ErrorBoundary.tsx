/**
 * Error boundary for React components
 * T122: Implement error boundaries for React components
 */

import React, { Component, ErrorInfo, ReactNode } from 'react'
import { createLogger } from '../utils/logger'

const logger = createLogger('ErrorBoundary')

export interface ErrorBoundaryProps {
  children: ReactNode
  fallback?: ReactNode
  onError?: (error: Error, errorInfo: ErrorInfo) => void
}

export interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

/**
 * Error boundary component to catch React errors
 * Prevents crashes and provides graceful error handling
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = {
      hasError: false,
      error: null,
    }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      error,
    }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    logger.error('React error caught by boundary', error, {
      componentStack: errorInfo.componentStack,
    })

    // Call optional error handler
    if (this.props.onError) {
      this.props.onError(error, errorInfo)
    }

    // Show user notification
    logseq.App.showMsg('An error occurred in the AI Plugin UI', 'error').catch((err: Error) => {
      console.error('Failed to show error message:', err)
    })
  }

  reset = (): void => {
    this.setState({
      hasError: false,
      error: null,
    })
  }

  render(): ReactNode {
    if (this.state.hasError) {
      // Use custom fallback or default error UI
      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <div
          style={styles.container}
          role="alert"
          aria-live="assertive"
        >
          <div style={styles.content}>
            <h3 style={styles.title}>⚠️ Something went wrong</h3>
            <p style={styles.message}>
              {this.state.error?.message || 'An unexpected error occurred'}
            </p>
            <button
              onClick={this.reset}
              style={styles.button}
              type="button"
              aria-label="Try again"
            >
              Try Again
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    padding: '24px',
    backgroundColor: 'var(--ls-error-background-color, #fee)',
    border: '2px solid var(--ls-error-border-color, #fcc)',
    borderRadius: '8px',
    margin: '16px',
  },
  content: {
    textAlign: 'center',
  },
  title: {
    color: 'var(--ls-error-text-color, #b91c1c)',
    fontSize: '18px',
    marginBottom: '12px',
  },
  message: {
    color: 'var(--ls-primary-text-color, #000)',
    fontSize: '14px',
    marginBottom: '16px',
    lineHeight: '1.5',
  },
  button: {
    padding: '8px 16px',
    fontSize: '14px',
    backgroundColor: 'var(--ls-link-text-color, #007bff)',
    color: '#fff',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
  },
}
