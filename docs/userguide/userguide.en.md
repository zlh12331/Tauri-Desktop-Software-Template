# App User Guide

**[English](userguide.en.md)** | [中文](userguide.zh.md)

## Getting Started

Welcome! This guide covers the core features available in the app.

## Keyboard Shortcuts

### Global Shortcuts

| Shortcut        | Mac          | Windows/Linux | Action                |
| --------------- | ------------ | ------------- | --------------------- |
| Command Palette | Cmd+K        | Ctrl+K        | Open command palette  |
| Preferences     | Cmd+,        | Ctrl+,        | Open preferences      |
| Quick Pane      | Configurable | Configurable  | Open quick entry pane |
| Left Sidebar    | Cmd+1        | Ctrl+1        | Toggle left sidebar   |
| Right Sidebar   | Cmd+2        | Ctrl+2        | Toggle right sidebar  |

## Core Features

### Command Palette

Press **Cmd+K** to open the command palette - a quick way to find and run any action. Start typing to search through available commands.

### Quick Pane

The Quick Pane is a small floating window that can be summoned with a global keyboard shortcut, even when the app is in the background. Use it for quick data entry or actions without switching to the main window.

Configure the Quick Pane shortcut in **Preferences → Keyboard Shortcuts**.

### Preferences

Press **Cmd+,** to open preferences:

- **Theme**: Light, Dark, or System
- **Language**: Select your preferred language
- **Keyboard Shortcuts**: Customize the Quick Pane shortcut

### Native Menus

Access features from the menu bar:

- **App Menu**: About, Check for Updates, Preferences, Quit
- **View Menu**: Toggle sidebars

All menu items have keyboard shortcuts and are also available in the command palette.

## Layout

- **Title Bar**: Window controls and app title
- **Left Sidebar**: Collapsible panel (Cmd+1)
- **Main Content**: Primary app content
- **Right Sidebar**: Collapsible panel (Cmd+2)

## Updates

The app checks for updates shortly after launch, and you can ask it to check:

- Manual check: App menu → Check for Updates, or Cmd+K → "Check for Updates"
- Updates download from GitHub releases and are verified against a signed manifest
- An available update appears as a persistent toast with its version and release
  notes. Nothing is downloaded until you press **Install update**, and the app does
  not restart itself — it offers **Restart now** once the install finishes.
- **Later** just dismisses the toast; you'll be asked again next launch.

---

_This user guide should be expanded as new features are added to the app._
