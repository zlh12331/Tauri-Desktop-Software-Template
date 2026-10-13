# App User Guide

**[English](userguide.en.md)** | [中文](userguide.zh.md)

This template ships as a working desktop app, so the guide describes real
behavior rather than a hypothetical product. Where a feature is a placeholder
meant to be replaced, it says so — see [What is a stub](#what-is-a-stub).

## Getting Started

- The app opens one main window (1200×800, minimum 1000×700) centered on screen.
- Its size and position are restored on next launch.
- Starting a second instance does not open a second window; the existing window is
  shown and focused instead.
- The app registers the `tauri-app://` link scheme, so `tauri-app://preferences`
  and `tauri-app://command-palette` open those two surfaces from outside the app.

## Keyboard Shortcuts

These are the bindings that actually exist in code:

| Action                                       | macOS         | Windows / Linux        | Where bound                                           |
| -------------------------------------------- | ------------- | ---------------------- | ----------------------------------------------------- |
| Command palette                              | ⌘K            | Ctrl+K                 | In-app keydown listener                               |
| Preferences                                  | ⌘,            | Ctrl+,                 | Listener + native menu                                |
| Toggle left sidebar                          | ⌘1            | Ctrl+1                 | Listener + View menu                                  |
| Toggle right sidebar                         | ⌘2            | Ctrl+2                 | Listener + View menu                                  |
| Toggle sidebars (while preferences are open) | ⌘B            | Ctrl+B                 | Built into the settings layout                        |
| Quick Pane                                   | ⌘⇧. (default) | Ctrl+Shift+. (default) | **OS-level**, works when the app is in the background |
| Quick Pane: dismiss                          | Esc           | Esc                    | Inside the panel                                      |

Two caveats worth knowing before you trust the UI:

- The command palette shows labels such as `⌘W`, `⌘M` and `F11` next to window
  commands. Those are display strings only — no key handler binds them. The
  commands still run from the palette itself.
- The in-app listener fires on `⌘`/`Ctrl` plus a key and does not exclude
  `Shift`, so `⌘⇧K` also opens the command palette.

## Closing the Window Is Not Quitting

Pressing the window close button hides the app to the system tray. It keeps
running, and the Quick Pane shortcut still works.

- Left-click the tray icon to toggle the window; double-click to force it visible.
- Right-click gives the tray menu: **Show/Hide**, separator, **Quit**.
- Quitting for real: tray **Quit**, the app menu **Quit**, or ⌘Q on macOS. On
  quit the app unregisters global shortcuts and hides the Quick Pane.
- On macOS, clicking the Dock icon brings the hidden window back.
- There is no preference for this behavior. The tray menu labels and tooltip are
  also English-only today; the Rust side has no i18n wiring yet.

## Quick Pane

A 500×72 input bar that appears centered on the display your cursor is on, summoned
with the global shortcut even while the app sits in the background.

- Type and press Enter to submit. The main window records it and shows
  `Last entry: <text>` in the content area.
- Submitting empty or whitespace-only text sends nothing but still closes the pane.
- Escape or clicking away closes it. Escape is silenced so macOS does not play its
  "boop" sound.
- On macOS it is a real floating panel: it stays above full-screen apps, does not
  activate the app when clicked, and appears on all Spaces. Elsewhere it is an
  always-on-top window with no title bar.
- The shortcut is configurable in **Preferences → General** (see below). It must
  contain at least one modifier; pressing the reset link restores the default.

## Command Palette

⌘K / Ctrl+K. It lists the app's registered commands — 15 in this template, grouped
as navigation, window, notification and app actions: sidebar toggles, open
preferences, close/minimize/maximize/fullscreen, a test toast, and check for
updates.

Search is a plain case-insensitive substring match against the translated label and
description, not fuzzy matching. Commands that do not apply right now (for example
"hide sidebar" when it is already hidden) are not listed. Selecting a command closes
the palette before running it; failures surface as an error toast.

## Preferences

⌘, / Ctrl+, opens a dialog with three panes. The breadcrumb at the top names the
pane you are in.

- **General**: the Quick Pane shortcut (recording UI: click it, press the combo,
  Esc to cancel), and a Launch at startup switch. The two example fields on this
  pane are labelled "not persisted" and are meant to be replaced.
- **Appearance**: language (System default, English, Chinese) and theme
  (Light, Dark, System). Both apply immediately and are saved.
- **Advanced**: crash-reporting consent (the switch is disabled when no Sentry DSN
  is configured, with a line explaining why), plus the API configuration form.

Only four settings survive an app restart: theme, language, Quick Pane shortcut and
crash-reporting consent.

## Language and Theme

- Languages shipped: English and Chinese. "System default" reads the OS locale; if
  it is not one of the shipped languages the app falls back to English. Changing the
  language also rebuilds the native menus.
- Theme defaults to System and follows the OS while selected; choosing Light or Dark
  stops that tracking. The theme is shared with the Quick Pane, and both windows
  apply it before first paint so there is no white flash.
- Window corners are handled per platform: macOS keeps its own rounding, and
  Windows/Linux square the corners in full screen automatically. This is not a
  setting.
- Right-to-left support is wired up (direction is derived from the language list)
  but no RTL language is shipped, so it is dormant.

## Crash Reporting and Recovery

- A Rust panic is written to a crash file with its message, location and backtrace
  before the app exits.
- On the next launch, if you have never answered the consent question, a dialog
  shows the crash message and location with **Send Report** and **Don't Send**.
  Nothing is sent unless you press Send. Your answer is remembered either way; if
  you already consented, the report goes automatically, and if you declined the file
  is deleted in silence. With no Sentry DSN configured the dialog still appears but
  sending is disabled.
- A React rendering crash shows a full-screen page with **Reload Application** and
  **Try Again**; the dev build also exposes the stack behind a collapsible section.
- Crash snapshots are saved under the app data directory, capped at 10 MB per file,
  and files older than 7 days are cleaned up at startup.

## Updates

- The app checks for updates about five seconds after launch. That check is silent:
  no "you are up to date" nag, and a failed check offline is only logged.
- To ask explicitly: app menu → Check for Updates, or ⌘K → "Check for Updates".
  Only this interactive path reports an "up to date" message or an error.
- An available update appears as a persistent toast showing the version and release
  notes. Nothing downloads until you press **Install update**, and the app never
  restarts itself — it offers **Restart now** when the install finishes.
- **Later** dismisses the toast. It does not unsubscribe you: the next launch asks
  again.
- On Windows the installer replaces the running app during installation, so
  "Restart now" is effectively the macOS and Linux path.
- Updates come from GitHub releases and are verified against a signed manifest.

## What Is a Stub

So that nothing reads as a finished feature:

- **Preferences → General** example text/toggle, and **Advanced** example
  toggle/dropdown: sample controls that are not persisted.
- **Advanced → API configuration**: the form validates endpoint, API key, timeout
  and retry count, then simulates saving with a success toast. It is not wired to
  any request layer, and the API key is never sent anywhere by this template.
- **Main content**: shows "Hello World" until something records a Quick Pane entry.
- The `greet` command exists for the preferences example but no UI calls it.
- Tray "notification" icon state exists in code but there is no second badge icon
  yet, so the tray icon never changes.

---

_Removing any of these is a supported path: the_
_[trimming guide](../developer/trimming-guide.en.md)_
_lists the files, commands and strings each feature touches._
