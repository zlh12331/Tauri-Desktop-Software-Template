//! Preferences management commands.
//!
//! Handles loading and saving user preferences to disk.

use std::path::{Path, PathBuf};
use tauri::{AppHandle, Runtime};

use crate::error::AppError;
use crate::types::{AppPreferences, validate_string_input, validate_theme};
use crate::utils::paths::{ensure_dir_exists, get_app_data_file_path};

/// Gets the path to the preferences file.
fn get_preferences_path<R: Runtime>(app: &AppHandle<R>) -> Result<PathBuf, AppError> {
    get_app_data_file_path(app, "preferences.json")
}

/// Load the saved quick pane shortcut from preferences, returning None on any failure.
/// Used at startup before the full preferences system is available.
pub fn load_quick_pane_shortcut<R: Runtime>(app: &AppHandle<R>) -> Option<String> {
    let path = get_preferences_path(app).ok()?;
    load_quick_pane_shortcut_from_path(&path)
}

/// Pure helper: loads the quick pane shortcut from a specific file path.
/// Exposed for integration testing without an `AppHandle`.
pub fn load_quick_pane_shortcut_from_path(path: &Path) -> Option<String> {
    if !path.exists() {
        return None;
    }
    let contents = std::fs::read_to_string(path)
        .inspect_err(|e| log::warn!("Failed to read preferences: {e}"))
        .ok()?;
    let prefs: AppPreferences = serde_json::from_str(&contents)
        .inspect_err(|e| log::warn!("Failed to parse preferences: {e}"))
        .ok()?;
    prefs.quick_pane_shortcut
}

/// Simple greeting command for demonstration purposes.
#[tauri::command]
#[specta::specta]
pub fn greet(name: &str) -> Result<String, AppError> {
    // Input validation
    if name.is_empty() {
        log::warn!("Invalid greet input: Name cannot be empty");
        return Err(AppError::validation("Name cannot be empty"));
    }
    validate_string_input(name, 100, "Name").map_err(|e| {
        log::warn!("Invalid greet input: {e}");
        e
    })?;

    log::info!("Greeting user: {name}");
    Ok(format!("Hello, {name}! You've been greeted from Rust!"))
}

/// Loads user preferences from disk.
/// Returns default preferences if the file doesn't exist.
///
/// Generic implementation — testable with any `Runtime` (including `MockRuntime`).
pub async fn load_preferences_impl<R: Runtime>(
    app: AppHandle<R>,
) -> Result<AppPreferences, AppError> {
    log::debug!("Loading preferences from disk");
    let prefs_path = get_preferences_path(&app)?;
    tauri::async_runtime::spawn_blocking(move || {
        if let Some(parent) = prefs_path.parent() {
            ensure_dir_exists(parent)?;
        }
        load_preferences_from_path(&prefs_path)
    })
    .await
    .map_err(|e| AppError::task_join(format!("Task join error: {e}")))?
}

/// Loads user preferences from disk.
/// Returns default preferences if the file doesn't exist.
#[tauri::command]
#[specta::specta]
pub async fn load_preferences(app: AppHandle) -> Result<AppPreferences, AppError> {
    load_preferences_impl(app).await
}

/// Pure helper: loads preferences from a specific file path.
/// Exposed for integration testing without an `AppHandle`.
pub fn load_preferences_from_path(path: &Path) -> Result<AppPreferences, AppError> {
    if !path.exists() {
        log::info!("Preferences file not found, using defaults");
        return Ok(AppPreferences::default());
    }

    let contents = std::fs::read_to_string(path).map_err(|e| {
        log::error!("Failed to read preferences file: {e}");
        AppError::io(format!("Failed to read preferences file: {e}"))
    })?;

    let preferences: AppPreferences = serde_json::from_str(&contents).map_err(|e| {
        log::error!("Failed to parse preferences JSON: {e}");
        AppError::serialization(format!("Failed to parse preferences: {e}"))
    })?;

    log::info!("Successfully loaded preferences");
    Ok(preferences)
}

/// Saves user preferences to disk.
/// Uses atomic write (temp file + rename) to prevent corruption.
///
/// Generic implementation — testable with any `Runtime` (including `MockRuntime`).
pub async fn save_preferences_impl<R: Runtime>(
    app: AppHandle<R>,
    preferences: AppPreferences,
) -> Result<(), AppError> {
    // Validate theme value
    validate_theme(&preferences.theme)?;

    log::debug!("Saving preferences to disk: {preferences:?}");
    let prefs_path = get_preferences_path(&app)?;
    tauri::async_runtime::spawn_blocking(move || {
        if let Some(parent) = prefs_path.parent() {
            ensure_dir_exists(parent)?;
        }
        save_preferences_to_path(&prefs_path, &preferences)
    })
    .await
    .map_err(|e| AppError::task_join(format!("Task join error: {e}")))?
}

/// Saves user preferences to disk.
/// Uses atomic write (temp file + rename) to prevent corruption.
#[tauri::command]
#[specta::specta]
pub async fn save_preferences(app: AppHandle, preferences: AppPreferences) -> Result<(), AppError> {
    save_preferences_impl(app, preferences).await
}

/// Pure helper: saves preferences to a specific file path using atomic write.
/// Exposed for integration testing without an `AppHandle`.
pub fn save_preferences_to_path(path: &Path, preferences: &AppPreferences) -> Result<(), AppError> {
    let json_content = serde_json::to_string_pretty(preferences).map_err(|e| {
        log::error!("Failed to serialize preferences: {e}");
        AppError::serialization(format!("Failed to serialize preferences: {e}"))
    })?;

    // Write to a temporary file first, then rename (atomic operation)
    let temp_path = path.with_extension("tmp");

    std::fs::write(&temp_path, json_content).map_err(|e| {
        log::error!("Failed to write preferences file: {e}");
        AppError::io(format!("Failed to write preferences file: {e}"))
    })?;

    if let Err(rename_err) = std::fs::rename(&temp_path, path) {
        log::error!("Failed to finalize preferences file: {rename_err}");
        // Clean up the temp file to avoid leaving orphaned files on disk
        if let Err(remove_err) = std::fs::remove_file(&temp_path) {
            log::warn!("Failed to remove temp file after rename failure: {remove_err}");
        }
        return Err(AppError::io(format!(
            "Failed to finalize preferences file: {rename_err}"
        )));
    }

    log::info!("Successfully saved preferences to {path:?}");
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::types::AppPreferences;
    use tempfile::TempDir;

    // =========================================================================
    // greet — 正向/边界/异常用例
    // =========================================================================

    #[test]
    fn greet_returns_greeting_with_name() {
        let result = greet("World").unwrap();
        assert_eq!(result, "Hello, World! You've been greeted from Rust!");
    }

    #[test]
    fn greet_accepts_single_char_name() {
        let result = greet("A").unwrap();
        assert!(result.contains("Hello, A!"));
    }

    #[test]
    fn greet_accepts_max_length_name() {
        let name = "a".repeat(100);
        let result = greet(&name).unwrap();
        assert!(result.contains(&name));
    }

    #[test]
    fn greet_rejects_empty_name() {
        let result = greet("");
        assert!(result.is_err());
        assert!(result.unwrap_err().to_string().contains("cannot be empty"));
    }

    #[test]
    fn greet_rejects_too_long_name() {
        let name = "a".repeat(101);
        let result = greet(&name);
        assert!(result.is_err());
        assert!(result.unwrap_err().to_string().contains("too long"));
    }

    #[test]
    fn greet_accepts_special_chars_in_name() {
        let result = greet("José Müller").unwrap();
        assert!(result.contains("José Müller"));
    }

    // =========================================================================
    // load_preferences_from_path — 正向用例
    // =========================================================================

    #[test]
    fn load_preferences_returns_default_when_file_missing() {
        let dir = TempDir::new().unwrap();
        let path = dir.path().join("nonexistent.json");

        let prefs = load_preferences_from_path(&path).unwrap();
        assert_eq!(prefs.theme, "system");
        assert!(prefs.quick_pane_shortcut.is_none());
        assert!(prefs.language.is_none());
    }

    #[test]
    fn load_preferences_reads_valid_file() {
        let dir = TempDir::new().unwrap();
        let path = dir.path().join("preferences.json");
        let json = r#"{"theme":"dark","quick_pane_shortcut":"CommandOrControl+Shift+Space","language":"en","crash_reporting_consent":true}"#;
        std::fs::write(&path, json).unwrap();

        let prefs = load_preferences_from_path(&path).unwrap();
        assert_eq!(prefs.theme, "dark");
        assert_eq!(
            prefs.quick_pane_shortcut.as_deref(),
            Some("CommandOrControl+Shift+Space")
        );
        assert_eq!(prefs.language.as_deref(), Some("en"));
        assert_eq!(prefs.crash_reporting_consent, Some(true));
    }

    // =========================================================================
    // load_preferences_from_path — 边界用例
    // =========================================================================

    #[test]
    fn load_preferences_handles_minimal_json() {
        let dir = TempDir::new().unwrap();
        let path = dir.path().join("preferences.json");
        // Only required field: theme
        std::fs::write(&path, r#"{"theme":"light"}"#).unwrap();

        let prefs = load_preferences_from_path(&path).unwrap();
        assert_eq!(prefs.theme, "light");
        assert!(prefs.quick_pane_shortcut.is_none());
    }

    #[test]
    fn load_preferences_handles_empty_object() {
        let dir = TempDir::new().unwrap();
        let path = dir.path().join("preferences.json");
        std::fs::write(&path, "{}").unwrap();

        let prefs = load_preferences_from_path(&path).unwrap();
        // serde fills missing fields with defaults
        assert_eq!(prefs.theme, "system");
    }

    // =========================================================================
    // load_preferences_from_path — 异常用例
    // =========================================================================

    #[test]
    fn load_preferences_fails_on_invalid_json() {
        let dir = TempDir::new().unwrap();
        let path = dir.path().join("preferences.json");
        std::fs::write(&path, "not json").unwrap();

        let result = load_preferences_from_path(&path);
        assert!(result.is_err());
        assert!(result.unwrap_err().to_string().contains("Failed to parse"));
    }

    #[test]
    fn load_preferences_fails_on_partial_invalid_json() {
        let dir = TempDir::new().unwrap();
        let path = dir.path().join("preferences.json");
        std::fs::write(&path, r#"{"theme":"dark","language":}"#).unwrap();

        let result = load_preferences_from_path(&path);
        assert!(result.is_err());
    }

    // =========================================================================
    // save_preferences_to_path — 正向用例
    // =========================================================================

    #[test]
    fn save_preferences_writes_valid_json() {
        let dir = TempDir::new().unwrap();
        let path = dir.path().join("preferences.json");
        let prefs = AppPreferences {
            theme: "dark".to_string(),
            quick_pane_shortcut: Some("Cmd+Shift+P".to_string()),
            language: Some("en".to_string()),
            crash_reporting_consent: Some(true),
        };

        save_preferences_to_path(&path, &prefs).unwrap();

        let contents = std::fs::read_to_string(&path).unwrap();
        assert!(contents.contains("dark"));
        assert!(contents.contains("Cmd+Shift+P"));
        assert!(contents.contains("en"));
        assert!(contents.contains("true"));
    }

    #[test]
    fn save_preferences_roundtrips_with_load() {
        let dir = TempDir::new().unwrap();
        let path = dir.path().join("preferences.json");
        let original = AppPreferences {
            theme: "light".to_string(),
            quick_pane_shortcut: Some("Ctrl+K".to_string()),
            language: Some("fr".to_string()),
            crash_reporting_consent: Some(false),
        };

        save_preferences_to_path(&path, &original).unwrap();
        let loaded = load_preferences_from_path(&path).unwrap();

        assert_eq!(loaded.theme, original.theme);
        assert_eq!(loaded.quick_pane_shortcut, original.quick_pane_shortcut);
        assert_eq!(loaded.language, original.language);
        assert_eq!(
            loaded.crash_reporting_consent,
            original.crash_reporting_consent
        );
    }

    #[test]
    fn save_preferences_creates_file_in_nonexistent_dir() {
        let dir = TempDir::new().unwrap();
        let nested = dir.path().join("nested").join("subdir");
        let path = nested.join("preferences.json");

        // Note: save_preferences_to_path does NOT create parent dirs.
        // This test verifies it fails gracefully (not panics).
        let prefs = AppPreferences::default();
        let result = save_preferences_to_path(&path, &prefs);
        assert!(result.is_err());
    }

    // =========================================================================
    // save_preferences_to_path — 边界用例
    // =========================================================================

    #[test]
    fn save_preferences_overwrites_existing_file() {
        let dir = TempDir::new().unwrap();
        let path = dir.path().join("preferences.json");

        let prefs1 = AppPreferences {
            theme: "dark".to_string(),
            ..Default::default()
        };
        save_preferences_to_path(&path, &prefs1).unwrap();

        let prefs2 = AppPreferences {
            theme: "light".to_string(),
            ..Default::default()
        };
        save_preferences_to_path(&path, &prefs2).unwrap();

        let loaded = load_preferences_from_path(&path).unwrap();
        assert_eq!(loaded.theme, "light");
    }

    #[test]
    fn save_preferences_with_default_values() {
        let dir = TempDir::new().unwrap();
        let path = dir.path().join("preferences.json");
        let prefs = AppPreferences::default();

        save_preferences_to_path(&path, &prefs).unwrap();

        let loaded = load_preferences_from_path(&path).unwrap();
        assert_eq!(loaded.theme, "system");
        assert!(loaded.quick_pane_shortcut.is_none());
    }

    // =========================================================================
    // load_quick_pane_shortcut_from_path — 正向/边界/异常用例
    // =========================================================================

    #[test]
    fn load_quick_pane_shortcut_returns_some_when_present() {
        let dir = TempDir::new().unwrap();
        let path = dir.path().join("preferences.json");
        let json = r#"{"theme":"system","quick_pane_shortcut":"Cmd+Shift+Space"}"#;
        std::fs::write(&path, json).unwrap();

        let shortcut = load_quick_pane_shortcut_from_path(&path);
        assert_eq!(shortcut.as_deref(), Some("Cmd+Shift+Space"));
    }

    #[test]
    fn load_quick_pane_shortcut_returns_none_when_missing_file() {
        let dir = TempDir::new().unwrap();
        let path = dir.path().join("nonexistent.json");

        let shortcut = load_quick_pane_shortcut_from_path(&path);
        assert!(shortcut.is_none());
    }

    #[test]
    fn load_quick_pane_shortcut_returns_none_when_field_absent() {
        let dir = TempDir::new().unwrap();
        let path = dir.path().join("preferences.json");
        std::fs::write(&path, r#"{"theme":"dark"}"#).unwrap();

        let shortcut = load_quick_pane_shortcut_from_path(&path);
        assert!(shortcut.is_none());
    }

    #[test]
    fn load_quick_pane_shortcut_returns_none_on_invalid_json() {
        let dir = TempDir::new().unwrap();
        let path = dir.path().join("preferences.json");
        std::fs::write(&path, "garbage").unwrap();

        let shortcut = load_quick_pane_shortcut_from_path(&path);
        assert!(shortcut.is_none());
    }

    // =========================================================================
    // greet — 边界用例补充
    // =========================================================================

    #[test]
    fn greet_accepts_exactly_100_chars() {
        let name = "a".repeat(100);
        let result = greet(&name);
        assert!(result.is_ok());
    }

    #[test]
    fn greet_rejects_101_chars() {
        let name = "a".repeat(101);
        let result = greet(&name);
        assert!(result.is_err());
        assert!(result.unwrap_err().to_string().contains("too long"));
    }

    #[test]
    fn greet_accepts_multibyte_chars_within_limit() {
        // 50 CJK chars = 50 chars (not 150 bytes)
        let name = "好".repeat(50);
        let result = greet(&name);
        assert!(result.is_ok());
    }

    #[test]
    fn greet_rejects_multibyte_exceeding_limit() {
        // 101 CJK chars = 101 chars
        let name = "好".repeat(101);
        let result = greet(&name);
        assert!(result.is_err());
    }

    #[test]
    fn greet_accepts_name_with_numbers() {
        let result = greet("User123").unwrap();
        assert!(result.contains("User123"));
    }

    #[test]
    fn greet_accepts_name_with_spaces() {
        let result = greet("John Doe").unwrap();
        assert!(result.contains("John Doe"));
    }

    // =========================================================================
    // load_preferences_from_path — 边界用例补充
    // =========================================================================

    #[test]
    fn load_preferences_handles_extra_unknown_fields() {
        let dir = TempDir::new().unwrap();
        let path = dir.path().join("preferences.json");
        std::fs::write(
            &path,
            r#"{"theme":"dark","unknown_field":"ignored","another":123}"#,
        )
        .unwrap();

        let prefs = load_preferences_from_path(&path).unwrap();
        assert_eq!(prefs.theme, "dark");
    }

    #[test]
    fn load_preferences_handles_null_language() {
        let dir = TempDir::new().unwrap();
        let path = dir.path().join("preferences.json");
        std::fs::write(&path, r#"{"theme":"system","language":null}"#).unwrap();

        let prefs = load_preferences_from_path(&path).unwrap();
        assert!(prefs.language.is_none());
    }

    #[test]
    fn load_preferences_handles_null_shortcut() {
        let dir = TempDir::new().unwrap();
        let path = dir.path().join("preferences.json");
        std::fs::write(&path, r#"{"theme":"system","quick_pane_shortcut":null}"#).unwrap();

        let prefs = load_preferences_from_path(&path).unwrap();
        assert!(prefs.quick_pane_shortcut.is_none());
    }

    #[test]
    fn load_preferences_handles_null_consent() {
        let dir = TempDir::new().unwrap();
        let path = dir.path().join("preferences.json");
        std::fs::write(
            &path,
            r#"{"theme":"system","crash_reporting_consent":null}"#,
        )
        .unwrap();

        let prefs = load_preferences_from_path(&path).unwrap();
        assert_eq!(prefs.crash_reporting_consent, None);
    }

    #[test]
    fn load_preferences_handles_all_fields_populated() {
        let dir = TempDir::new().unwrap();
        let path = dir.path().join("preferences.json");
        let json = r#"{
            "theme": "dark",
            "quick_pane_shortcut": "Cmd+Shift+P",
            "language": "zh",
            "crash_reporting_consent": true
        }"#;
        std::fs::write(&path, json).unwrap();

        let prefs = load_preferences_from_path(&path).unwrap();
        assert_eq!(prefs.theme, "dark");
        assert_eq!(prefs.quick_pane_shortcut.as_deref(), Some("Cmd+Shift+P"));
        assert_eq!(prefs.language.as_deref(), Some("zh"));
        assert_eq!(prefs.crash_reporting_consent, Some(true));
    }

    // =========================================================================
    // load_preferences_from_path — 异常用例补充
    // =========================================================================

    #[test]
    fn load_preferences_fails_on_empty_file() {
        let dir = TempDir::new().unwrap();
        let path = dir.path().join("preferences.json");
        std::fs::write(&path, "").unwrap();

        let result = load_preferences_from_path(&path);
        assert!(result.is_err());
    }

    #[test]
    fn load_preferences_fails_on_array_not_object() {
        let dir = TempDir::new().unwrap();
        let path = dir.path().join("preferences.json");
        std::fs::write(&path, r#"[1,2,3]"#).unwrap();

        let result = load_preferences_from_path(&path);
        assert!(result.is_err());
    }

    #[test]
    fn load_preferences_fails_on_string_not_object() {
        let dir = TempDir::new().unwrap();
        let path = dir.path().join("preferences.json");
        std::fs::write(&path, r#""just a string""#).unwrap();

        let result = load_preferences_from_path(&path);
        assert!(result.is_err());
    }

    #[test]
    fn load_preferences_fails_on_number() {
        let dir = TempDir::new().unwrap();
        let path = dir.path().join("preferences.json");
        std::fs::write(&path, "42").unwrap();

        let result = load_preferences_from_path(&path);
        assert!(result.is_err());
    }

    // =========================================================================
    // save_preferences_to_path — 异常用例补充
    // =========================================================================

    #[test]
    fn save_preferences_fails_on_nonexistent_parent_dir() {
        let dir = TempDir::new().unwrap();
        let path = dir
            .path()
            .join("a")
            .join("b")
            .join("c")
            .join("preferences.json");
        let prefs = AppPreferences::default();

        let result = save_preferences_to_path(&path, &prefs);
        assert!(result.is_err());
    }

    #[test]
    fn save_preferences_does_not_leave_temp_file_on_failure() {
        let dir = TempDir::new().unwrap();
        // Nonexistent parent dir — write will fail
        let path = dir.path().join("missing").join("preferences.json");
        let prefs = AppPreferences::default();

        let _ = save_preferences_to_path(&path, &prefs);

        // No temp file should exist in the dir
        assert!(!dir.path().join("missing").join("preferences.tmp").exists());
    }

    // =========================================================================
    // save_preferences_to_path — 边界用例补充
    // =========================================================================

    #[test]
    fn save_preferences_with_all_fields_set() {
        let dir = TempDir::new().unwrap();
        let path = dir.path().join("preferences.json");
        let prefs = AppPreferences {
            theme: "light".to_string(),
            quick_pane_shortcut: Some("Ctrl+Shift+Space".to_string()),
            language: Some("zh".to_string()),
            crash_reporting_consent: Some(false),
        };

        save_preferences_to_path(&path, &prefs).unwrap();

        let loaded = load_preferences_from_path(&path).unwrap();
        assert_eq!(loaded.theme, "light");
        assert_eq!(
            loaded.quick_pane_shortcut.as_deref(),
            Some("Ctrl+Shift+Space")
        );
        assert_eq!(loaded.language.as_deref(), Some("zh"));
        assert_eq!(loaded.crash_reporting_consent, Some(false));
    }

    #[test]
    fn save_preferences_produces_pretty_json() {
        let dir = TempDir::new().unwrap();
        let path = dir.path().join("preferences.json");
        let prefs = AppPreferences::default();

        save_preferences_to_path(&path, &prefs).unwrap();

        let contents = std::fs::read_to_string(&path).unwrap();
        // Pretty JSON should have newlines
        assert!(contents.contains('\n'));
        assert!(contents.contains("  "));
    }

    // =========================================================================
    // load_quick_pane_shortcut_from_path — 边界用例补充
    // =========================================================================

    #[test]
    fn load_quick_pane_shortcut_returns_none_on_empty_file() {
        let dir = TempDir::new().unwrap();
        let path = dir.path().join("preferences.json");
        std::fs::write(&path, "").unwrap();

        let shortcut = load_quick_pane_shortcut_from_path(&path);
        assert!(shortcut.is_none());
    }

    #[test]
    fn load_quick_pane_shortcut_returns_none_on_array_json() {
        let dir = TempDir::new().unwrap();
        let path = dir.path().join("preferences.json");
        std::fs::write(&path, r#"[1,2,3]"#).unwrap();

        let shortcut = load_quick_pane_shortcut_from_path(&path);
        assert!(shortcut.is_none());
    }

    #[test]
    fn load_quick_pane_shortcut_returns_value_when_shortcut_is_empty_string() {
        let dir = TempDir::new().unwrap();
        let path = dir.path().join("preferences.json");
        std::fs::write(&path, r#"{"theme":"system","quick_pane_shortcut":""}"#).unwrap();

        let shortcut = load_quick_pane_shortcut_from_path(&path);
        assert_eq!(shortcut.as_deref(), Some(""));
    }

    // =========================================================================
    // 综合 — 多次保存/加载循环
    // =========================================================================

    #[test]
    fn save_load_cycle_preserves_data_across_iterations() {
        let dir = TempDir::new().unwrap();
        let path = dir.path().join("preferences.json");

        for i in 0..5 {
            let prefs = AppPreferences {
                theme: if i % 2 == 0 { "dark" } else { "light" }.to_string(),
                quick_pane_shortcut: Some(format!("Ctrl+{i}")),
                language: Some(if i % 2 == 0 { "en" } else { "zh" }.to_string()),
                crash_reporting_consent: Some(i % 3 == 0),
            };

            save_preferences_to_path(&path, &prefs).unwrap();
            let loaded = load_preferences_from_path(&path).unwrap();

            assert_eq!(loaded.theme, prefs.theme);
            assert_eq!(loaded.quick_pane_shortcut, prefs.quick_pane_shortcut);
            assert_eq!(loaded.language, prefs.language);
            assert_eq!(
                loaded.crash_reporting_consent,
                prefs.crash_reporting_consent
            );
        }
    }
}
