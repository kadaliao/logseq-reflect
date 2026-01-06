/**
 * Global type declarations for Logseq plugin environment
 * logseq object is provided by the CDN-loaded lsplugin.user.js
 */

import '@logseq/libs'

declare global {
  const logseq: typeof import('@logseq/libs').logseq
}

export {}
