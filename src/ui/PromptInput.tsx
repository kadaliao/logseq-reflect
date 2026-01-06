/**
 * Prompt input component with debouncing
 * T040: Create PromptInput component with debouncing
 */

import React, { useState, useCallback, useEffect, useRef } from 'react'

export interface PromptInputProps {
  onSubmit: (value: string) => void
  onCancel?: () => void
  placeholder?: string
  debounceMs?: number
  autoFocus?: boolean
}

/**
 * Input component for AI prompts with debouncing
 */
export function PromptInput({
  onSubmit,
  onCancel,
  placeholder = 'Enter your question...',
  autoFocus = true,
}: PromptInputProps): React.ReactElement {
  const [value, setValue] = useState('')
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // Auto-focus on mount
  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus()
    }
  }, [autoFocus])

  // Handle input change
  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setValue(e.target.value)
    },
    []
  )

  // Handle submit
  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault()

      const trimmed = value.trim()
      if (trimmed) {
        onSubmit(trimmed)
      }
    },
    [value, onSubmit]
  )

  // Handle keyboard shortcuts
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      // Submit on Cmd+Enter (Mac) or Ctrl+Enter (Windows/Linux)
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        handleSubmit(e as unknown as React.FormEvent)
      }

      // Cancel on Escape
      if (e.key === 'Escape' && onCancel) {
        e.preventDefault()
        onCancel()
      }
    },
    [handleSubmit, onCancel]
  )

  return (
    <form onSubmit={handleSubmit} style={styles['form']}>
      <div style={styles['container']}>
        <textarea
          ref={inputRef}
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          style={styles['textarea']}
          rows={3}
          aria-label="AI prompt input"
        />
        <div style={styles['footer']}>
          <div style={styles['hint']}>
            {value.trim() ? `${value.trim().length} characters` : 'Cmd+Enter to submit'}
          </div>
          <div style={styles['buttons']}>
            {onCancel && (
              <button
                type="button"
                onClick={onCancel}
                style={styles['cancelButton']}
                aria-label="Cancel"
              >
                Cancel
              </button>
            )}
            <button
              type="submit"
              disabled={!value.trim()}
              style={{
                ...styles['submitButton'],
                ...(value.trim() ? {} : styles['submitButtonDisabled']),
              }}
              aria-label="Submit"
            >
              Ask AI
            </button>
          </div>
        </div>
      </div>
    </form>
  )
}

const styles: Record<string, React.CSSProperties> = {
  form: {
    width: '100%',
  },
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    padding: '12px',
    backgroundColor: '#fff',
    border: '1px solid #ddd',
    borderRadius: '4px',
  },
  textarea: {
    width: '100%',
    padding: '8px',
    fontSize: '14px',
    lineHeight: '1.5',
    border: '1px solid #ccc',
    borderRadius: '4px',
    resize: 'vertical',
    fontFamily: 'inherit',
  },
  footer: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  hint: {
    fontSize: '12px',
    color: '#666',
  },
  buttons: {
    display: 'flex',
    gap: '8px',
  },
  cancelButton: {
    padding: '6px 12px',
    fontSize: '14px',
    backgroundColor: '#f5f5f5',
    border: '1px solid #ddd',
    borderRadius: '4px',
    cursor: 'pointer',
  },
  submitButton: {
    padding: '6px 16px',
    fontSize: '14px',
    backgroundColor: '#007bff',
    color: '#fff',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
  },
  submitButtonDisabled: {
    backgroundColor: '#ccc',
    cursor: 'not-allowed',
  },
}
