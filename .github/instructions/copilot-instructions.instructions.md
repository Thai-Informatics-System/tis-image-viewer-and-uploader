# Copilot Instructions - Project Guidelines

## Purpose

This file establishes guidelines for AI assistants (GitHub Copilot, Claude, etc.) working on this project.

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
