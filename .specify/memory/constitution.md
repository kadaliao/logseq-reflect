<!--
SYNC IMPACT REPORT
==================
Version Change: None → 1.0.0
Constitution Type: MAJOR - Initial establishment of project governance

Modified Principles: N/A (initial creation)

Added Sections:
- Core Principles (5 principles covering code quality, testing, UX, performance, maintainability)
- Quality Standards (technical quality metrics and requirements)
- Development Workflow (process and review requirements)
- Governance (amendment procedures and compliance)

Removed Sections: N/A (initial creation)

Templates Requiring Updates:
✅ .specify/templates/plan-template.md - Constitution Check section aligns with principles
✅ .specify/templates/spec-template.md - Requirements sections support principle validation
✅ .specify/templates/tasks-template.md - Task categories reflect principle-driven development
✅ .specify/templates/agent-file-template.md - No updates required (generic template)
✅ .specify/templates/checklist-template.md - No verification needed (not examined yet)

Follow-up TODOs:
- Monitor adherence to 95% test success rate metric
- Establish baseline performance metrics for TypeScript compilation and plugin load time
- Document specific accessibility testing procedures for Logseq plugin environment
-->

# Logseq Reflect Constitution

## Core Principles

### I. Code Quality First

All code MUST meet production-grade quality standards before merging:

- **Type Safety**: TypeScript strict mode enabled; no `any` types without explicit justification
- **Error Handling**: All async operations MUST have try-catch blocks; all user-facing errors MUST provide actionable feedback
- **Code Review**: All changes MUST be reviewed by at least one other developer before merge
- **Documentation**: Public APIs MUST have JSDoc comments; complex logic MUST include inline explanations
- **Linting**: All code MUST pass ESLint and Prettier checks without warnings

**Rationale**: High code quality reduces bugs, improves maintainability, and ensures long-term project sustainability. Users depend on plugin stability within their note-taking workflow.

### II. Test-Driven Development (NON-NEGOTIABLE)

Testing MUST follow a disciplined, incremental approach:

- **Test-First for Critical Paths**: For user-facing features (commands, LLM integration, block operations), write tests BEFORE implementation
- **Test Categories**: MUST include unit tests for business logic, integration tests for Logseq API interactions, and contract tests for LLM client interfaces
- **Coverage Requirements**: Minimum 80% code coverage for services and utilities; 100% coverage for critical paths (data transformations, API calls)
- **Test Quality**: Tests MUST be deterministic, isolated, and fast (unit tests <100ms, integration tests <1s)
- **Failure Protocol**: If tests fail, implementation MUST stop; fix tests or code before proceeding

**Rationale**: Logseq plugins interact with user data and external AI services. Test-first development catches integration issues early and prevents data loss or corruption. The 95% success rate target from the PRD requires robust testing.

### III. User Experience Consistency

All user interactions MUST provide predictable, accessible, and delightful experiences:

- **Feedback Loops**: Every async operation MUST show progress (spinner, placeholder text, streaming updates)
- **Error Recovery**: Failed operations MUST display clear error messages with suggested fixes; MUST never leave UI in broken state
- **Accessibility**: All UI components MUST support keyboard navigation; color choices MUST meet WCAG AA contrast ratios; screen reader labels MUST be provided
- **Theme Compatibility**: UI MUST adapt to Logseq light/dark themes automatically
- **Consistency**: Command names, icons, and behaviors MUST follow Logseq conventions; similar operations MUST have similar UX patterns

**Rationale**: Users integrate this plugin into their daily knowledge workflow. Inconsistent or confusing UX breaks flow state and reduces adoption. Accessibility ensures inclusivity.

### IV. Performance Requirements

The plugin MUST maintain responsiveness under typical and edge-case loads:

- **Plugin Load Time**: Initial load MUST complete in <2 seconds on modern hardware
- **Command Response**: UI feedback MUST appear within 100ms of user action (even if backend processing continues)
- **Streaming Efficiency**: LLM streaming responses MUST render incrementally without blocking the main thread
- **Memory Management**: Plugin MUST not exceed 100MB memory footprint under normal operation; MUST clean up resources on unload
- **Context Handling**: Large page/block contexts (>10k tokens) MUST be truncated or summarized intelligently without user-visible delays

**Rationale**: Performance directly impacts user productivity. Slow plugins disrupt note-taking flow. The PRD emphasizes "5-minute setup" and smooth UX, requiring fast, predictable performance.

### V. Maintainability & Extensibility

Code architecture MUST support long-term evolution and community contribution:

- **Modularity**: Clear separation between LLM client, command handlers, UI components, and Logseq API wrappers
- **Extensibility Points**: Custom commands, model configurations, and prompt templates MUST be user-configurable without code changes
- **Dependency Management**: External dependencies MUST be minimized; MUST document upgrade paths and breaking changes
- **Logging & Debugging**: All critical operations MUST log to console with structured, searchable messages; MUST include debug mode for troubleshooting
- **Code Simplicity**: Favor explicit over clever; avoid premature abstraction; YAGNI principles apply

**Rationale**: The PRD emphasizes customization (custom prompts, model switching, block attributes). Maintainable architecture enables community contributions and feature iteration without technical debt.

## Quality Standards

### Technical Metrics

Projects MUST meet these measurable quality gates:

- **Build Success**: TypeScript compilation MUST complete without errors; warnings MUST be addressed before merge
- **Test Success Rate**: ≥95% of automated tests MUST pass on every commit
- **Bundle Size**: Plugin bundle MUST remain <500KB (minified, gzipped) to ensure fast loading
- **Runtime Errors**: Production error rate MUST be <1% of plugin loads (tracked via opt-in telemetry)
- **API Compatibility**: MUST support minimum Logseq version specified in manifest; MUST document breaking changes

### Code Review Standards

Pull requests MUST satisfy these criteria:

1. **Functional Requirements**: Implements exactly what spec/PRD describes; no scope creep
2. **Test Coverage**: Includes tests for new code paths; updates existing tests for changes
3. **Documentation**: Updates README, JSDoc, and inline comments where needed
4. **Performance**: No regressions in load time, memory usage, or responsiveness (benchmark if uncertain)
5. **Security**: No exposure of API keys, user data, or injection vulnerabilities (XSS, command injection)

## Development Workflow

### Feature Development Process

1. **Specification**: All features MUST have a spec (`.specify/specs/###-feature/spec.md`) defining user stories, acceptance criteria, and success metrics
2. **Planning**: Implementation plan MUST identify technical approach, affected files, and constitution compliance checks
3. **Test Design**: Write contract and integration tests FIRST; verify they fail before implementation
4. **Implementation**: Develop in small commits; run tests frequently; fix failures immediately
5. **Review & Validation**: Code review + manual testing against acceptance criteria
6. **Documentation**: Update user-facing docs (README, settings descriptions) and developer docs (architecture notes)

### Continuous Integration

CI pipeline MUST enforce:

- Linting and formatting checks (ESLint, Prettier)
- TypeScript compilation without errors
- Full test suite execution (unit, integration, contract tests)
- Bundle size verification (<500KB threshold)
- Accessibility checks (automated WCAG validation where applicable)

## Governance

### Amendment Procedure

Constitution changes require:

1. **Proposal**: Document proposed change with rationale and impact assessment
2. **Discussion**: Review with maintainers; assess effects on existing workflows
3. **Approval**: Consensus among core maintainers (or project owner decision for solo projects)
4. **Migration**: Update all dependent templates (plan, spec, tasks) for consistency
5. **Versioning**: Increment constitution version per semantic versioning rules

### Versioning Policy

- **MAJOR**: Breaking changes to principles (e.g., removing test-first requirement, relaxing quality gates)
- **MINOR**: New principles added or existing principles expanded (e.g., adding security principle)
- **PATCH**: Clarifications, wording improvements, non-semantic updates

### Compliance Review

- All specs MUST include constitution check section verifying principle adherence
- All PRs MUST confirm no constitution violations in review checklist
- Quarterly reviews MUST assess whether principles remain relevant and achievable
- Violations MUST be justified with "Complexity Tracking" entries in plan.md

**Version**: 1.0.0 | **Ratified**: 2026-01-05 | **Last Amended**: 2026-01-05
