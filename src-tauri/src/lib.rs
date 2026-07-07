//! Tauri application library entry point.
//!
//! This module serves as the main entry point for the Tauri application.
//! Command implementations are organized in the `commands` module,
//! and shared types are in the `types` module.

mod bindings;

// Modules are exposed for integration tests in tests/ directory.
// #[doc(hidden)] keeps them out of rustdoc.
#[doc(hidden)]
pub mod commands;
#[doc(hidden)]
pub mod error;
#[doc(hidden)]
pub mod types;
#[doc(hidden)]
pub mod utils;

use tauri::{Manager, RunEvent, WindowEvent};

// Re-export only what's needed externally
pub use types::DEFAULT_QUICK_PANE_SHORTCUT;

/// Application entry point. Sets up all plugins and initializes the app.
///
/// Sentry is initialized first, before any other code, so that panics during
/// plugin setup or app construction are captured. The `_sentry_guard` must
/// live for the entire application lifetime — when dropped, it flushes
/// pending events to Sentry within `shutdown_timeout` (default 2s).
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Initialize Sentry before anything else.
    //
    // The DSN is read at compile time via `option_env!("SENTRY_DSN")` — this
    // macro reads the `SENTRY_DSN` env var that `build.rs` sets through
    // `cargo:rustc-env`. Using `option_env!` (rather than relying on sentry's
    // runtime `env::var`) is necessary because `cargo:rustc-env` only affects
    // compilation, not the runtime process environment.
    //
    // If DSN is not set, `dsn: None` → sentry::init returns a no-op guard.
    //
    // `before_send` acts as a consent gate: events are dropped unless the user
    // has explicitly granted consent (`CONSENT_STATE == 1`). The consent state
    // is initialized from `preferences.json` in `setup()` and updated via the
    // `set_consent` Tauri command when the user toggles consent in the UI.
    let _sentry_guard = sentry::init(sentry::ClientOptions {
        dsn: option_env!("SENTRY_DSN")
            .filter(|s| !s.is_empty())
            .and_then(|s| s.parse().ok()),
        release: sentry::release_name!(),
        environment: Some(if cfg!(debug_assertions) {
            "development".into()
        } else {
            "production".into()
        }),
        // Full error sampling — self-hosted Sentry has no quota limits
        sample_rate: 1.0,
        // Disable Rust-side performance tracing — the desktop app has no
        // HTTP request chains to trace. Tracing is kept on the frontend
        // (React SDK) for Web Vitals (LCP/FCP/INP/CLS).
        traces_sample_rate: 0.0,
        // Attach stack traces to all captured events
        attach_stacktrace: true,
        // Release Health: track crash-free session rate
        auto_session_tracking: true,
        // Consent gate: drop events unless the user has granted consent.
        // CONSENT_STATE: 0=unknown, 1=granted, 2=denied.
        before_send: Some(std::sync::Arc::new(|event| {
            if commands::crash_report::CONSENT_STATE.load(std::sync::atomic::Ordering::Relaxed) == 1
            {
                Some(event)
            } else {
                None
            }
        })),
        // Increase shutdown timeout to ensure events are flushed on exit
        shutdown_timeout: std::time::Duration::from_secs(5),
        ..Default::default()
    });

    let builder = bindings::generate_bindings();

    // Export TypeScript bindings in debug builds.
    // NOTE: tauri-specta rc.25 can stack-overflow on Windows debug builds when
    // generating types. If this crashes, run `cargo test export_bindings --release -- --ignored`
    // to regenerate bindings manually, or run `npm run gen:bindings` if available.
    #[cfg(all(debug_assertions, not(target_os = "windows")))]
    bindings::export_ts_bindings();

    // Build with common plugins
    let mut app_builder = tauri::Builder::default();

    // Single instance plugin must be registered FIRST
    // When user tries to open a second instance, focus the existing window instead
    #[cfg(desktop)]
    {
        app_builder = app_builder.plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.set_focus();
                let _ = window.unminimize();
            }
        }));
    }

    // Window state plugin - saves/restores window position and size
    // Note: quick-pane is denylisted because it's an NSPanel and calling is_maximized() on it crashes
    // See: https://github.com/tauri-apps/plugins-workspace/issues/1546
    #[cfg(desktop)]
    {
        app_builder = app_builder.plugin(
            tauri_plugin_window_state::Builder::new()
                .with_state_flags(tauri_plugin_window_state::StateFlags::all())
                .with_denylist(&["quick-pane"])
                .build(),
        );
    }

    // Positioner plugin — enables tray-relative window positioning
    #[cfg(desktop)]
    {
        app_builder = app_builder.plugin(tauri_plugin_positioner::init());
    }

    // Autostart plugin — lets users enable "launch on boot" from preferences
    // Default off; users opt in via the General preferences pane.
    #[cfg(desktop)]
    {
        app_builder = app_builder.plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            None,
        ));
    }

    // Deep link plugin — allows opening the app via tauri-app:// URLs.
    // The on_open_url handler (registered in setup) shows/focuses the main
    // window; the frontend listens via @tauri-apps/plugin-deep-link for navigation.
    #[cfg(desktop)]
    {
        app_builder = app_builder.plugin(tauri_plugin_deep_link::init());
    }

    // Updater plugin for in-app updates
    #[cfg(desktop)]
    {
        app_builder = app_builder.plugin(tauri_plugin_updater::Builder::new().build());
    }

    // HTTP plugin — Rust-side HTTP client that bypasses browser CORS.
    // Used by API configuration forms and external service integration.
    app_builder = app_builder.plugin(tauri_plugin_http::init());

    // Shell plugin — spawn child processes and open files/URLs via system
    // default applications. Complements the opener plugin with command execution.
    #[cfg(desktop)]
    {
        app_builder = app_builder.plugin(tauri_plugin_shell::init());
    }

    // Store plugin — persistent key-value storage with atomic writes.
    // Used for application preferences and lightweight state persistence.
    app_builder = app_builder.plugin(tauri_plugin_store::Builder::new().build());

    app_builder = app_builder
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_notification::init())
        .plugin({
            #[allow(unused_mut)]
            let mut targets = vec![
                // Always log to stdout for development
                tauri_plugin_log::Target::new(tauri_plugin_log::TargetKind::Stdout),
                // Log to system logs on macOS (appears in Console.app)
                #[cfg(target_os = "macos")]
                tauri_plugin_log::Target::new(tauri_plugin_log::TargetKind::LogDir {
                    file_name: None,
                }),
            ];
            // Log to webview console — excluded on Linux where the WebKitGTK webview
            // doesn't exist during setup(), causing app.emit() to deadlock on the IPC socket.
            #[cfg(not(target_os = "linux"))]
            targets.push(tauri_plugin_log::Target::new(
                tauri_plugin_log::TargetKind::Webview,
            ));
            tauri_plugin_log::Builder::new()
                // Use Debug level in development, Info in production
                .level(if cfg!(debug_assertions) {
                    log::LevelFilter::Debug
                } else {
                    log::LevelFilter::Info
                })
                .targets(targets)
                .build()
        });

    // macOS: Add NSPanel plugin for native panel behavior
    #[cfg(target_os = "macos")]
    {
        app_builder = app_builder.plugin(tauri_nspanel::init());
    }

    app_builder
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_persisted_scope::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_os::init())
        .setup(|app| {
            log::info!("Application starting up");
            log::debug!(
                "App handle initialized for package: {}",
                app.package_info().name
            );

            // Initialize consent state from saved preferences before setting
            // up the panic hook. This ensures panics after setup() respect the
            // user's previously saved consent (privacy-safe default: 0=unknown).
            commands::crash_report::init_consent_from_preferences(app.handle());

            // Set up panic hook early to capture any panics during initialization
            commands::crash_report::setup_panic_hook(app.handle());

            // Configure Sentry scope with application context tags.
            // These appear on every Sentry event and help identify the
            // environment (OS, arch, app version) without sending PII.
            sentry::configure_scope(|scope| {
                let pkg = app.package_info();
                scope.set_tag("app.name", &pkg.name);
                scope.set_tag("app.version", pkg.version.to_string());
                scope.set_tag("os.family", std::env::consts::OS);
                scope.set_tag("os.arch", std::env::consts::ARCH);
                scope.set_context("device", {
                    let mut map = std::collections::BTreeMap::new();
                    map.insert("arch".to_string(), std::env::consts::ARCH.into());
                    map.insert("os_name".to_string(), std::env::consts::OS.into());
                    sentry::protocol::Context::Other(map)
                });
                scope.set_context("app", {
                    let mut map = std::collections::BTreeMap::new();
                    map.insert("app_name".to_string(), pkg.name.clone().into());
                    map.insert("app_version".to_string(), pkg.version.to_string().into());
                    sentry::protocol::Context::Other(map)
                });
            });

            // Set up global shortcut plugin (without any shortcuts - we register them separately)
            #[cfg(desktop)]
            {
                use tauri_plugin_global_shortcut::Builder;

                app.handle().plugin(Builder::new().build())?;
            }

            // Load saved preferences and register the quick pane shortcut
            #[cfg(desktop)]
            {
                let saved_shortcut = commands::preferences::load_quick_pane_shortcut(app.handle());
                let shortcut_to_register = saved_shortcut
                    .as_deref()
                    .unwrap_or(DEFAULT_QUICK_PANE_SHORTCUT);

                log::info!("Registering quick pane shortcut: {shortcut_to_register}");
                commands::quick_pane::register_quick_pane_shortcut(
                    app.handle(),
                    shortcut_to_register,
                )?;
            }

            // Create the quick pane window (hidden) - must be done on main thread
            if let Err(e) = commands::quick_pane::init_quick_pane(app.handle()) {
                log::error!("Failed to create quick pane: {e}");
                // Non-fatal: app can still run without quick pane
            }

            // Initialize the system tray (desktop only)
            #[cfg(desktop)]
            {
                if let Err(e) = commands::tray::init_tray(app.handle()) {
                    log::error!("Failed to initialize system tray: {e}");
                    // Non-fatal: app can still run without tray
                }
            }

            // Initialize deep link handling (desktop only)
            #[cfg(desktop)]
            {
                use tauri_plugin_deep_link::DeepLinkExt;

                // Register all configured schemes at runtime so deep links work
                // in dev mode on Windows and Linux (macOS requires installed bundle).
                #[cfg(any(windows, target_os = "linux"))]
                {
                    if let Err(e) = app.deep_link().register_all() {
                        log::warn!("Failed to register deep link schemes: {e}");
                    }
                }

                // Handle deep link events: show/focus the main window.
                // The frontend listens via @tauri-apps/plugin-deep-link for navigation.
                let handle = app.handle().clone();
                app.deep_link().on_open_url(move |event| {
                    for url in event.urls() {
                        log::info!("Deep link received: {}", url);
                    }
                    if let Some(window) = handle.get_webview_window("main") {
                        let _ = window.unminimize();
                        let _ = window.show();
                        let _ = window.set_focus();
                    }
                });
            }

            // NOTE: Application menu is built from JavaScript for i18n support
            // See src/lib/menu.ts for the menu implementation

            Ok(())
        })
        .invoke_handler(builder.invoke_handler())
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app_handle, event| match &event {
            // Desktop: Hide the main window instead of quitting so the tray icon
            // can reopen it and the quick-pane shortcut works independently.
            // On macOS this also enables the dock icon to reopen the window.
            // On Windows/Linux the tray icon's left-click toggles visibility.
            RunEvent::WindowEvent {
                label,
                event: WindowEvent::CloseRequested { api, .. },
                ..
            } if label == "main" => {
                #[cfg(desktop)]
                {
                    api.prevent_close();

                    // Save window state before hiding
                    use tauri_plugin_window_state::{AppHandleExt, StateFlags};
                    if let Err(e) = app_handle.save_window_state(StateFlags::all()) {
                        log::warn!("Failed to save window state: {e}");
                    }

                    // Hide the window so the app keeps running in the tray
                    if let Some(window) = app_handle.get_webview_window("main") {
                        let _ = window.hide();
                        log::info!("Main window hidden (running in tray)");
                    }
                }
            }

            // macOS: Dock icon clicked — reopen the main window if it was hidden
            #[cfg(target_os = "macos")]
            RunEvent::Reopen { .. } => {
                if let Some(window) = app_handle.get_webview_window("main") {
                    if !window.is_visible().unwrap_or(true) {
                        let _ = window.show();

                        // The window-state plugin only auto-restores on app startup, not after
                        // a hide/show cycle. Without this the window can appear at stale coords.
                        use tauri_plugin_window_state::{StateFlags, WindowExt};
                        let _ = window.restore_state(StateFlags::all());

                        let _ = window.set_focus();
                        log::info!("Main window reopened from dock");
                    }
                }
            }

            // Cleanup on actual exit (Cmd+Q, menu Quit, or window close on non-macOS).
            // RunEvent::Exit fires reliably before the process exits, unlike ExitRequested
            // which doesn't fire for Cmd+Q on macOS (tauri-apps/tauri#9198).
            RunEvent::Exit => {
                log::info!("Application exiting — performing cleanup");

                // Hide the quick-pane panel to prevent crashes during teardown
                #[cfg(target_os = "macos")]
                {
                    use tauri_nspanel::ManagerExt;
                    if let Ok(panel) = app_handle.get_webview_panel("quick-pane") {
                        panel.hide();
                    }
                }

                // Unregister global shortcuts
                #[cfg(desktop)]
                {
                    use tauri_plugin_global_shortcut::GlobalShortcutExt;
                    if let Err(e) = app_handle.global_shortcut().unregister_all() {
                        log::warn!("Failed to unregister global shortcuts: {e}");
                    }
                }

                log::info!("Cleanup complete");
            }

            _ => {}
        });
}
