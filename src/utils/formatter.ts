/**
 * Formatter utility for sanitizing LLM output for Logseq compatibility
 * Handles nested lists, multi-line content, and inconsistent formatting
 */

import { createLogger } from './logger'

const logger = createLogger('Formatter')

/**
 * Formatter options for controlling sanitization behavior
 */
export interface FormatterOptions {
  /** Enable formatting (default: true) */
  enableFormatting?: boolean
  /** Log modifications when applied (default: true) */
  logModifications?: boolean
  /** Preserve code blocks instead of stripping them (default: false) */
  preserveCodeBlocks?: boolean
  /** Command type for context-specific formatting */
  commandType?: 'ask' | 'summarize' | 'flashcard' | 'tasks' | 'custom'
}

/**
 * Validation result for block hierarchy checks
 */
export interface ValidationResult {
  isValid: boolean
  warnings: string[]
  errors: string[]
}

/**
 * Flashcard block structure for Q&A pairs
 */
export interface FlashcardBlock {
  type: 'question' | 'answer'
  content: string
  hasCard: boolean
}

// Default configuration
const DEFAULT_OPTIONS: FormatterOptions = {
  enableFormatting: true,
  logModifications: true,
  preserveCodeBlocks: false,
  commandType: 'ask',
}

/**
 * Main sanitization function
 * Applies all formatting rules based on command type and options
 *
 * @param content - Raw LLM output content
 * @param options - Formatting options
 * @returns Sanitized content safe for Logseq block insertion
 */
export function sanitizeForLogseq(
  content: string,
  options?: FormatterOptions
): string {
  const opts = { ...DEFAULT_OPTIONS, ...options }

  if (!opts.enableFormatting) {
    return content // Pass-through if disabled
  }

  try {
    let sanitized = content
    const modifications: string[] = []

    // Apply formatting based on command type
    if (opts.commandType === 'flashcard') {
      // Special handling for flashcards (don't flatten lists yet)
      // Will be handled in specialized flashcard block creation
      return sanitized
    }

    // Step 1: Strip code fences if they break structure
    if (!opts.preserveCodeBlocks) {
      const stripped = stripCodeFences(sanitized)
      if (stripped !== sanitized) {
        modifications.push('Removed code blocks')
        sanitized = stripped
      }
    }

    // Step 2: Normalize list prefixes
    const normalized = normalizeListPrefixes(sanitized)
    if (normalized !== sanitized) {
      modifications.push('Normalized list prefixes')
      sanitized = normalized
    }

    // Step 3: Flatten nested lists
    const flattened = flattenNestedLists(sanitized)
    if (flattened !== sanitized) {
      modifications.push('Flattened nested lists')
      sanitized = flattened
    }

    // Step 4: Normalize Logseq tags (ensure proper spacing and format)
    const tagNormalized = normalizeLogseqTags(sanitized)
    if (tagNormalized !== sanitized) {
      modifications.push('Normalized Logseq tags')
      sanitized = tagNormalized
    }

    // Step 5: Remove excessive blank lines
    sanitized = sanitized.replace(/\n{3,}/g, '\n\n')

    // Log modifications if enabled
    if (opts.logModifications && modifications.length > 0) {
      logger.info('Applied formatting modifications', {
        commandType: opts.commandType,
        modifications,
        originalLength: content.length,
        sanitizedLength: sanitized.length,
      })
    }

    return sanitized
  } catch (error) {
    logger.error('Formatting failed, returning original content', error as Error)
    return content // Fallback to original on error
  }
}

/**
 * Flatten nested lists by removing indentation
 * Converts "  - item" to "- item"
 *
 * @param content - Content with potentially nested lists
 * @returns Content with flattened lists
 */
export function flattenNestedLists(content: string): string {
  const lines = content.split('\n')
  const flattened: string[] = []

  for (const line of lines) {
    // Match lines with leading spaces before list marker
    const match = line.match(/^(\s*)(-|\*|\+|\d+\.)\s+(.+)$/)

    if (match) {
      const [, spaces, , text] = match

      if (spaces.length > 0) {
        // Remove leading spaces, keep only the list marker
        flattened.push(`- ${text}`)
      } else {
        // Already flat, but normalize to "-"
        flattened.push(`- ${text}`)
      }
    } else {
      // Not a list item, preserve as-is
      flattened.push(line)
    }
  }

  return flattened.join('\n')
}

/**
 * Normalize list prefixes to consistent "- " format
 * Handles: *, +, 1., 2., etc.
 *
 * @param content - Content with various list formats
 * @returns Content with normalized list prefixes
 */
export function normalizeListPrefixes(content: string): string {
  const lines = content.split('\n')
  const normalized: string[] = []

  for (const line of lines) {
    // Match various list formats
    const match = line.match(/^(\s*)(\*|\+|\d+\.)\s+(.+)$/)

    if (match) {
      const [, spaces, , text] = match

      // Convert to "- " prefix, preserve spaces for now
      // (will be removed by flattenNestedLists if needed)
      normalized.push(`${spaces}- ${text}`)
    } else {
      normalized.push(line)
    }
  }

  return normalized.join('\n')
}

/**
 * Strip markdown code fences
 * Removes ``` blocks and extracts content if it contains structured text
 *
 * @param content - Content with potential code blocks
 * @returns Content with code blocks stripped or extracted
 */
export function stripCodeFences(content: string): string {
  // Remove code blocks entirely (```language\ncode\n```)
  let stripped = content.replace(
    /```[\w]*\n?([\s\S]*?)```/g,
    (match, codeContent) => {
      // Extract code content if it looks like structured text
      // Check for various list markers (-, *, +, numbers) or Q&A format
      if (
        codeContent.match(/[-*+]\s/) ||
        codeContent.match(/^\d+\.\s/m) ||
        codeContent.includes('Q:')
      ) {
        return codeContent.trim()
      }
      // Otherwise remove entirely (return empty string, will be cleaned later)
      return ''
    }
  )

  // Clean up excessive blank lines left by removed code blocks
  stripped = stripped.replace(/\n{3,}/g, '\n\n')

  // Remove inline code backticks if excessive (3+ backticks)
  return stripped.replace(/`{3,}/g, '')
}

/**
 * Validate content won't break Logseq block hierarchy
 *
 * @param content - Content to validate
 * @returns Validation result with warnings and errors
 */
export function validateBlockHierarchy(content: string): ValidationResult {
  const warnings: string[] = []
  const errors: string[] = []

  // Check for deeply nested lists (more than 2 levels)
  const deepNesting = content.match(/^\s{4,}-/m)
  if (deepNesting) {
    warnings.push('Content contains deeply nested lists (may not render correctly)')
  }

  // Check for tables
  if (content.includes('|') && content.match(/\|.*\|.*\|/)) {
    warnings.push('Content contains tables (may break block structure)')
  }

  // Check for multiple code blocks
  const codeBlocks = content.match(/```/g)
  if (codeBlocks && codeBlocks.length >= 4) {
    warnings.push('Content contains multiple code blocks (may affect formatting)')
  }

  return {
    isValid: errors.length === 0,
    warnings,
    errors,
  }
}

/**
 * Split multi-line flashcard answers into parent-child blocks
 * Handles: "Q: question\nA: line1\nline2\nline3 #card"
 *
 * @param qaContent - Q&A content from LLM
 * @returns Array of flashcard blocks with proper structure
 */
export function splitMultiLineFlashcard(qaContent: string): FlashcardBlock[] {
  const blocks: FlashcardBlock[] = []

  // Parse Q&A pairs with multi-line support
  // Match: Q: ...  then A: ... (possibly multi-line until next Q: or end)
  const qaPattern = /Q:\s*(.+?)\s*\nA:\s*([\s\S]+?)(?=\n\nQ:|$)/g
  const matches = [...qaContent.matchAll(qaPattern)]

  if (matches.length === 0) {
    // Fallback: return as single block
    return [
      {
        type: 'question',
        content: qaContent,
        hasCard: qaContent.includes('#card'),
      },
    ]
  }

  for (const match of matches) {
    const question = match[1].trim()
    const answerContent = match[2].trim()

    // Check if answer is multi-line
    const answerLines = answerContent
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0)

    // Add question block
    blocks.push({
      type: 'question',
      content: `Q: ${question}`,
      hasCard: false,
    })

    if (answerLines.length === 1) {
      // Single-line answer - add as-is
      const answer = answerLines[0]
      blocks.push({
        type: 'answer',
        content: `A: ${answer}${answer.includes('#card') ? '' : ' #card'}`,
        hasCard: true,
      })
    } else {
      // Multi-line answer - create parent answer with children
      const firstLine = answerLines[0]

      // Check if #card is in the answer content (could be on any line)
      const hasCardTag = answerContent.includes('#card')

      blocks.push({
        type: 'answer',
        content: `A: ${firstLine}${hasCardTag || firstLine.includes('#card') ? '' : ' #card'}`,
        hasCard: true,
      })

      // Add remaining lines as child blocks (will be created separately)
      for (let i = 1; i < answerLines.length; i++) {
        const line = answerLines[i]
        // Remove #card tag from child lines if present
        const cleanLine = line.replace(/\s*#card\s*$/, '').trim()
        blocks.push({
          type: 'answer',
          content: cleanLine,
          hasCard: false,
        })
      }
    }
  }

  return blocks
}

/**
 * Normalize Logseq tags in content
 * - Ensures tags are separated from surrounding text with spaces
 * - Converts mid-sentence hashtags to [[tag]] format for better compatibility
 * - Preserves end-of-line hashtags in #tag format
 *
 * Strategy: Since determining tag boundaries in CJK text is difficult,
 * we focus on ensuring proper spacing and converting problematic mid-sentence tags.
 *
 * @param content - Content with potential tag formatting issues
 * @returns Content with normalized tags
 */
export function normalizeLogseqTags(content: string): string {
  // Match hashtags that look like page references (alphanumeric + slashes only)
  // This is conservative but avoids false positives with CJK text
  const hashtagPattern = /#([A-Za-z0-9]+(?:\/[A-Za-z0-9]+)*)/g

  return content.replace(hashtagPattern, (fullMatch, tagName, offset, string) => {
    // Check what comes before and after the hashtag
    const beforeChar = offset > 0 ? string[offset - 1] : ''
    const afterIdx = offset + fullMatch.length
    const afterChar = afterIdx < string.length ? string[afterIdx] : ''

    // Determine if this hashtag is at the end of the line
    const isAtLineEnd = !afterChar || afterChar === '\n'

    // Check if there's actual content after the tag (not just end of line)
    const hasContentAfter = afterChar && afterChar !== '\n'

    // Check if it needs spacing
    const needsSpaceBefore = beforeChar && beforeChar !== ' ' && beforeChar !== '\n'
    const needsSpaceAfter = hasContentAfter && afterChar !== ' '

    let replacement = fullMatch

    // Convert to [[tag]] format if tag is NOT at line end
    if (hasContentAfter) {
      replacement = `[[${tagName}]]`
    }

    // Add spaces if needed
    if (needsSpaceBefore) {
      replacement = ' ' + replacement
    }
    if (needsSpaceAfter) {
      replacement = replacement + ' '
    }

    return replacement
  })
}

/**
 * Format task subtasks with consistent marker and flat structure
 *
 * @param content - Task subtask content from LLM
 * @param marker - TODO marker to apply (TODO, DOING, DONE, etc.)
 * @returns Formatted subtask content
 */
export function formatTaskSubtasks(content: string, marker: string): string {
  // First, try to detect if content is a single line with multiple tasks
  // This happens when AI returns: "- LATER Task1- LATER Task2- LATER Task3"
  // We need to split on "- LATER" or "- TODO" patterns
  let normalizedContent = content

  // Pattern to detect multiple list items without proper newlines
  // Matches: "- MARKER Text- MARKER Text" → should be "- MARKER Text\n- MARKER Text"
  const VALID_MARKERS = ['TODO', 'DOING', 'DONE', 'LATER', 'NOW', 'WAITING', 'CANCELLED']
  const markerPattern = new RegExp(
    `(- (?:${VALID_MARKERS.join('|')})\\s+[^-]+)(?=- (?:${VALID_MARKERS.join('|')})\\s+)`,
    'g'
  )

  // If we detect this pattern, add newlines between items
  if (markerPattern.test(content)) {
    normalizedContent = content.replace(markerPattern, '$1\n')
  }

  const lines = normalizedContent.split('\n')
  const formatted: string[] = []

  for (const line of lines) {
    const trimmed = line.trim()

    if (!trimmed) continue

    // Match list items with or without marker
    const listMatch = trimmed.match(/^-\s+(.+)$/)

    if (listMatch) {
      const taskText = listMatch[1].trim()

      // Check if already has a TODO marker
      const hasMarker = VALID_MARKERS.some((m) =>
        new RegExp(`^${m}\\s+`).test(taskText)
      )

      if (hasMarker) {
        formatted.push(`- ${taskText}`)
      } else {
        formatted.push(`- ${marker} ${taskText}`)
      }
    } else {
      // Not a list item, check if it's a bare TODO marker line
      const bareMarkerMatch = trimmed.match(
        /^(TODO|DOING|DONE|LATER|NOW|WAITING|CANCELLED)\s+(.+)$/
      )
      if (bareMarkerMatch) {
        // Has marker but no list prefix, add it
        formatted.push(`- ${trimmed}`)
      }
      // Otherwise skip (explanatory text)
    }
  }

  return formatted.join('\n')
}

/**
 * Format summary bullet lists with proper line breaks
 * Fixes the issue where AI returns concatenated list items without newlines
 * Example: "- Item1- Item2- Item3" → "- Item1\n- Item2\n- Item3"
 *
 * @param content - Summary content from LLM with potential formatting issues
 * @returns Formatted content with proper line breaks between list items
 */
export function formatSummaryList(content: string): string {
  let normalizedContent = content

  // Pattern to detect list items that are concatenated without newlines
  // Matches: "- Text(not ending with newline)- " → should add newline before next "-"
  // We look for: "- " followed by content, then directly followed by another "- " (no newline between)
  const listPattern = /(- [^\n]+?)(?=- )/g

  // Check if pattern matches and apply fix
  const matches = content.match(listPattern)
  if (matches && matches.length > 0) {
    logger.info('Detected concatenated list items, applying fix', {
      matchCount: matches.length,
      sample: matches[0].substring(0, 100),
    })
    // Add newlines between concatenated list items
    normalizedContent = content.replace(listPattern, '$1\n')
  }

  return normalizedContent
}
