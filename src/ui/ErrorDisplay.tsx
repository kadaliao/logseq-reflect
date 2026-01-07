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
    <div
      className="logseq-ai-error"
      style={styles['container']}
      role="alert"
      aria-live="assertive"
      aria-atomic="true"
    >
      <div style={styles['content']}>
        <span style={styles['icon']} aria-hidden="true">⚠️</span>
        <span style={styles['message']} role="status">{errorMessage}</span>
      </div>
      {onDismiss && (
        <button
          onClick={onDismiss}
          style={styles['dismissButton']}
          aria-label="Dismiss error message"
          type="button"
        >
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
    backgroundColor: 'var(--ls-error-background-color, #fee)',
    border: '1px solid var(--ls-error-border-color, #fcc)',
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
    color: 'var(--ls-error-text-color, #b91c1c)', // WCAG AA compliant red (4.5:1 contrast on #fee)
    fontSize: '14px',
    lineHeight: '1.4',
  },
  dismissButton: {
    background: 'none',
    border: 'none',
    fontSize: '24px',
    color: 'var(--ls-error-text-color, #b91c1c)',
    cursor: 'pointer',
    padding: '0 4px',
    marginLeft: '8px',
  },
}
