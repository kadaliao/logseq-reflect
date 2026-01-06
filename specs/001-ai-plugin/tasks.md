# Tasks: Logseq AI Plugin

**Input**: Design documents from `/specs/001-ai-plugin/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: Tests are included as per constitution requirement for Test-Driven Development.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Single project**: `src/`, `tests/` at repository root
- Paths shown below follow single Logseq plugin project structure

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

- [x] T001 Initialize Node.js project with pnpm in project root
- [x] T002 [P] Install dependencies: @logseq/libs, react, react-dom, vite, vitest, typescript per package.json
- [x] T003 [P] Configure TypeScript with strict mode in tsconfig.json
- [x] T004 [P] Configure Vite build with React plugin in vite.config.ts
- [x] T005 [P] Configure Vitest for testing in vitest.config.ts
- [x] T006 [P] Configure ESLint with TypeScript and React rules in .eslintrc.js
- [x] T007 [P] Configure Prettier formatting in .prettierrc
- [x] T008 Create project directory structure: src/, src/commands/, src/llm/, src/context/, src/ui/, src/config/, src/utils/, tests/unit/, tests/integration/, tests/contract/
- [x] T009 Create plugin manifest file package.json with Logseq plugin metadata

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

### Type Definitions

- [x] T010 [P] Define AICommand interface in src/types.ts
- [x] T011 [P] Define ModelConfiguration interface in src/types.ts
- [x] T012 [P] Define RequestContext interface in src/types.ts
- [x] T013 [P] Define ResponseHandler interface in src/types.ts
- [x] T014 [P] Define BlockPropertySet interface in src/types.ts
- [x] T015 [P] Define CustomCommandDefinition interface in src/types.ts

### Core Infrastructure

- [x] T016 Create Logger utility with debug mode support in src/utils/logger.ts
- [x] T017 Create token estimation utility in src/utils/tokens.ts
- [x] T018 Implement settings schema and defaults in src/config/settings.ts
- [x] T019 Implement property validation logic in src/config/validator.ts

### LLM Client Foundation (Critical Path - Test First)

- [x] T020 Write contract test for LLM client chat() method in tests/contract/llm-client.test.ts
- [x] T021 Write contract test for LLM client stream() method in tests/contract/llm-client.test.ts
- [x] T022 Implement OpenAI-compatible LLM client base in src/llm/client.ts
- [x] T023 Implement SSE streaming response parser in src/llm/streaming.ts
- [x] T024 Implement LLM request/response types in src/llm/types.ts
- [x] T025 Write unit tests for streaming parser in tests/unit/llm/streaming.test.ts

### Command Registry Foundation

- [x] T026 Implement command registry core in src/commands/registry.ts
- [x] T027 Write unit tests for command registry in tests/unit/commands/registry.test.ts

### Context Extraction Foundation (Critical Path - Test First)

- [x] T028 Write unit tests for page context extraction in tests/unit/context/extractor.test.ts
- [x] T029 Write unit tests for context truncation in tests/unit/context/truncator.test.ts
- [x] T030 Implement page/block content extractor in src/context/extractor.ts
- [x] T031 Implement context truncation logic in src/context/truncator.ts
- [x] T032 Implement block property parser with inheritance in src/context/property.ts
- [x] T033 Write unit tests for property parser in tests/unit/context/property.test.ts

### Plugin Entry Point

- [x] T034 Create plugin entry point with lifecycle hooks in src/index.tsx
- [x] T035 Create React app bootstrap in src/main.tsx

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - Basic AI Question & Answer (Priority: P1) 🎯 MVP

**Goal**: Users can ask AI questions and receive answers as new blocks

**Independent Test**: Install plugin, open command palette, select "Ask AI", type question, verify answer appears as new block

### Tests for User Story 1 (Test-First)

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [x] T036 [P] [US1] Write contract test for Ask AI command execution in tests/contract/ask-command.test.ts
- [x] T037 [P] [US1] Write integration test for command palette invocation in tests/integration/command-palette.test.ts
- [x] T038 [P] [US1] Write integration test for block creation and update in tests/integration/block-operations.test.ts

### Implementation for User Story 1

- [x] T039 [P] [US1] Create ErrorDisplay component in src/ui/ErrorDisplay.tsx
- [x] T040 [P] [US1] Create PromptInput component with debouncing in src/ui/PromptInput.tsx
- [x] T041 [US1] Create CommandPalette component with keyboard navigation in src/ui/CommandPalette.tsx (Using Logseq built-in)
- [x] T042 [US1] Implement Ask AI command handler in src/commands/ask.ts
- [x] T043 [US1] Implement ResponseHandler for placeholder and streaming updates in src/llm/response-handler.ts
- [x] T044 [US1] Register Ask AI command in registry with toolbar button in src/commands/registry.ts
- [x] T045 [US1] Register keyboard shortcut for command palette in src/index.tsx
- [x] T046 [US1] Register slash command /ai in src/index.tsx
- [x] T047 [US1] Add error handling for network failures in src/llm/client.ts
- [x] T048 [US1] Add timeout and retry logic in src/llm/client.ts
- [x] T049 [US1] Implement fallback block creation at page end in src/commands/ask.ts
- [x] T050 [US1] Write unit tests for Ask AI command handler in tests/unit/commands/ask.test.ts
- [x] T051 [US1] Write unit tests for ResponseHandler in tests/unit/llm/response-handler.test.ts

**Checkpoint**: At this point, User Story 1 should be fully functional and testable independently

---

## Phase 4: User Story 2 - Context-Aware Questions (Priority: P2)

**Goal**: Users can ask AI questions with automatic page or block context inclusion

**Independent Test**: Create page with content, select "Ask with page context", ask question about content, verify AI understands context

### Tests for User Story 2 (Test-First)

- [ ] T052 [P] [US2] Write contract test for page context extraction in tests/contract/context-extraction.test.ts
- [ ] T053 [P] [US2] Write integration test for context-aware command execution in tests/integration/context-commands.test.ts

### Implementation for User Story 2

- [ ] T054 [P] [US2] Implement "Ask with page context" command handler in src/commands/context.ts
- [ ] T055 [P] [US2] Implement "Ask with block context" command handler in src/commands/context.ts
- [ ] T056 [US2] Add page context strategy to extractor in src/context/extractor.ts
- [ ] T057 [US2] Add block context strategy to extractor in src/context/extractor.ts
- [ ] T058 [US2] Add selection context strategy to extractor in src/context/extractor.ts
- [ ] T059 [US2] Implement smart truncation for large contexts in src/context/truncator.ts
- [ ] T060 [US2] Add empty context fallback handling in src/commands/context.ts
- [ ] T061 [US2] Register context-aware commands in registry in src/commands/registry.ts
- [ ] T062 [US2] Write unit tests for context command handlers in tests/unit/commands/context.test.ts

**Checkpoint**: At this point, User Stories 1 AND 2 should both work independently

---

## Phase 5: User Story 3 - Content Summarization (Priority: P3)

**Goal**: Users can generate summaries of pages or block trees with streaming updates

**Independent Test**: Create page with multiple paragraphs, select "Summarize page", verify concise summary appears

### Tests for User Story 3 (Test-First)

- [ ] T063 [P] [US3] Write contract test for summarization prompt template in tests/contract/summarize.test.ts
- [ ] T064 [P] [US3] Write integration test for streaming summary updates in tests/integration/streaming.test.ts

### Implementation for User Story 3

- [ ] T065 [P] [US3] Implement "Summarize page" command handler in src/commands/summarize.ts
- [ ] T066 [P] [US3] Implement "Summarize block" command handler in src/commands/summarize.ts
- [ ] T067 [US3] Add summarization prompt templates in src/commands/summarize.ts
- [ ] T068 [US3] Implement incremental block updates for streaming in src/llm/response-handler.ts
- [ ] T069 [US3] Add batched updates (50ms intervals) for streaming efficiency in src/llm/response-handler.ts
- [ ] T070 [US3] Implement request cancellation on window close in src/llm/response-handler.ts
- [ ] T071 [US3] Register summarize commands in context menu in src/commands/registry.ts
- [ ] T072 [US3] Write unit tests for summarize handlers in tests/unit/commands/summarize.test.ts

**Checkpoint**: All user stories 1-3 should now be independently functional

---

## Phase 6: User Story 4 - Flashcard Generation (Priority: P4)

**Goal**: Users can convert note content into question-answer flashcard pairs with #card tag

**Independent Test**: Select block with factual content, invoke "Generate flashcard", verify two blocks created with #card tag

### Tests for User Story 4 (Test-First)

- [ ] T073 [P] [US4] Write contract test for flashcard generation prompt in tests/contract/flashcard.test.ts
- [ ] T074 [P] [US4] Write integration test for nested block creation in tests/integration/flashcard.test.ts

### Implementation for User Story 4

- [ ] T075 [US4] Implement "Generate flashcard" command handler in src/commands/flashcard.ts
- [ ] T076 [US4] Add flashcard prompt template in src/commands/flashcard.ts
- [ ] T077 [US4] Implement nested block creation with #card tag in src/commands/flashcard.ts
- [ ] T078 [US4] Add insufficient content detection and user feedback in src/commands/flashcard.ts
- [ ] T079 [US4] Register flashcard command in context menu in src/commands/registry.ts
- [ ] T080 [US4] Write unit tests for flashcard handler in tests/unit/commands/flashcard.test.ts

**Checkpoint**: User Stories 1-4 independently functional

---

## Phase 7: User Story 5 - Task Breakdown (Priority: P5)

**Goal**: Users can decompose TODO items into nested subtasks with proper indentation

**Independent Test**: Create TODO block with description, select "Divide into subtasks", verify structured hierarchy generated

### Tests for User Story 5 (Test-First)

- [ ] T081 [P] [US5] Write contract test for task breakdown prompt in tests/contract/tasks.test.ts
- [ ] T082 [P] [US5] Write integration test for TODO status preservation in tests/integration/tasks.test.ts

### Implementation for User Story 5

- [ ] T083 [US5] Implement "Divide into subtasks" command handler in src/commands/tasks.ts
- [ ] T084 [US5] Add task breakdown prompt template in src/commands/tasks.ts
- [ ] T085 [US5] Implement TODO block detection in src/commands/tasks.ts
- [ ] T086 [US5] Implement nested subtask generation with indentation in src/commands/tasks.ts
- [ ] T087 [US5] Add non-TODO block handling with user feedback in src/commands/tasks.ts
- [ ] T088 [US5] Register task breakdown command in context menu in src/commands/registry.ts
- [ ] T089 [US5] Write unit tests for task breakdown handler in tests/unit/commands/tasks.test.ts

**Checkpoint**: User Stories 1-5 independently functional

---

## Phase 8: User Story 6 - Custom Commands (Priority: P6)

**Goal**: Advanced users can define custom commands via ai-command-config page without code changes

**Independent Test**: Create config block with custom prompt, reload plugin, verify new command appears in palette and context menu

### Tests for User Story 6 (Test-First)

- [ ] T090 [P] [US6] Write unit test for config page scanning in tests/unit/config/loader.test.ts
- [ ] T091 [P] [US6] Write unit test for custom command registration in tests/unit/config/loader.test.ts
- [ ] T092 [P] [US6] Write integration test for custom command execution in tests/integration/custom-commands.test.ts

### Implementation for User Story 6

- [ ] T093 [US6] Implement custom command loader in src/config/loader.ts
- [ ] T094 [US6] Implement ai-command-config page scanner in src/config/loader.ts
- [ ] T095 [US6] Implement custom command to AICommand converter in src/config/loader.ts
- [ ] T096 [US6] Add custom command refresh mechanism in src/config/loader.ts
- [ ] T097 [US6] Register custom command handler in src/commands/custom.ts
- [ ] T098 [US6] Integrate custom command loader on plugin initialization in src/index.tsx
- [ ] T099 [US6] Add prompt template variable substitution in src/commands/custom.ts
- [ ] T100 [US6] Write unit tests for custom command handler in tests/unit/commands/custom.test.ts

**Checkpoint**: User Stories 1-6 independently functional

---

## Phase 9: User Story 7 - Block-Level Configuration (Priority: P7)

**Goal**: Users can override model settings per block using block properties with inheritance

**Independent Test**: Add ai-generate-model property to block, invoke command, verify specified model is used

### Tests for User Story 7 (Test-First)

- [ ] T101 [P] [US7] Write unit test for property inheritance in tests/unit/context/property.test.ts
- [ ] T102 [P] [US7] Write unit test for property validation in tests/unit/config/validator.test.ts
- [ ] T103 [P] [US7] Write integration test for model override in tests/integration/property-override.test.ts

### Implementation for User Story 7

- [ ] T104 [US7] Enhance property parser to support all ai-generate-* properties in src/context/property.ts
- [ ] T105 [US7] Implement ancestor traversal for property inheritance in src/context/property.ts
- [ ] T106 [US7] Add property memoization for performance in src/context/property.ts
- [ ] T107 [US7] Implement property validation with warnings in src/config/validator.ts
- [ ] T108 [US7] Integrate property resolution into LLM client request building in src/llm/client.ts
- [ ] T109 [US7] Add precedence handling for conflicting properties in src/context/property.ts
- [ ] T110 [US7] Document property inheritance in user-facing help in src/config/settings.ts

**Checkpoint**: All 7 user stories should now be independently functional

---

## Phase 10: Settings & Configuration UI

**Purpose**: User-facing configuration interface

- [ ] T111 [P] Create SettingsPanel component with form validation in src/ui/SettingsPanel.tsx
- [ ] T112 [P] Implement settings persistence via Logseq storage API in src/config/settings.ts
- [ ] T113 Register settings panel in plugin settings in src/index.tsx
- [ ] T114 Add default settings initialization on first load in src/index.tsx
- [ ] T115 Implement settings validation and migration in src/config/validator.ts
- [ ] T116 Write unit tests for settings panel in tests/unit/ui/SettingsPanel.test.ts

---

## Phase 11: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [ ] T117 [P] Add ARIA labels for accessibility in all UI components
- [ ] T118 [P] Implement WCAG AA contrast checking for loading indicators
- [ ] T119 [P] Add theme variable integration for light/dark mode support
- [ ] T120 [P] Optimize bundle size with code splitting for ui/ modules
- [ ] T121 [P] Add bundle size check to build script (500KB limit)
- [ ] T122 [P] Implement error boundaries for React components
- [ ] T123 [P] Add structured console logging throughout codebase
- [ ] T124 Add memory cleanup on plugin unload in src/index.tsx
- [ ] T125 Add request cancellation on navigation in src/llm/response-handler.ts
- [ ] T126 Implement malformed response filtering in src/llm/client.ts
- [ ] T127 [P] Write README.md with installation and usage instructions
- [ ] T128 [P] Add JSDoc comments to all public APIs
- [ ] T129 [P] Run quickstart.md validation scenarios
- [ ] T130 Run full test suite and verify ≥80% coverage
- [ ] T131 Run bundle size analysis and optimize if needed
- [ ] T132 Performance profiling: verify <2s load time, <100ms UI feedback

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3-9)**: All depend on Foundational phase completion
  - User stories can proceed in parallel (if staffed)
  - Or sequentially in priority order (P1 → P2 → P3 → P4 → P5 → P6 → P7)
- **Settings UI (Phase 10)**: Can proceed in parallel with user stories after Foundational
- **Polish (Phase 11)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 2 (P2)**: Can start after Foundational (Phase 2) - No dependencies on other stories (independent)
- **User Story 3 (P3)**: Can start after Foundational (Phase 2) - Uses context extraction but independently testable
- **User Story 4 (P4)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 5 (P5)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 6 (P6)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 7 (P7)**: Can start after Foundational (Phase 2) - Enhances property system but independent

### Within Each User Story

- Tests MUST be written and FAIL before implementation
- UI components before command handlers (where applicable)
- Command handlers before registry registration
- Core implementation before edge case handling
- Story complete before moving to next priority

### Parallel Opportunities

- All Setup tasks marked [P] can run in parallel
- All Foundational tasks marked [P] can run in parallel (within Phase 2)
- Once Foundational phase completes, all user stories can start in parallel (if team capacity allows)
- All tests for a user story marked [P] can run in parallel
- UI components within a story marked [P] can run in parallel
- Different user stories can be worked on in parallel by different team members

---

## Parallel Example: User Story 1

```bash
# Launch all tests for User Story 1 together (Test-First):
Task: "Write contract test for Ask AI command execution in tests/contract/ask-command.test.ts"
Task: "Write integration test for command palette invocation in tests/integration/command-palette.test.ts"
Task: "Write integration test for block creation and update in tests/integration/block-operations.test.ts"

# After tests fail, launch all UI components for User Story 1 together:
Task: "Create ErrorDisplay component in src/ui/ErrorDisplay.tsx"
Task: "Create PromptInput component with debouncing in src/ui/PromptInput.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL - blocks all stories)
3. Complete Phase 3: User Story 1
4. **STOP and VALIDATE**: Test User Story 1 independently
5. Deploy/demo if ready

**MVP Scope**: Tasks T001-T051 (51 tasks)
**MVP Deliverable**: Basic AI Q&A capability with command palette, streaming responses, error handling

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready (Tasks T001-T035)
2. Add User Story 1 → Test independently → Deploy/Demo (MVP!) (Tasks T036-T051)
3. Add User Story 2 → Test independently → Deploy/Demo (Tasks T052-T062)
4. Add User Story 3 → Test independently → Deploy/Demo (Tasks T063-T072)
5. Add User Story 4 → Test independently → Deploy/Demo (Tasks T073-T080)
6. Add User Story 5 → Test independently → Deploy/Demo (Tasks T081-T089)
7. Add User Story 6 → Test independently → Deploy/Demo (Tasks T090-T100)
8. Add User Story 7 → Test independently → Deploy/Demo (Tasks T101-T110)
9. Complete Settings UI + Polish → Production-ready (Tasks T111-T132)

Each story adds value without breaking previous stories.

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together (Tasks T001-T035)
2. Once Foundational is done:
   - Developer A: User Story 1 (Tasks T036-T051)
   - Developer B: User Story 2 (Tasks T052-T062)
   - Developer C: User Story 3 (Tasks T063-T072)
   - Developer D: Settings UI (Tasks T111-T116)
3. Stories complete and integrate independently
4. Continue with remaining stories (P4-P7) as capacity allows
5. Polish phase together (Tasks T117-T132)

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Verify tests fail before implementing (TDD)
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Avoid: vague tasks, same file conflicts, cross-story dependencies that break independence

---

## Task Statistics

- **Total Tasks**: 132
- **Setup Phase**: 9 tasks
- **Foundational Phase**: 26 tasks (includes tests)
- **User Story 1 (P1 - MVP)**: 16 tasks
- **User Story 2 (P2)**: 11 tasks
- **User Story 3 (P3)**: 10 tasks
- **User Story 4 (P4)**: 8 tasks
- **User Story 5 (P5)**: 9 tasks
- **User Story 6 (P6)**: 11 tasks
- **User Story 7 (P7)**: 10 tasks
- **Settings UI**: 6 tasks
- **Polish Phase**: 16 tasks

**Parallel Tasks**: 71 marked [P] (54% can run in parallel)
**Test Tasks**: 28 (21% of total - covering contract, integration, and unit tests)
**MVP Scope**: 51 tasks (39% of total)
