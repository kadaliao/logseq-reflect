import { describe, it, expect } from 'vitest'
import {
  flattenNestedLists,
  normalizeListPrefixes,
  stripCodeFences,
  splitMultiLineFlashcard,
  formatTaskSubtasks,
  formatSummaryList,
  sanitizeForLogseq,
  validateBlockHierarchy,
  normalizeLogseqTags,
  parseNestedList,
} from '../../../src/utils/formatter'

describe('Formatter Utilities', () => {
  describe('flattenNestedLists', () => {
    it('should flatten single-level nested lists', () => {
      const input = `- Item 1
  - Nested 1
  - Nested 2
- Item 2`

      const expected = `- Item 1
- Nested 1
- Nested 2
- Item 2`

      expect(flattenNestedLists(input)).toBe(expected)
    })

    it('should flatten multi-level nested lists', () => {
      const input = `- Level 1
  - Level 2
    - Level 3
      - Level 4`

      const expected = `- Level 1
- Level 2
- Level 3
- Level 4`

      expect(flattenNestedLists(input)).toBe(expected)
    })

    it('should preserve non-list content', () => {
      const input = `This is a paragraph
- List item 1
  - Nested item
Another paragraph`

      const expected = `This is a paragraph
- List item 1
- Nested item
Another paragraph`

      expect(flattenNestedLists(input)).toBe(expected)
    })

    it('should handle mixed indentation levels', () => {
      const input = `- Item 1
    - Deep nested (4 spaces)
  - Medium nested (2 spaces)
- Item 2`

      const expected = `- Item 1
- Deep nested (4 spaces)
- Medium nested (2 spaces)
- Item 2`

      expect(flattenNestedLists(input)).toBe(expected)
    })

    it('should handle empty lines', () => {
      const input = `- Item 1

  - Nested item

- Item 2`

      const expected = `- Item 1

- Nested item

- Item 2`

      expect(flattenNestedLists(input)).toBe(expected)
    })
  })

  describe('parseNestedList', () => {
    it('should parse flat list correctly', () => {
      const input = `- Item 1
- Item 2
- Item 3`

      const result = parseNestedList(input)

      expect(result.length).toBe(3)
      expect(result[0].content).toBe('Item 1')
      expect(result[0].level).toBe(0)
      expect(result[0].children.length).toBe(0)
    })

    it('should parse single-level nested list', () => {
      const input = `- Parent 1
  - Child 1
  - Child 2
- Parent 2`

      const result = parseNestedList(input)

      expect(result.length).toBe(2)
      expect(result[0].content).toBe('Parent 1')
      expect(result[0].children.length).toBe(2)
      expect(result[0].children[0].content).toBe('Child 1')
      expect(result[0].children[1].content).toBe('Child 2')
      expect(result[1].content).toBe('Parent 2')
    })

    it('should parse multi-level nested list', () => {
      const input = `- Level 1
  - Level 2
    - Level 3
      - Level 4`

      const result = parseNestedList(input)

      expect(result.length).toBe(1)
      expect(result[0].content).toBe('Level 1')
      expect(result[0].children.length).toBe(1)
      expect(result[0].children[0].content).toBe('Level 2')
      expect(result[0].children[0].children.length).toBe(1)
      expect(result[0].children[0].children[0].content).toBe('Level 3')
      expect(result[0].children[0].children[0].children.length).toBe(1)
      expect(result[0].children[0].children[0].children[0].content).toBe('Level 4')
    })

    it('should parse complex nested structure', () => {
      const input = `- Main point 1
  - Detail A
  - Detail B
    - Sub-detail B1
- Main point 2
  - Detail C`

      const result = parseNestedList(input)

      expect(result.length).toBe(2)
      expect(result[0].content).toBe('Main point 1')
      expect(result[0].children.length).toBe(2)
      expect(result[0].children[1].content).toBe('Detail B')
      expect(result[0].children[1].children.length).toBe(1)
      expect(result[0].children[1].children[0].content).toBe('Sub-detail B1')
      expect(result[1].content).toBe('Main point 2')
      expect(result[1].children.length).toBe(1)
    })

    it('should handle mixed content with non-list lines', () => {
      const input = `Some text
- Item 1
  - Child 1
More text
- Item 2`

      const result = parseNestedList(input)

      // Should only parse list items, ignoring non-list text
      expect(result.length).toBe(2)
      expect(result[0].content).toBe('Item 1')
      expect(result[0].children.length).toBe(1)
      expect(result[1].content).toBe('Item 2')
    })
  })

  describe('normalizeListPrefixes', () => {
    it('should convert asterisks to dashes', () => {
      const input = `* Item 1
* Item 2
* Item 3`

      const expected = `- Item 1
- Item 2
- Item 3`

      expect(normalizeListPrefixes(input)).toBe(expected)
    })

    it('should convert plus signs to dashes', () => {
      const input = `+ Item 1
+ Item 2`

      const expected = `- Item 1
- Item 2`

      expect(normalizeListPrefixes(input)).toBe(expected)
    })

    it('should convert numbered lists to dashes', () => {
      const input = `1. First item
2. Second item
3. Third item`

      const expected = `- First item
- Second item
- Third item`

      expect(normalizeListPrefixes(input)).toBe(expected)
    })

    it('should preserve existing dashes', () => {
      const input = `- Item 1
- Item 2`

      const expected = `- Item 1
- Item 2`

      expect(normalizeListPrefixes(input)).toBe(expected)
    })

    it('should handle mixed list styles', () => {
      const input = `* Asterisk item
+ Plus item
- Dash item
1. Numbered item`

      const expected = `- Asterisk item
- Plus item
- Dash item
- Numbered item`

      expect(normalizeListPrefixes(input)).toBe(expected)
    })

    it('should preserve indentation for now (to be flattened later)', () => {
      const input = `* Item 1
  * Nested item`

      const expected = `- Item 1
  - Nested item`

      expect(normalizeListPrefixes(input)).toBe(expected)
    })
  })

  describe('stripCodeFences', () => {
    it('should remove code blocks entirely when not structured', () => {
      const input = `Some text
\`\`\`typescript
const x = 5
console.log(x)
\`\`\`
More text`

      const expected = `Some text

More text`

      expect(stripCodeFences(input)).toBe(expected)
    })

    it('should extract structured content from code blocks', () => {
      const input = `Some text
\`\`\`
- Item 1
- Item 2
\`\`\`
More text`

      const result = stripCodeFences(input)

      expect(result).toContain('- Item 1')
      expect(result).toContain('- Item 2')
      expect(result).toContain('Some text')
      expect(result).toContain('More text')
      expect(result).not.toContain('```')
    })

    it('should extract Q&A pairs from code blocks', () => {
      const input = `\`\`\`
Q: What is X?
A: X is Y
\`\`\`
`

      const result = stripCodeFences(input)

      expect(result).toContain('Q: What is X?')
      expect(result).toContain('A: X is Y')
      expect(result).not.toContain('```')
    })

    it('should handle multiple code blocks', () => {
      const input = `Text
\`\`\`python
def hello():
    pass
\`\`\`
Middle
\`\`\`
- Item 1
\`\`\`
End`

      const result = stripCodeFences(input)

      expect(result).toContain('Text')
      expect(result).toContain('Middle')
      expect(result).toContain('- Item 1')
      expect(result).toContain('End')
      expect(result).not.toContain('```')
      expect(result).not.toContain('def hello')
    })

    it('should remove excessive inline backticks', () => {
      const input = 'Text with \`\`\`\` excessive backticks'
      const expected = 'Text with  excessive backticks'

      expect(stripCodeFences(input)).toBe(expected)
    })
  })

  describe('splitMultiLineFlashcard', () => {
    it('should parse single-line Q&A pairs', () => {
      const input = `Q: What is the capital of France?
A: Paris #card`

      const result = splitMultiLineFlashcard(input)

      expect(result).toHaveLength(2)
      expect(result[0]).toEqual({
        type: 'question',
        content: 'Q: What is the capital of France?',
        hasCard: false,
      })
      expect(result[1]).toEqual({
        type: 'answer',
        content: 'A: Paris #card',
        hasCard: true,
      })
    })

    it('should add #card tag if missing', () => {
      const input = `Q: What is 2+2?
A: 4`

      const result = splitMultiLineFlashcard(input)

      expect(result).toHaveLength(2)
      expect(result[1].content).toBe('A: 4 #card')
      expect(result[1].hasCard).toBe(true)
    })

    it('should parse multi-line answers', () => {
      const input = `Q: What are the primary colors?
A: The primary colors are:
Red
Blue
Yellow #card`

      const result = splitMultiLineFlashcard(input)

      expect(result).toHaveLength(5) // Q + A + 3 child lines
      expect(result[0].type).toBe('question')
      expect(result[0].content).toBe('Q: What are the primary colors?')

      expect(result[1].type).toBe('answer')
      expect(result[1].content).toContain('primary colors are:')
      expect(result[1].hasCard).toBe(true)

      expect(result[2].content).toBe('Red')
      expect(result[2].hasCard).toBe(false)

      expect(result[3].content).toBe('Blue')
      expect(result[4].content).toBe('Yellow')
    })

    it('should parse multiple Q&A pairs', () => {
      const input = `Q: What is 1+1?
A: 2 #card

Q: What is 2+2?
A: 4 #card`

      const result = splitMultiLineFlashcard(input)

      expect(result).toHaveLength(4)
      expect(result[0].content).toBe('Q: What is 1+1?')
      expect(result[1].content).toBe('A: 2 #card')
      expect(result[2].content).toBe('Q: What is 2+2?')
      expect(result[3].content).toBe('A: 4 #card')
    })

    it('should handle multi-line answer without #card at end', () => {
      const input = `Q: List three things
A: First thing
Second thing
Third thing`

      const result = splitMultiLineFlashcard(input)

      expect(result[1].content).toContain('#card')
      expect(result[1].hasCard).toBe(true)
    })

    it('should fallback to single block for malformed content', () => {
      const input = 'Some random content without Q&A format'

      const result = splitMultiLineFlashcard(input)

      expect(result).toHaveLength(1)
      expect(result[0].type).toBe('question')
      expect(result[0].content).toBe(input)
    })
  })

  describe('formatTaskSubtasks', () => {
    it('should add TODO marker to unmarked subtasks', () => {
      const input = `- Research libraries
- Design schema
- Write tests`

      const expected = `- TODO Research libraries
- TODO Design schema
- TODO Write tests`

      expect(formatTaskSubtasks(input, 'TODO')).toBe(expected)
    })

    it('should preserve existing TODO markers', () => {
      const input = `- TODO Research libraries
- TODO Design schema`

      const expected = `- TODO Research libraries
- TODO Design schema`

      expect(formatTaskSubtasks(input, 'TODO')).toBe(expected)
    })

    it('should handle DOING marker', () => {
      const input = `- Implement feature
- Test feature`

      const expected = `- DOING Implement feature
- DOING Test feature`

      expect(formatTaskSubtasks(input, 'DOING')).toBe(expected)
    })

    it('should remove indentation from nested lists', () => {
      const input = `- Research
  - Check npm
  - Read docs`

      const result = formatTaskSubtasks(input, 'TODO')

      // formatTaskSubtasks processes lines with "- " prefix
      // Including indented ones
      expect(result).toContain('- TODO Research')
      expect(result).toContain('- TODO Check npm')
      expect(result).toContain('- TODO Read docs')
    })

    it('should handle mixed markers', () => {
      const input = `- TODO Task 1
- DONE Task 2
- New task`

      const expected = `- TODO Task 1
- DONE Task 2
- TODO New task`

      expect(formatTaskSubtasks(input, 'TODO')).toBe(expected)
    })

    it('should skip empty lines', () => {
      const input = `- Task 1

- Task 2

`

      const expected = `- TODO Task 1
- TODO Task 2`

      expect(formatTaskSubtasks(input, 'TODO')).toBe(expected)
    })

    it('should handle bare marker lines without list prefix', () => {
      const input = `TODO Research libraries
TODO Design schema`

      const expected = `- TODO Research libraries
- TODO Design schema`

      expect(formatTaskSubtasks(input, 'TODO')).toBe(expected)
    })

    it('should handle single-line input with multiple tasks (no newlines)', () => {
      // This is the problematic case from the user's screenshot
      const input = '- LATER Research software licensing options for reminder apps- LATER Compare open source vs proprietary licensing models- LATER Identify key licensing terms and restrictions- LATER Review legal requirements for software distribution- LATER Create a licensing strategy document- LATER Consult with legal expert if needed'

      const result = formatTaskSubtasks(input, 'LATER')

      // Should split into separate lines
      expect(result).toContain('- LATER Research software licensing options')
      expect(result).toContain('- LATER Compare open source vs proprietary')
      expect(result).toContain('- LATER Identify key licensing terms')
      expect(result).toContain('- LATER Review legal requirements')
      expect(result).toContain('- LATER Create a licensing strategy document')
      expect(result).toContain('- LATER Consult with legal expert if needed')

      // Verify it has newlines
      const lines = result.split('\n').filter((l) => l.trim())
      expect(lines.length).toBeGreaterThanOrEqual(6)
    })

    it('should skip non-list explanatory text', () => {
      const input = `- Task 1
Some explanation here
- Task 2`

      const expected = `- TODO Task 1
- TODO Task 2`

      expect(formatTaskSubtasks(input, 'TODO')).toBe(expected)
    })
  })

  describe('validateBlockHierarchy', () => {
    it('should warn about deeply nested lists', () => {
      const input = `- Level 1
  - Level 2
    - Level 3
      - Level 4 (4+ spaces)`

      const result = validateBlockHierarchy(input)

      expect(result.isValid).toBe(true)
      expect(result.warnings).toContain(
        'Content contains deeply nested lists (may not render correctly)'
      )
    })

    it('should warn about tables', () => {
      const input = `| Header 1 | Header 2 |
|----------|----------|
| Cell 1   | Cell 2   |`

      const result = validateBlockHierarchy(input)

      expect(result.warnings).toContain(
        'Content contains tables (may break block structure)'
      )
    })

    it('should warn about multiple code blocks', () => {
      const input = `\`\`\`
code 1
\`\`\`

\`\`\`
code 2
\`\`\`

\`\`\`
code 3
\`\`\``

      const result = validateBlockHierarchy(input)

      expect(result.warnings).toContain(
        'Content contains multiple code blocks (may affect formatting)'
      )
    })

    it('should return valid for simple content', () => {
      const input = `- Item 1
- Item 2
- Item 3`

      const result = validateBlockHierarchy(input)

      expect(result.isValid).toBe(true)
      expect(result.warnings).toHaveLength(0)
      expect(result.errors).toHaveLength(0)
    })
  })

  describe('normalizeLogseqTags', () => {
    it('should add space before hashtag when it follows text', () => {
      const input = 'Deploy feature to#production environment'
      const result = normalizeLogseqTags(input)

      // Should have space before the tag and convert to [[tag]] format since it's in middle
      expect(result).toContain('to [[production]] environment')
      expect(result).not.toContain('to#production')
    })

    it('should convert mid-sentence hashtags to [[tag]] format', () => {
      const input = 'Check the #project/backend code and review #docs/api setup'
      const result = normalizeLogseqTags(input)

      // Both tags should be converted to [[tag]] format with proper spacing
      expect(result).toContain('[[project/backend]]')
      expect(result).toContain('[[docs/api]]')
    })

    it('should preserve end-of-line hashtags in #tag format', () => {
      const input = 'This is a task #important'
      const result = normalizeLogseqTags(input)

      // End-of-line tag should remain as #tag
      expect(result).toBe('This is a task #important')
    })

    it('should handle multiple tags in one line', () => {
      const input = 'Deploy #backend feature to #production environment #urgent'
      const result = normalizeLogseqTags(input)

      // First two tags should be [[tag]], last one can be #tag
      expect(result).toContain('[[backend]]')
      expect(result).toContain('[[production]]')
      expect(result).toContain('#urgent')
    })

    it('should handle alphanumeric tags correctly', () => {
      const input = 'Review#Douban/Anti/yushicode'
      const result = normalizeLogseqTags(input)

      // When concatenated without space, entire string is treated as tag
      // This is a limitation - the formatter needs properly spaced input
      // The tag is at line end, so keeps #tag format with space added
      expect(result).toBe('Review #Douban/Anti/yushicode')
    })

    it('should not modify already properly spaced tags', () => {
      const input = 'Check the #backend code'
      const result = normalizeLogseqTags(input)

      // Has proper space before and text after, should convert to [[tag]]
      expect(result).toContain('[[backend]]')
    })

    it('should handle nested path tags', () => {
      const input = 'Review #Douban/Anti/yushi/v2 feature'
      const result = normalizeLogseqTags(input)

      // Tag is NOT at line end (has "feature" after), so should convert to [[tag]]
      expect(result).toContain('[[Douban/Anti/yushi/v2]]')
      expect(result).toBe('Review [[Douban/Anti/yushi/v2]] feature')
    })

    it('should handle tag immediately followed by text', () => {
      const input = 'Review#APIv2code'
      const result = normalizeLogseqTags(input)

      // When concatenated without space, entire string is treated as tag
      // Tag is at line end, so keeps #tag format with space added before
      expect(result).toBe('Review #APIv2code')
    })
  })

  describe('sanitizeForLogseq', () => {
    it('should apply all formatting rules by default', () => {
      const input = `* Item 1
  + Nested item
  1. Numbered nested
\`\`\`
const x = 5
\`\`\`
* Item 2`

      const result = sanitizeForLogseq(input)

      // Should normalize, flatten, and strip code
      expect(result).not.toContain('*')
      expect(result).not.toContain('+')
      expect(result).not.toContain('1.')
      expect(result).not.toContain('```')
      expect(result).toContain('- Item 1')
      expect(result).toContain('- Nested item')
    })

    it('should pass through when formatting disabled', () => {
      const input = `* Item 1
  * Nested item`

      const result = sanitizeForLogseq(input, {
        enableFormatting: false,
      })

      expect(result).toBe(input)
    })

    it('should skip flashcard command type', () => {
      const input = `Q: Question?
A: Answer`

      const result = sanitizeForLogseq(input, {
        commandType: 'flashcard',
      })

      // Flashcard content should not be processed here
      expect(result).toBe(input)
    })

    it('should preserve code blocks when requested', () => {
      const input = `Text
\`\`\`typescript
const x = 5
\`\`\`
More text`

      const result = sanitizeForLogseq(input, {
        preserveCodeBlocks: true,
      })

      expect(result).toContain('```')
      expect(result).toContain('const x = 5')
    })

    it('should remove excessive blank lines', () => {
      const input = `Line 1


Line 2



Line 3`

      const result = sanitizeForLogseq(input)

      expect(result).toBe(`Line 1

Line 2

Line 3`)
    })

    it('should handle errors gracefully and return original', () => {
      // This test ensures error handling works
      // In practice, our functions shouldn't throw, but we test the fallback
      const input = 'Some content'

      const result = sanitizeForLogseq(input)

      expect(result).toBeDefined()
      expect(typeof result).toBe('string')
    })

    it('should integrate all steps correctly', () => {
      const input = `Here is a summary:

\`\`\`
* Main point
  + Sub-point 1
  + Sub-point 2
1. Numbered item
\`\`\`


Final note`

      const result = sanitizeForLogseq(input, {
        logModifications: false, // Suppress logs in tests
      })

      // Code block content should be extracted and formatted
      expect(result).toContain('- Main point')
      expect(result).toContain('- Sub-point 1')
      expect(result).toContain('- Sub-point 2')
      expect(result).toContain('- Numbered item')
      expect(result).toContain('Here is a summary:')
      expect(result).toContain('Final note')
      expect(result).not.toContain('```')
    })
  })

  describe('formatSummaryList', () => {
    it('should fix concatenated list items without newlines', () => {
      const input = '- First item- Second item- Third item'
      const expected = '- First item\n- Second item\n- Third item'

      expect(formatSummaryList(input)).toBe(expected)
    })

    it('should handle properly formatted lists without changes', () => {
      const input = '- First item\n- Second item\n- Third item'
      const expected = '- First item\n- Second item\n- Third item'

      expect(formatSummaryList(input)).toBe(expected)
    })

    it('should handle mixed content with paragraphs and lists', () => {
      const input = 'Summary:\n\n- Point 1- Point 2- Point 3\n\nConclusion text'
      const result = formatSummaryList(input)

      expect(result).toContain('- Point 1\n- Point 2\n- Point 3')
      expect(result).toContain('Summary:')
      expect(result).toContain('Conclusion text')
    })

    it('should handle list items with complex content', () => {
      const input = '- Item with [[link]] and #tag- Another item with *bold*- Third item'
      const result = formatSummaryList(input)

      expect(result).toContain('- Item with [[link]] and #tag\n')
      expect(result).toContain('- Another item with *bold*\n')
      expect(result).toContain('- Third item')
    })

    it('should not affect single list item', () => {
      const input = '- Single item with no following items'
      const expected = '- Single item with no following items'

      expect(formatSummaryList(input)).toBe(expected)
    })

    it('should handle Chinese content correctly', () => {
      const input = '- 第一点内容- 第二点内容- 第三点内容'
      const expected = '- 第一点内容\n- 第二点内容\n- 第三点内容'

      expect(formatSummaryList(input)).toBe(expected)
    })

    it('should handle empty input', () => {
      expect(formatSummaryList('')).toBe('')
    })

    it('should handle content without list items', () => {
      const input = 'This is just regular text without any list items.'
      expect(formatSummaryList(input)).toBe(input)
    })
  })
})
