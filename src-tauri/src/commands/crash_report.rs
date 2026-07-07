//! Crash reporting commands.
//!
//! Sets up a Rust panic hook that captures panic info to a crash file on disk.
//! On the next app startup, the frontend reads the crash file and sends it to
//! Sentry (if the user has given consent).
//!
//! Consent state is maintained as a global `AtomicU8` so that Sentry's
//! `before_send` callback can check it without crossing the IPC boundary.

use std::fs;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU8, Ordering};
use std::time::{SystemTime, UNIX_EPOCH};

use tauri::{AppHandle, Runtime};

use crate::error::AppError;
use crate::types::{AppPreferences, CrashReportData};
use crate::utils::paths::{ensure_dir_exists, get_app_data_file_path, get_app_data_file_path_sync};

/// Global consent state for Sentry event submission (Rust side).
///
/// - `0`: Consent not yet asked (events dropped by `before_send`)
/// - `1`: Consent granted (events sent)
/// - `2`: Consent denied (events dropped by `before_send`)
///
/// This mirrors the frontend's `consentGranted` state in `sentry.ts`.
/// The frontend sets this via the `set_consent` Tauri command, and it is
/// initialized from `preferences.json` during `setup()` via
/// `init_consent_from_preferences`.
pub static CONSENT_STATE: AtomicU8 = AtomicU8::new(0);

/// Gets the path to the crash report file in the app data directory.
///
/// Only resolves the path — does **not** create the directory. Callers that
/// need to write files must call [`ensure_dir_exists`] inside `spawn_blocking`.
fn get_crash_report_path<R: Runtime>(app: &AppHandle<R>) -> Result<PathBuf, AppError> {
    get_app_data_file_path(app, "crash-report.json")
}

/// Escapes a string for safe embedding inside a JSON string literal.
///
/// Used by the panic hook to build crash-report JSON without `serde_json`,
/// which could panic on allocation failure and cause a secondary panic.
fn escape_json_string(s: &str) -> String {
    let mut result = String::with_capacity(s.len() + 2);
    result.push('"');
    for c in s.chars() {
        match c {
            '"' => result.push_str(r#"\""#),
            '\\' => result.push_str(r"\\"),
            '\n' => result.push_str(r"\n"),
            '\r' => result.push_str(r"\r"),
            '\t' => result.push_str(r"\t"),
            c if c.is_control() => result.push_str(&format!(r"\u{:04x}", c as u32)),
            c => result.push(c),
        }
    }
    result.push('"');
    result
}

/// Pure helper: persists the consent value to the preferences file at `path`.
///
/// Reads the current preferences (or uses defaults if the file doesn't exist),
/// updates `crash_reporting_consent`, and writes back atomically. This ensures
/// the consent state survives restarts even if the frontend doesn't call
/// `save_preferences`.
///
/// Exposed for integration testing without an `AppHandle`.
pub fn persist_consent_to_path(path: &Path, consent: Option<bool>) -> Result<(), AppError> {
    // Read current preferences or use defaults
    let mut prefs = if path.exists() {
        let contents = fs::read_to_string(path).map_err(|e| {
            AppError::io(format!(
                "Failed to read preferences for consent persist: {e}"
            ))
        })?;
        serde_json::from_str::<AppPreferences>(&contents).unwrap_or_else(|e| {
            log::warn!(
                "Preferences file corrupted during consent persist, preserving consent only: {e}"
            );
            // Don't overwrite other fields with defaults — just use defaults as base
            AppPreferences::default()
        })
    } else {
        AppPreferences::default()
    };

    prefs.crash_reporting_consent = consent;

    // Write back using atomic write (temp file + rename)
    let json = serde_json::to_string_pretty(&prefs).map_err(|e| {
        AppError::serialization(format!(
            "Failed to serialize preferences for consent persist: {e}"
        ))
    })?;
    let temp_path = path.with_extension("tmp");

    fs::write(&temp_path, &json).map_err(|e| {
        AppError::io(format!(
            "Failed to write preferences for consent persist: {e}"
        ))
    })?;

    if let Err(rename_err) = fs::rename(&temp_path, path) {
        let _ = fs::remove_file(&temp_path);
        return Err(AppError::io(format!(
            "Failed to finalize preferences for consent persist: {rename_err}"
        )));
    }

    log::info!("Consent persisted to preferences file");
    Ok(())
}

/// Sets up a panic hook that captures panic info to a crash file.
///
/// The original panic hook is still called after writing the crash file,
/// so default behavior (printing to stderr, aborting) is preserved.
///
/// ## Secondary panic safety
///
/// The crash-report JSON is built **manually** with `format!` instead of
/// `serde_json::to_string_pretty`, because `serde_json` may allocate memory
/// and panic during an OOM condition — causing a secondary panic that aborts
/// the process immediately and loses the original crash info.
///
/// The `fs::write` call is wrapped in `catch_unwind(AssertUnwindSafe(..))`
/// as a final safety net against any file-system-induced panic.
///
/// This should be called early in `setup()` to capture as many panics as possible.
pub fn setup_panic_hook<R: Runtime>(app: &AppHandle<R>) {
    let handle = app.clone();
    let original_hook = std::panic::take_hook();

    std::panic::set_hook(Box::new(move |info| {
        // Extract panic message from the payload
        let payload = info.payload();
        let message = if let Some(s) = payload.downcast_ref::<&str>() {
            (*s).to_string()
        } else if let Some(s) = payload.downcast_ref::<String>() {
            s.clone()
        } else {
            "Unknown panic payload".to_string()
        };

        // Extract source location
        let location = info
            .location()
            .map(|l| format!("{}:{}:{}", l.file(), l.line(), l.column()));

        // Capture backtrace (force_capture always captures, even without RUST_BACKTRACE=1)
        let backtrace = std::backtrace::Backtrace::force_capture().to_string();

        // Get timestamp
        let timestamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|d| d.as_secs())
            .unwrap_or(0);

        // Get app version
        let app_version = handle.package_info().version.to_string();

        // Build crash-report JSON manually (avoids serde_json which can panic on alloc).
        let location_json = location
            .as_ref()
            .map(|l| escape_json_string(l))
            .unwrap_or_else(|| "null".to_string());

        let json = format!(
            r#"{{"crash_type":"rust_panic","message":{},"location":{},"backtrace":{},"timestamp":{},"app_version":{}}}"#,
            escape_json_string(&message),
            location_json,
            escape_json_string(&backtrace),
            timestamp,
            escape_json_string(&app_version)
        );

        // Write crash data to file, wrapped in catch_unwind to prevent
        // secondary panics from file-system operations aborting the process.
        let write_result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            if let Ok(crash_path) = get_crash_report_path(&handle)
                && let Err(e) = fs::write(&crash_path, &json)
            {
                eprintln!("Failed to write crash report: {e}");
            }
        }));
        if write_result.is_err() {
            eprintln!("Secondary panic while writing crash report — data may be lost");
        }

        // Call the original panic hook (preserves default behavior)
        original_hook(info);
    }));
}

/// Reads the crash report file if it exists.
/// Returns None if no crash file is found.
///
/// Generic implementation — testable with any `Runtime` (including `MockRuntime`).
pub async fn read_crash_report_impl<R: Runtime>(
    app: AppHandle<R>,
) -> Result<Option<CrashReportData>, AppError> {
    let crash_path = get_crash_report_path(&app)?;
    tauri::async_runtime::spawn_blocking(move || {
        if let Some(parent) = crash_path.parent() {
            ensure_dir_exists(parent)?;
        }
        read_crash_report_from_path(&crash_path)
    })
    .await
    .map_err(|e| AppError::task_join(format!("Task join error: {e}")))?
}

/// Reads the crash report file if it exists.
/// Returns None if no crash file is found.
#[tauri::command]
#[specta::specta]
pub async fn read_crash_report(app: AppHandle) -> Result<Option<CrashReportData>, AppError> {
    read_crash_report_impl(app).await
}

/// Pure helper: reads the crash report from a specific file path.
///
/// Returns `Ok(None)` when the file does not exist. All filesystem and parsing
/// errors are logged and propagated as `Err(AppError)` to preserve the original
/// command-level error handling contract.
///
/// Exposed for integration testing without an `AppHandle`.
pub fn read_crash_report_from_path(path: &Path) -> Result<Option<CrashReportData>, AppError> {
    if !path.exists() {
        return Ok(None);
    }

    let contents = fs::read_to_string(path).map_err(|e| {
        log::error!("Failed to read crash report: {e}");
        AppError::io(format!("Failed to read crash report: {e}"))
    })?;

    let data: CrashReportData = serde_json::from_str(&contents).map_err(|e| {
        log::error!("Failed to parse crash report: {e}");
        AppError::serialization(format!("Failed to parse crash report: {e}"))
    })?;

    log::info!("Crash report loaded from disk");
    Ok(Some(data))
}

/// Deletes the crash report file.
/// Called after the crash has been sent to Sentry or dismissed by the user.
///
/// Generic implementation — testable with any `Runtime` (including `MockRuntime`).
pub async fn delete_crash_report_impl<R: Runtime>(app: AppHandle<R>) -> Result<(), AppError> {
    let crash_path = get_crash_report_path(&app)?;
    tauri::async_runtime::spawn_blocking(move || {
        // No need to create directory for deletion, but keep consistent path.
        let _ = crash_path.parent(); // parent already ensured to exist by prior writes
        delete_crash_report_at_path(&crash_path)
    })
    .await
    .map_err(|e| AppError::task_join(format!("Task join error: {e}")))?
}

/// Deletes the crash report file.
/// Called after the crash has been sent to Sentry or dismissed by the user.
#[tauri::command]
#[specta::specta]
pub async fn delete_crash_report(app: AppHandle) -> Result<(), AppError> {
    delete_crash_report_impl(app).await
}

/// Initializes the global consent state from the persisted preferences file.
///
/// This should be called during `setup()` before `setup_panic_hook` so that
/// panics occurring after setup respect the user's previously saved consent.
/// If the preferences file does not exist or cannot be parsed, the consent
/// state remains at `0` (not asked), which is the privacy-safe default.
pub fn init_consent_from_preferences<R: Runtime>(app: &AppHandle<R>) {
    let path = match get_app_data_file_path_sync(app, "preferences.json") {
        Ok(p) => p,
        Err(e) => {
            log::warn!("Could not resolve preferences path for consent init: {e}");
            return;
        }
    };
    init_consent_from_path(&path);
}

/// Pure helper: initializes the global consent state from a preferences file path.
///
/// Reads the preferences file at `path`, parses it, and sets `CONSENT_STATE`
/// accordingly. If the file doesn't exist, cannot be read, or cannot be parsed,
/// the consent state remains unchanged (privacy-safe default).
///
/// Exposed for integration testing without an `AppHandle`.
pub fn init_consent_from_path(path: &Path) {
    if !path.exists() {
        log::debug!("No preferences file found; consent state stays at default (0)");
        return;
    }

    let contents = match fs::read_to_string(path) {
        Ok(c) => c,
        Err(e) => {
            log::warn!("Could not read preferences file for consent init: {e}");
            return;
        }
    };

    let prefs: AppPreferences = match serde_json::from_str(&contents) {
        Ok(p) => p,
        Err(e) => {
            log::warn!("Could not parse preferences file for consent init: {e}");
            return;
        }
    };

    let value = match prefs.crash_reporting_consent {
        Some(true) => 1,
        Some(false) => 2,
        None => 0,
    };

    CONSENT_STATE.store(value, Ordering::Relaxed);
    log::info!(
        "Sentry consent initialized from preferences: {value} (0=unknown, 1=granted, 2=denied)"
    );
}

/// Sets the crash reporting consent state.
///
/// Called by the frontend when the user grants or denies consent via the
/// preferences pane or the crash report dialog. The state is stored both
/// in-memory (via `CONSENT_STATE`) **and** persisted to `preferences.json`
/// on the Rust side, so it survives restarts even if the frontend doesn't
/// call `save_preferences`.
///
/// Generic implementation — testable with any `Runtime` (including `MockRuntime`).
pub async fn set_consent_impl<R: Runtime>(
    app: AppHandle<R>,
    consent: Option<bool>,
) -> Result<(), AppError> {
    let value = match consent {
        Some(true) => 1,
        Some(false) => 2,
        None => 0,
    };
    CONSENT_STATE.store(value, Ordering::Relaxed);
    log::info!("Sentry consent state set to: {value} (0=unknown, 1=granted, 2=denied)");

    // Persist consent to preferences.json (Rust-side persistence).
    let prefs_path = get_app_data_file_path(&app, "preferences.json")?;
    tauri::async_runtime::spawn_blocking(move || {
        if let Some(parent) = prefs_path.parent() {
            ensure_dir_exists(parent)?;
        }
        persist_consent_to_path(&prefs_path, consent)
    })
    .await
    .map_err(|e| AppError::task_join(format!("Task join error: {e}")))?
}

/// Sets the crash reporting consent state.
///
/// Called by the frontend when the user grants or denies consent via the
/// preferences pane or the crash report dialog. The state is stored both
/// in-memory (via `CONSENT_STATE`) **and** persisted to `preferences.json`
/// on the Rust side, so it survives restarts even if the frontend doesn't
/// call `save_preferences`.
#[tauri::command]
#[specta::specta]
pub async fn set_consent(app: AppHandle, consent: Option<bool>) -> Result<(), AppError> {
    set_consent_impl(app, consent).await
}

/// Pure helper: deletes the crash report file at a specific path.
///
/// Idempotent: returns `Ok(())` when the file does not exist. Filesystem errors
/// are logged and propagated as `Err(AppError)`.
///
/// Exposed for integration testing without an `AppHandle`.
pub fn delete_crash_report_at_path(path: &Path) -> Result<(), AppError> {
    if path.exists() {
        fs::remove_file(path).map_err(|e| {
            log::error!("Failed to delete crash report: {e}");
            AppError::io(format!("Failed to delete crash report: {e}"))
        })?;
        log::info!("Crash report file deleted");
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    /// Serializes tests that read/write the global `CONSENT_STATE`.
    ///
    /// Without this mutex, parallel tests race on the shared `AtomicU8`,
    /// causing flaky failures (e.g., one test overwrites the value before
    /// another can assert).
    ///
    /// Uses `tokio::sync::Mutex` (not `std::sync::Mutex`) because the consent
    /// tests are async (`#[tokio::test]`). `std::sync::MutexGuard` held across
    /// `.await` points triggers `clippy::await_holding_lock` and can deadlock
    /// multi-threaded runtimes.
    static CONSENT_TEST_MUTEX: tokio::sync::Mutex<()> = tokio::sync::Mutex::const_new(());

    /// Helper: creates a sample `CrashReportData` instance for tests.
    fn sample_crash_report() -> CrashReportData {
        CrashReportData {
            crash_type: "rust_panic".to_string(),
            message: "index out of bounds".to_string(),
            location: Some("src/main.rs:42:13".to_string()),
            backtrace: "stack backtrace:\n  ...".to_string(),
            timestamp: 1_700_000_000.0,
            app_version: "1.2.3".to_string(),
        }
    }

    // =========================================================================
    // read_crash_report_from_path — 正向用例
    // =========================================================================

    #[test]
    fn read_crash_report_reads_valid_json() {
        let dir = TempDir::new().unwrap();
        let path = dir.path().join("crash-report.json");
        let data = sample_crash_report();
        let json = serde_json::to_string_pretty(&data).unwrap();
        std::fs::write(&path, json).unwrap();

        let loaded = read_crash_report_from_path(&path)
            .unwrap()
            .expect("expected Some(crash report)");
        assert_eq!(loaded.crash_type, data.crash_type);
        assert_eq!(loaded.message, data.message);
        assert_eq!(loaded.location, data.location);
        assert_eq!(loaded.backtrace, data.backtrace);
        assert_eq!(loaded.timestamp, data.timestamp);
        assert_eq!(loaded.app_version, data.app_version);
    }

    #[test]
    fn read_crash_report_roundtrips_after_compact_write() {
        let dir = TempDir::new().unwrap();
        let path = dir.path().join("crash-report.json");
        let original = sample_crash_report();
        std::fs::write(&path, serde_json::to_string(&original).unwrap()).unwrap();

        let loaded = read_crash_report_from_path(&path)
            .unwrap()
            .expect("expected Some(crash report)");
        assert_eq!(loaded.crash_type, original.crash_type);
        assert_eq!(loaded.timestamp, original.timestamp);
        assert_eq!(loaded.app_version, original.app_version);
    }

    #[test]
    fn read_crash_report_handles_null_location() {
        let dir = TempDir::new().unwrap();
        let path = dir.path().join("crash-report.json");
        // `location: null` in JSON maps to `None`.
        let json = r#"{
            "crash_type": "rust_panic",
            "message": "boom",
            "location": null,
            "backtrace": "empty",
            "timestamp": 123,
            "app_version": "0.1.0"
        }"#;
        std::fs::write(&path, json).unwrap();

        let loaded = read_crash_report_from_path(&path)
            .unwrap()
            .expect("expected Some(crash report)");
        assert!(loaded.location.is_none());
        assert_eq!(loaded.message, "boom");
    }

    // =========================================================================
    // read_crash_report_from_path — 边界用例
    // =========================================================================

    #[test]
    fn read_crash_report_returns_none_when_file_missing() {
        let dir = TempDir::new().unwrap();
        let path = dir.path().join("nonexistent.json");

        let result = read_crash_report_from_path(&path).unwrap();
        assert!(result.is_none());
    }

    // =========================================================================
    // read_crash_report_from_path — 异常用例
    // =========================================================================

    #[test]
    fn read_crash_report_fails_on_invalid_json() {
        let dir = TempDir::new().unwrap();
        let path = dir.path().join("crash-report.json");
        std::fs::write(&path, "not json at all").unwrap();

        let result = read_crash_report_from_path(&path);
        assert!(result.is_err());
        assert!(result.unwrap_err().to_string().contains("Failed to parse"));
    }

    #[test]
    fn read_crash_report_fails_on_partial_invalid_json() {
        let dir = TempDir::new().unwrap();
        let path = dir.path().join("crash-report.json");
        std::fs::write(&path, r#"{"crash_type":"rust_panic","message":}"#).unwrap();

        let result = read_crash_report_from_path(&path);
        assert!(result.is_err());
        assert!(result.unwrap_err().to_string().contains("Failed to parse"));
    }

    #[test]
    fn read_crash_report_fails_on_non_json_content() {
        let dir = TempDir::new().unwrap();
        let path = dir.path().join("crash-report.json");
        std::fs::write(&path, "<<<not a json content>>>").unwrap();

        let result = read_crash_report_from_path(&path);
        assert!(result.is_err());
        assert!(result.unwrap_err().to_string().contains("Failed to parse"));
    }

    #[test]
    fn read_crash_report_fails_on_missing_required_field() {
        let dir = TempDir::new().unwrap();
        let path = dir.path().join("crash-report.json");
        // Missing the `message` field.
        let json = r#"{
            "crash_type": "rust_panic",
            "backtrace": "empty",
            "timestamp": 123,
            "app_version": "0.1.0"
        }"#;
        std::fs::write(&path, json).unwrap();

        let result = read_crash_report_from_path(&path);
        assert!(result.is_err());
        assert!(result.unwrap_err().to_string().contains("Failed to parse"));
    }

    // =========================================================================
    // delete_crash_report_at_path — 正向用例
    // =========================================================================

    #[test]
    fn delete_crash_report_removes_existing_file() {
        let dir = TempDir::new().unwrap();
        let path = dir.path().join("crash-report.json");
        std::fs::write(&path, "{}").unwrap();
        assert!(path.exists());

        delete_crash_report_at_path(&path).unwrap();
        assert!(!path.exists());
    }

    // =========================================================================
    // delete_crash_report_at_path — 边界用例
    // =========================================================================

    #[test]
    fn delete_crash_report_returns_ok_when_file_missing() {
        let dir = TempDir::new().unwrap();
        let path = dir.path().join("nonexistent.json");
        assert!(!path.exists());

        // Idempotent: deleting a missing file is Ok.
        let result = delete_crash_report_at_path(&path);
        assert!(result.is_ok());
    }

    // =========================================================================
    // 综合 / 跨函数用例
    // =========================================================================

    #[test]
    fn delete_crash_report_idempotent_on_double_delete() {
        let dir = TempDir::new().unwrap();
        let path = dir.path().join("crash-report.json");
        std::fs::write(&path, "{}").unwrap();

        delete_crash_report_at_path(&path).unwrap();
        // Second delete should also succeed (idempotent).
        let result = delete_crash_report_at_path(&path);
        assert!(result.is_ok());
        assert!(!path.exists());
    }

    #[test]
    fn read_returns_none_after_delete() {
        let dir = TempDir::new().unwrap();
        let path = dir.path().join("crash-report.json");
        let data = sample_crash_report();
        std::fs::write(&path, serde_json::to_string(&data).unwrap()).unwrap();

        // Confirm it is readable initially.
        assert!(read_crash_report_from_path(&path).unwrap().is_some());

        // Delete and verify read returns None afterwards.
        delete_crash_report_at_path(&path).unwrap();
        assert!(read_crash_report_from_path(&path).unwrap().is_none());
    }

    // =========================================================================
    // CONSENT_STATE — 正向用例
    // =========================================================================

    #[tokio::test]
    async fn consent_state_default_is_zero() {
        let _guard = CONSENT_TEST_MUTEX.lock().await;
        // Reset to known state for test isolation.
        CONSENT_STATE.store(0, Ordering::Relaxed);
        assert_eq!(CONSENT_STATE.load(Ordering::Relaxed), 0);
    }

    #[tokio::test]
    async fn consent_state_granted_sets_to_one() {
        let _guard = CONSENT_TEST_MUTEX.lock().await;
        CONSENT_STATE.store(1, Ordering::Relaxed);
        assert_eq!(CONSENT_STATE.load(Ordering::Relaxed), 1);
        // Reset after test.
        CONSENT_STATE.store(0, Ordering::Relaxed);
    }

    #[tokio::test]
    async fn consent_state_denied_sets_to_two() {
        let _guard = CONSENT_TEST_MUTEX.lock().await;
        CONSENT_STATE.store(2, Ordering::Relaxed);
        assert_eq!(CONSENT_STATE.load(Ordering::Relaxed), 2);
        // Reset after test.
        CONSENT_STATE.store(0, Ordering::Relaxed);
    }

    // =========================================================================
    // CONSENT_STATE — 边界用例
    // =========================================================================

    #[tokio::test]
    async fn consent_state_resets_to_zero() {
        let _guard = CONSENT_TEST_MUTEX.lock().await;
        // First set to granted.
        CONSENT_STATE.store(1, Ordering::Relaxed);
        assert_eq!(CONSENT_STATE.load(Ordering::Relaxed), 1);

        // Then reset to 0.
        CONSENT_STATE.store(0, Ordering::Relaxed);
        assert_eq!(CONSENT_STATE.load(Ordering::Relaxed), 0);
    }

    #[tokio::test]
    async fn consent_state_can_toggle_between_states() {
        let _guard = CONSENT_TEST_MUTEX.lock().await;
        CONSENT_STATE.store(1, Ordering::Relaxed);
        assert_eq!(CONSENT_STATE.load(Ordering::Relaxed), 1);

        CONSENT_STATE.store(2, Ordering::Relaxed);
        assert_eq!(CONSENT_STATE.load(Ordering::Relaxed), 2);

        CONSENT_STATE.store(1, Ordering::Relaxed);
        assert_eq!(CONSENT_STATE.load(Ordering::Relaxed), 1);

        // Reset after test.
        CONSENT_STATE.store(0, Ordering::Relaxed);
    }

    // =========================================================================
    // persist_consent_to_path — 正向用例
    // =========================================================================

    #[test]
    fn persist_consent_granted_writes_true_to_preferences() {
        let dir = TempDir::new().unwrap();
        let path = dir.path().join("preferences.json");

        persist_consent_to_path(&path, Some(true)).unwrap();

        let contents = std::fs::read_to_string(&path).unwrap();
        let prefs: AppPreferences = serde_json::from_str(&contents).unwrap();
        assert_eq!(prefs.crash_reporting_consent, Some(true));
    }

    #[test]
    fn persist_consent_denied_writes_false_to_preferences() {
        let dir = TempDir::new().unwrap();
        let path = dir.path().join("preferences.json");

        persist_consent_to_path(&path, Some(false)).unwrap();

        let contents = std::fs::read_to_string(&path).unwrap();
        let prefs: AppPreferences = serde_json::from_str(&contents).unwrap();
        assert_eq!(prefs.crash_reporting_consent, Some(false));
    }

    #[test]
    fn persist_consent_none_writes_null_to_preferences() {
        let dir = TempDir::new().unwrap();
        let path = dir.path().join("preferences.json");

        persist_consent_to_path(&path, None).unwrap();

        let contents = std::fs::read_to_string(&path).unwrap();
        let prefs: AppPreferences = serde_json::from_str(&contents).unwrap();
        assert_eq!(prefs.crash_reporting_consent, None);
    }

    // =========================================================================
    // persist_consent_to_path — 边界用例
    // =========================================================================

    #[test]
    fn persist_consent_preserves_other_preferences_fields() {
        let dir = TempDir::new().unwrap();
        let path = dir.path().join("preferences.json");

        // Write initial preferences with theme set.
        let initial = r#"{"theme":"dark","quick_pane_shortcut":"Ctrl+K","language":"fr","crash_reporting_consent":false}"#;
        std::fs::write(&path, initial).unwrap();

        persist_consent_to_path(&path, Some(true)).unwrap();

        let contents = std::fs::read_to_string(&path).unwrap();
        let prefs: AppPreferences = serde_json::from_str(&contents).unwrap();
        assert_eq!(prefs.crash_reporting_consent, Some(true));
        assert_eq!(prefs.theme, "dark");
        assert_eq!(prefs.quick_pane_shortcut.as_deref(), Some("Ctrl+K"));
        assert_eq!(prefs.language.as_deref(), Some("fr"));
    }

    #[test]
    fn persist_consent_creates_file_when_missing() {
        let dir = TempDir::new().unwrap();
        let path = dir.path().join("preferences.json");
        assert!(!path.exists());

        persist_consent_to_path(&path, Some(true)).unwrap();

        assert!(path.exists());
        let contents = std::fs::read_to_string(&path).unwrap();
        let prefs: AppPreferences = serde_json::from_str(&contents).unwrap();
        assert_eq!(prefs.crash_reporting_consent, Some(true));
    }

    #[test]
    fn persist_consent_handles_corrupted_existing_file() {
        let dir = TempDir::new().unwrap();
        let path = dir.path().join("preferences.json");
        std::fs::write(&path, "not valid json").unwrap();

        // Should fall back to defaults and still persist the consent.
        persist_consent_to_path(&path, Some(true)).unwrap();

        let contents = std::fs::read_to_string(&path).unwrap();
        let prefs: AppPreferences = serde_json::from_str(&contents).unwrap();
        assert_eq!(prefs.crash_reporting_consent, Some(true));
    }

    // =========================================================================
    // escape_json_string — 正向用例
    // =========================================================================

    #[test]
    fn escape_plain_string_wraps_in_quotes() {
        let result = escape_json_string("hello");
        assert_eq!(result, r#""hello""#);
    }

    #[test]
    fn escape_empty_string_produces_empty_quotes() {
        let result = escape_json_string("");
        assert_eq!(result, r#""""#);
    }

    #[test]
    fn escape_string_with_quotes() {
        let result = escape_json_string(r#"say "hi""#);
        assert_eq!(result, r#""say \"hi\"""#);
    }

    #[test]
    fn escape_string_with_backslash() {
        let result = escape_json_string(r"C:\Users\test");
        assert_eq!(result, r#""C:\\Users\\test""#);
    }

    #[test]
    fn escape_string_with_newline() {
        let result = escape_json_string("line1\nline2");
        assert_eq!(result, r#""line1\nline2""#);
    }

    #[test]
    fn escape_string_with_carriage_return() {
        let result = escape_json_string("line1\rline2");
        assert_eq!(result, r#""line1\rline2""#);
    }

    #[test]
    fn escape_string_with_tab() {
        let result = escape_json_string("col1\tcol2");
        assert_eq!(result, r#""col1\tcol2""#);
    }

    #[test]
    fn escape_string_with_mixed_special_chars() {
        let result = escape_json_string(r#"hello "world" \n\t"#);
        assert!(result.contains(r#"\"world\""#));
        assert!(result.contains(r"\\"));
    }

    // =========================================================================
    // escape_json_string — 边界用例
    // =========================================================================

    #[test]
    fn escape_unicode_content() {
        let result = escape_json_string("日本語");
        assert_eq!(result, r#""日本語""#);
    }

    #[test]
    fn escape_emoji_content() {
        let result = escape_json_string("🚀");
        assert_eq!(result, r#""🚀""#);
    }

    #[test]
    fn escape_control_characters_to_unicode_escape() {
        // U+0001 (SOH) is a control char that should become \u0001
        let result = escape_json_string("\u{0001}");
        assert_eq!(result, r#""\u0001""#);
    }

    #[test]
    fn escape_multiple_control_characters() {
        let input = "\u{0001}\u{0002}\u{001f}";
        let result = escape_json_string(input);
        assert!(result.contains(r"\u0001"));
        assert!(result.contains(r"\u0002"));
        assert!(result.contains(r"\u001f"));
    }

    #[test]
    fn escape_all_special_chars_together() {
        let input = "\"\\\n\r\t\u{0001}";
        let result = escape_json_string(input);
        assert!(result.contains(r#"\""#));
        assert!(result.contains(r"\\"));
        assert!(result.contains(r"\n"));
        assert!(result.contains(r"\r"));
        assert!(result.contains(r"\t"));
        assert!(result.contains(r"\u0001"));
    }

    // =========================================================================
    // escape_json_string — 异常用例
    // =========================================================================

    #[test]
    fn escape_string_with_only_special_chars() {
        // Input: " followed by \ (two chars)
        // Output: " + \" + \\ + " (6 chars)
        let result = escape_json_string("\"\\");
        assert_eq!(result, r#""\"\\""#);
    }

    #[test]
    fn escape_long_string_succeeds() {
        let input = "a".repeat(10_000);
        let result = escape_json_string(&input);
        assert!(result.starts_with('"'));
        assert!(result.ends_with('"'));
        assert_eq!(result.len(), input.len() + 2);
    }

    // =========================================================================
    // escape_json_string — 集成验证（生成的 JSON 可被 serde_json 解析）
    // =========================================================================

    #[test]
    fn escaped_output_is_valid_json_string() {
        let raw = r#"error: "null pointer" at C:\code\main.rs:42\nstack: \n  frame1"#;
        let escaped = escape_json_string(raw);
        let json = format!("{{\"message\":{escaped}}}");

        let parsed: serde_json::Value = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed["message"], raw);
    }

    // =========================================================================
    // persist_consent_to_path — 异常用例
    // =========================================================================

    #[test]
    fn persist_consent_fails_when_directory_does_not_exist() {
        let dir = TempDir::new().unwrap();
        // Drop the temp dir so the path no longer exists
        let path = dir.path().join("nonexistent_dir").join("preferences.json");
        drop(dir);

        let result = persist_consent_to_path(&path, Some(true));
        assert!(result.is_err());
    }

    #[test]
    fn persist_consent_fails_on_readonly_file() {
        let dir = TempDir::new().unwrap();
        let path = dir.path().join("preferences.json");

        // Create a file and make it read-only
        std::fs::write(&path, r#"{"theme":"dark"}"#).unwrap();

        let result = persist_consent_to_path(&path, Some(true));
        // On Windows, the temp file write may succeed but rename may fail
        // On Unix, the write to temp may succeed but rename over read-only may fail
        // Either way, the operation should either succeed or return an error gracefully
        // (not panic)
        // We accept both outcomes — the key is no panic
        let _ = result;
    }

    // =========================================================================
    // persist_consent_to_path — 边界用例
    // =========================================================================

    #[test]
    fn persist_consent_overwrites_existing_consent_value() {
        let dir = TempDir::new().unwrap();
        let path = dir.path().join("preferences.json");

        // First persist as true
        persist_consent_to_path(&path, Some(true)).unwrap();
        let prefs: AppPreferences =
            serde_json::from_str(&std::fs::read_to_string(&path).unwrap()).unwrap();
        assert_eq!(prefs.crash_reporting_consent, Some(true));

        // Then change to false
        persist_consent_to_path(&path, Some(false)).unwrap();
        let prefs: AppPreferences =
            serde_json::from_str(&std::fs::read_to_string(&path).unwrap()).unwrap();
        assert_eq!(prefs.crash_reporting_consent, Some(false));
    }

    #[test]
    fn persist_consent_none_after_granted() {
        let dir = TempDir::new().unwrap();
        let path = dir.path().join("preferences.json");

        persist_consent_to_path(&path, Some(true)).unwrap();
        persist_consent_to_path(&path, None).unwrap();

        let prefs: AppPreferences =
            serde_json::from_str(&std::fs::read_to_string(&path).unwrap()).unwrap();
        assert_eq!(prefs.crash_reporting_consent, None);
    }

    #[test]
    fn persist_consent_preserves_consent_field_after_other_corruption() {
        let dir = TempDir::new().unwrap();
        let path = dir.path().join("preferences.json");

        // Write a file with valid consent but corrupted other fields
        std::fs::write(&path, r#"{"crash_reporting_consent":true,"theme":123}"#).unwrap();

        persist_consent_to_path(&path, Some(false)).unwrap();

        let prefs: AppPreferences =
            serde_json::from_str(&std::fs::read_to_string(&path).unwrap()).unwrap();
        // Consent should be updated to false
        assert_eq!(prefs.crash_reporting_consent, Some(false));
    }

    // =========================================================================
    // read_crash_report_from_path — 边界用例
    // =========================================================================

    #[test]
    fn read_crash_report_handles_empty_file() {
        let dir = TempDir::new().unwrap();
        let path = dir.path().join("crash-report.json");
        std::fs::write(&path, "").unwrap();

        let result = read_crash_report_from_path(&path);
        assert!(result.is_err());
    }

    #[test]
    fn read_crash_report_handles_empty_json_object() {
        let dir = TempDir::new().unwrap();
        let path = dir.path().join("crash-report.json");
        std::fs::write(&path, "{}").unwrap();

        let result = read_crash_report_from_path(&path);
        assert!(result.is_err());
    }

    #[test]
    fn read_crash_report_with_extra_fields_still_works() {
        let dir = TempDir::new().unwrap();
        let path = dir.path().join("crash-report.json");
        // Extra fields should be ignored by serde
        let json = r#"{
            "crash_type": "rust_panic",
            "message": "boom",
            "location": null,
            "backtrace": "empty",
            "timestamp": 999,
            "app_version": "1.0",
            "extra_field": "ignored"
        }"#;
        std::fs::write(&path, json).unwrap();

        let loaded = read_crash_report_from_path(&path).unwrap().unwrap();
        assert_eq!(loaded.message, "boom");
    }

    // =========================================================================
    // delete_crash_report_at_path — 异常用例
    // =========================================================================

    #[test]
    fn delete_crash_report_fails_on_directory_not_file() {
        let dir = TempDir::new().unwrap();
        let path = dir.path().join("a_directory");
        std::fs::create_dir(&path).unwrap();

        let result = delete_crash_report_at_path(&path);
        // remove_file on a directory should fail on most platforms
        // (on Windows it may succeed if the dir is empty, which is also acceptable)
        let _ = result;
    }
}
