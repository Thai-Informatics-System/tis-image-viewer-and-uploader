# Copilot Instructions - Project Guidelines

## Purpose

This file establishes guidelines for AI assistants (GitHub Copilot, Claude, etc.) working on this project.

## Critical Rule: Keep Architecture Documentation in Sync

**IMPORTANT**: Whenever you complete any task that involves changes to:
- Project structure or architecture
- Component interfaces or APIs
- WebSocket messages or communication protocols
- State management or data flow
- Configuration options or properties
- New features or major refactoring

**YOU MUST** update the `.github/instructions/architecture.instructions.md` file to reflect these changes.

### When to Update Architecture Documentation

Update `architecture.instructions.md` after completing:

✅ Adding new components or services
✅ Modifying existing interfaces (TisSocketAdapter, TisRemoteUploadConfig, etc.)
✅ Changing WebSocket message formats
✅ Adding/modifying API endpoints
✅ Updating state machines or flow diagrams
✅ Adding new configuration options
✅ Refactoring major features
✅ Changing component properties (@Input/@Output)

### How to Update

1. Complete your implementation task first
2. Review what changed from an architecture perspective
3. Update the relevant sections in `architecture.instructions.md`:
   - Flow diagrams
   - State machines
   - Interface definitions
   - Sequence diagrams
   - Component properties
   - Configuration examples
4. Update the "Last Updated" timestamp at the bottom
5. Commit architecture documentation changes WITH your implementation changes

**Goal**: The architecture documentation should always accurately reflect the current state of the codebase, serving as the single source of truth for AI assistants and developers.

## Instruction Files

Whenever an important decision is made or a key finding is discovered about this project, the LLM should:

1. **Create a new `.instructions.md` file** in this folder (`.github/instructions/`) if no related file exists
2. **Update an existing `.instructions.md` file** if one already covers the topic

### Naming Convention

Files should be named descriptively with the `.instructions.md` suffix:
- `architecture.instructions.md` - System architecture and design patterns
- `api-design.instructions.md` - API contracts and interfaces
- `testing.instructions.md` - Testing strategies and patterns
- `deployment.instructions.md` - Build, deployment, and publishing
- `mobile-upload.instructions.md` - Mobile upload feature specifics
- `socket-communication.instructions.md` - WebSocket patterns and protocols

### What to Document

- **Architecture decisions** - Why certain patterns were chosen
- **Key interfaces** - Important contracts between components
- **Integration points** - How components communicate
- **Configuration** - Important settings and their purposes
- **Gotchas** - Non-obvious issues or requirements
- **Dependencies** - External dependencies and their purposes

## File Format

Each instruction file should follow this structure:

```markdown
# [Topic Name]

## Overview
Brief description of what this file covers.

## Key Points
- Important point 1
- Important point 2

## Details
Detailed explanation with code examples if relevant.

## Related Files
- List of related source files
- Other instruction files that relate

## Last Updated
Date and brief description of last update.
```

## Current Instruction Files

| File | Description |
|------|-------------|
| `copilot-instructions.instructions.md` | This file - guidelines for AI assistants |
| `architecture.instructions.md` | Project architecture and structure |

---

*This file should be read by AI assistants at the start of any session working on this project.*
