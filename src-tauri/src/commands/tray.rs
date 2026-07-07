//! System tray implementation.
//!
//! Provides a tray icon with context menu, window toggle on click,
//! and dynamic icon state switching (normal / notification badge).
//!
//! Cross-platform icon handling:
//! - macOS: uses template image (monochrome, auto-adapts to menu bar theme)
//! - Windows/Linux: uses the full-color app icon

use std::sync::Mutex;

use tauri::{
    AppHandle, Manager, Runtime, WebviewWindow,
    menu::{Menu, MenuEvent, MenuItem, PredefinedMenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent, TrayIconId},
};
use tauri_plugin_positioner::{Position, on_tray_event};

use crate::error::AppError;

/// Tray icon states — controls which icon is displayed.
#[derive(Debug, Clone, Copy, PartialEq, Eq, serde::Serialize, serde::Deserialize, specta::Type)]
pub enum TrayIconState {
    /// Default app icon
    Normal,
    /// Icon with a notification badge (e.g. unread items)
    Notification,
}

/// Tray window position — controls where the window appears relative to the tray icon.
#[derive(Debug, Clone, Copy, PartialEq, Eq, serde::Serialize, serde::Deserialize, specta::Type)]
pub enum TrayPosition {
    /// Top-left of tray icon
    TopLeft,
    /// Top-right of tray icon
    TopRight,
    /// Bottom-left of tray icon
    BottomLeft,
    /// Bottom-right of tray icon
    BottomRight,
}

/// Global tray icon state — shared between command handlers and event handlers.
static TRAY_STATE: Mutex<TrayIconState> = Mutex::new(TrayIconState::Normal);

/// Tray menu item IDs — must be unique within the app.
const MENU_ID_SHOW: &str = "tray_show";
const MENU_ID_QUIT: &str = "tray_quit";

/// Builds and registers the system tray icon.
///
/// Call this once during app setup. The tray provides:
/// - Left click (single): toggle main window visibility
/// - Left click (double): show & focus main window
/// - Right click: context menu (Show/Hide, separator, Quit)
/// - Positioner integration: tray-relative window positioning works
pub fn init_tray<R: Runtime>(app: &AppHandle<R>) -> tauri::Result<()> {
    // NOTE: Tray menu items are in English. Rust-side i18n is not yet implemented;
    // these strings should be localized when a Rust i18n system is added.
    let show_item = MenuItem::with_id(app, MENU_ID_SHOW, "Show/Hide", true, None::<&str>)?;
    let separator = PredefinedMenuItem::separator(app)?;
    let quit_item = MenuItem::with_id(app, MENU_ID_QUIT, "Quit", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&show_item, &separator, &quit_item])?;

    // Use the app's default window icon as the tray icon.
    // On macOS, mark as template image so it auto-adapts to light/dark menu bar.
    let icon = app
        .default_window_icon()
        .cloned()
        .expect("app must have a default window icon");

    TrayIconBuilder::with_id(TrayIconId::new("main-tray"))
        .icon(icon)
        .tooltip("Tauri App")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .icon_as_template(cfg!(target_os = "macos"))
        .on_menu_event(handle_menu_event)
        .on_tray_icon_event(handle_tray_event)
        .build(app)?;

    log::info!("System tray initialized");
    Ok(())
}

/// Handle tray context menu clicks.
fn handle_menu_event<R: Runtime>(app: &AppHandle<R>, event: MenuEvent) {
    match event.id().as_ref() {
        MENU_ID_SHOW => {
            toggle_main_window(app);
        }
        MENU_ID_QUIT => {
            log::info!("Quit requested from tray menu");
            app.exit(0);
        }
        _ => {
            log::debug!("Unhandled tray menu item: {:?}", event.id());
        }
    }
}

/// Handle mouse events on the tray icon itself.
fn handle_tray_event<R: Runtime>(tray: &tauri::tray::TrayIcon<R>, event: TrayIconEvent) {
    // Required for positioner to compute tray-relative positions
    on_tray_event(tray.app_handle(), &event);

    match event {
        // Single left click: toggle window visibility
        TrayIconEvent::Click {
            button: MouseButton::Left,
            button_state: MouseButtonState::Up,
            ..
        } => {
            toggle_main_window(tray.app_handle());
        }
        // Double left click: ensure window is shown and focused
        TrayIconEvent::DoubleClick {
            button: MouseButton::Left,
            ..
        } => {
            show_and_focus_main_window(tray.app_handle());
        }
        _ => {}
    }
}

/// Toggle the main window between visible and hidden.
fn toggle_main_window<R: Runtime>(app: &AppHandle<R>) {
    if let Some(window) = app.get_webview_window("main") {
        if is_window_visible(&window) {
            let _ = window.hide();
            log::debug!("Main window hidden via tray");
        } else {
            show_and_focus_main_window(app);
        }
    }
}

/// Show (if hidden) and focus the main window.
fn show_and_focus_main_window<R: Runtime>(app: &AppHandle<R>) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.unminimize();
        let _ = window.show();
        let _ = window.set_focus();
        log::debug!("Main window shown via tray");
    }
}

/// Check if the window is currently visible (not hidden, not minimized).
fn is_window_visible<R: Runtime>(window: &WebviewWindow<R>) -> bool {
    window.is_visible().unwrap_or(false) && !window.is_minimized().unwrap_or(false)
}

/// Update the tray icon state (Normal / Notification badge).
///
/// Exposed as a Tauri command so the frontend can trigger a badge
/// (e.g. when a notification arrives or unread count changes).
#[tauri::command]
#[specta::specta]
pub fn set_tray_icon_state(state: TrayIconState) -> Result<(), AppError> {
    let mut current = TRAY_STATE
        .lock()
        .map_err(|e| AppError::tray(format!("Tray state lock poisoned: {e}")))?;

    if *current != state {
        *current = state;
        log::debug!("Tray icon state changed to: {:?}", state);
        // Note: actual icon swap requires accessing the TrayIcon handle.
        // For template (macOS) we rely on the OS; for Windows/Linux a second
        // icon asset would be swapped here. Left as a hook for when a badge
        // icon asset is provided.
    }
    Ok(())
}

/// Move a window to a tray-relative position (e.g. for popover-style panels).
///
/// Exposed as a Tauri command so the frontend can position the quick pane
/// or a popover relative to the tray icon.
#[tauri::command]
#[specta::specta]
pub fn move_window_to_tray(
    app: tauri::AppHandle,
    window_label: String,
    position: TrayPosition,
) -> Result<(), AppError> {
    use tauri_plugin_positioner::WindowExt;

    let pos = match position {
        TrayPosition::TopLeft => Position::TopLeft,
        TrayPosition::TopRight => Position::TopRight,
        TrayPosition::BottomLeft => Position::BottomLeft,
        TrayPosition::BottomRight => Position::BottomRight,
    };

    let window = app
        .get_webview_window(&window_label)
        .ok_or_else(|| AppError::not_found(format!("Window not found: {window_label}")))?;

    window
        .move_window(pos)
        .map_err(|e| AppError::window(format!("Failed to move window: {e}")))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn tray_state_default_is_normal() {
        // The static should be Normal at start (test runs in same process)
        let state = TRAY_STATE.lock().unwrap();
        assert_eq!(*state, TrayIconState::Normal);
    }

    #[test]
    fn tray_state_enum_equality() {
        assert_eq!(TrayIconState::Normal, TrayIconState::Normal);
        assert_ne!(TrayIconState::Normal, TrayIconState::Notification);
    }
}
