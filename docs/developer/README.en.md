# Developer Documentation

**[English](README.en.md)** | [中文](README.zh.md)

Technical documentation for building and extending this app. These docs describe
established patterns and are intended for both human developers and AI coding agents.

## Core

| Document                                         | Description                                             |
| ------------------------------------------------ | ------------------------------------------------------- |
| [Architecture Guide](./architecture-guide.en.md) | High-level overview, mental models, system architecture |
| [State Management](./state-management.en.md)     | Three-layer state onion, Zustand, TanStack Query        |
| [Error Handling](./error-handling.en.md)         | Error propagation, user feedback, retry patterns        |
| [Tauri Commands](./tauri-commands.en.md)         | Type-safe Rust-TypeScript bridge (tauri-specta)         |
| [Internationalization](./i18n-patterns.en.md)    | Translation system, RTL support                         |
| [Static Analysis](./static-analysis.en.md)       | ESLint, Prettier, ast-grep, knip, jscpd, React Compiler |
| [Releases](./releases.en.md)                     | Release process, signing, auto-updates                  |

---

**Updating these docs:** When adding new patterns or systems, update the relevant
doc file and add a link here if creating a new document. Keep the set small and
high-signal; prefer hardcoding evolved patterns directly into code comments over
sprawling dedicated guides.
