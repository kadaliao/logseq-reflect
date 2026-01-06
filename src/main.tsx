/**
 * React app bootstrap
 * T035: Create React app bootstrap
 */

import React from 'react'
import ReactDOM from 'react-dom'
import { createLogger } from './utils/logger'

const logger = createLogger('ReactApp')

/**
 * Root app component
 * This will be expanded in future phases with UI components
 */
function App(): React.ReactElement {
  return (
    <div className="logseq-ai-plugin">
      <h1>Logseq AI Plugin</h1>
      <p>Plugin is active and ready to use.</p>
    </div>
  )
}

/**
 * Mount React app to the DOM
 * @param containerId - DOM element ID to mount the app
 */
export function mountApp(containerId: string): void {
  const container = document.getElementById(containerId)

  if (!container) {
    logger.error('Mount container not found', undefined, { containerId })
    return
  }

  try {
    ReactDOM.render(<App />, container)
    logger.info('React app mounted successfully', { containerId })
  } catch (error) {
    logger.error('Failed to mount React app', error as Error, { containerId })
  }
}

/**
 * Unmount React app from the DOM
 * @param containerId - DOM element ID where the app is mounted
 */
export function unmountApp(containerId: string): void {
  const container = document.getElementById(containerId)

  if (!container) {
    logger.warn('Unmount container not found', { containerId })
    return
  }

  try {
    ReactDOM.unmountComponentAtNode(container)
    logger.info('React app unmounted successfully', { containerId })
  } catch (error) {
    logger.error('Failed to unmount React app', error as Error, { containerId })
  }
}

// Export App component for testing
export { App }
