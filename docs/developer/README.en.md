# Developer Documentation

**[English](README.en.md)** | [中文](README.zh.md)

Technical documentation for building and extending this app. These docs describe established patterns and are intended for both human developers and AI coding agents.

## Architecture & Patterns

| Document                                         | Description                                             |
| ------------------------------------------------ | ------------------------------------------------------- |
| [Architecture Guide](./architecture-guide.en.md) | High-level overview, mental models, system architecture |
| [Rust Architecture](./rust-architecture.en.md)   | Rust module organization and patterns                   |
| [State Management](./state-management.en.md)     | Three-layer state onion, Zustand, TanStack Query        |
| [Error Handling](./error-handling.en.md)         | Error propagation, user feedback, retry patterns        |

## Core Systems

| Document                                         | Description                                     |
| ------------------------------------------------ | ----------------------------------------------- |
| [Command System](./command-system.en.md)         | Unified action dispatch, command registration   |
| [Keyboard Shortcuts](./keyboard-shortcuts.en.md) | Global shortcut handling, platform modifiers    |
| [Menus](./menus.en.md)                           | Native menu building with i18n                  |
| [Quick Panes](./quick-panes.en.md)               | Multi-window quick entry pattern                |
| [Tauri Commands](./tauri-commands.en.md)         | Type-safe Rust-TypeScript bridge (tauri-specta) |
| [Tauri Plugins](./tauri-plugins.en.md)           | Plugin usage and configuration                  |

## UI & UX

| Document                                      | Description                                 |
| --------------------------------------------- | ------------------------------------------- |
| [UI Patterns](./ui-patterns.en.md)            | CSS architecture, shadcn/ui components      |
| [Internationalization](./i18n-patterns.en.md) | Translation system, RTL support             |
| [Notifications](./notifications.en.md)        | Toast and native notifications              |
| [Cross-Platform](./cross-platform.en.md)      | Platform detection, OS-specific adaptations |

## Data & Storage

| Document                                     | Description                                  |
| -------------------------------------------- | -------------------------------------------- |
| [Data Persistence](./data-persistence.en.md) | File storage patterns, atomic writes, SQLite |
| [External APIs](./external-apis.en.md)       | HTTP API calls, authentication, caching      |

## Quality & Tooling

| Document                                                 | Description                                             |
| -------------------------------------------------------- | ------------------------------------------------------- |
| [Static Analysis](./static-analysis.en.md)               | ESLint, Prettier, ast-grep, knip, jscpd, React Compiler |
| [Writing ast-grep Rules](./writing-ast-grep-rules.en.md) | AI reference for creating custom rules                  |
| [Testing](./testing.en.md)                               | Test patterns, Tauri mocking                            |
| [Bundle Optimization](./bundle-optimization.en.md)       | Bundle size management                                  |
| [Logging](./logging.en.md)                               | Rust and TypeScript logging                             |
| [Observability](./observability.en.md)                   | Sentry integration, consent gate, extension points      |
| [Writing Docs](./writing-docs.en.md)                     | Guide for creating and maintaining these docs           |

## Release & Distribution

| Document                     | Description                            |
| ---------------------------- | -------------------------------------- |
| [Releases](./releases.en.md) | Release process, signing, auto-updates |

---

**Updating these docs:** When adding new patterns or systems, update the relevant doc file and add a link here if creating a new document.
