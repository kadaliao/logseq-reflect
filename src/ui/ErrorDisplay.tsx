/**
 * Error display component
 * T039: Create ErrorDisplay component
 */

import React from 'react'

export interface ErrorDisplayProps {
  error: Error | string
  onDismiss?: () => void
}

/**
 * Display error message with optional dismiss button
 */
export function ErrorDisplay({
  error,
  onDismiss,
}: ErrorDisplayProps): React.ReactElement {
  const errorMessage = typeof error === 'string' ? error : error.message

  return (
    <div className="logseq-ai-error" style={styles['container']}>
      <div style={styles['content']}>
        <span style={styles['icon']}>⚠️</span>
        <span style={styles['message']}>{errorMessage}</span>
      </div>
      {onDismiss && (
        <button onClick={onDismiss} style={styles['dismissButton']} aria-label="Dismiss error">
          ×
        </button>
      )}
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px 16px',
    backgroundColor: '#fee',
    border: '1px solid #fcc',
    borderRadius: '4px',
    marginBottom: '8px',
  },
  content: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    flex: 1,
  },
  icon: {
    fontSize: '20px',
  },
  message: {
    color: '#c33',
    fontSize: '14px',
    lineHeight: '1.4',
  },
  dismissButton: {
    background: 'none',
    border: 'none',
    fontSize: '24px',
    color: '#c33',
    cursor: 'pointer',
    padding: '0 4px',
    marginLeft: '8px',
  },
}
