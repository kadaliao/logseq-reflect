import { vi } from 'vitest'

// Setup global logseq object (instead of mocking as a module)
// The actual code uses global logseq, not imported from @logseq/libs
globalThis.logseq = {
  ready: vi.fn((callback) => Promise.resolve(callback())),
  beforeunload: vi.fn(),
  App: {
    registerUIItem: vi.fn(),
    registerCommandPalette: vi.fn(),
    showMsg: vi.fn(),
    onRouteChanged: vi.fn(),
    onMacroRendererSlotted: vi.fn(),
  },
  Editor: {
    registerSlashCommand: vi.fn(),
    insertBlock: vi.fn(),
    updateBlock: vi.fn(),
    appendBlockInPage: vi.fn(),
    getBlock: vi.fn(),
    getPage: vi.fn(),
    getPageBlocksTree: vi.fn(),
    getCurrentBlock: vi.fn(),
    getCurrentPage: vi.fn(),
  },
  settings: {},
  updateSettings: vi.fn(),
  useSettingsSchema: vi.fn(),
  provideUI: vi.fn(),
} as any

// Setup global test environment
globalThis.console = {
  ...console,
  log: vi.fn(),
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
}
