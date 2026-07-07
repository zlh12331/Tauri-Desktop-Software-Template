//! Shared types and validation functions for the Tauri application.

use regex::Regex;
use serde::{Deserialize, Serialize};
use specta::Type;
use std::sync::LazyLock;

use crate::error::AppError;

/// Default shortcut for the quick pane
pub const DEFAULT_QUICK_PANE_SHORTCUT: &str = "CommandOrControl+Shift+.";

/// Maximum size for recovery data files (10MB)
pub const MAX_RECOVERY_DATA_BYTES: u32 = 10_485_760;

/// Pre-compiled regex pattern for filename validation.
/// Only allows alphanumeric characters, dashes, underscores, and a single extension.
pub static FILENAME_PATTERN: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"^[a-zA-Z0-9_-]+(\.[a-zA-Z0-9]+)?$")
        .expect("Failed to compile filename regex pattern")
});

// ============================================================================
// Preferences
// ============================================================================

/// Default theme value used by both `AppPreferences::default()` and serde
/// deserialization when the `theme` field is missing from JSON.
fn default_theme() -> String {
    "system".to_string()
}

/// Application preferences that persist to disk.
/// Only contains settings that should be saved between sessions.
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct AppPreferences {
    #[serde(default = "default_theme")]
    pub theme: String,
    /// Global shortcut for quick pane (e.g., "CommandOrControl+Shift+.")
    /// If None, uses the default shortcut
    pub quick_pane_shortcut: Option<String>,
    /// User's preferred language (e.g., "en", "es", "de")
    /// If None, uses system locale detection
    pub language: Option<String>,
    /// Crash reporting consent: None = not asked, Some(true) = consent, Some(false) = denied
    pub crash_reporting_consent: Option<bool>,
}

impl Default for AppPreferences {
    fn default() -> Self {
        Self {
            theme: "system".to_string(),
            quick_pane_shortcut: None,     // None means use default
            language: None,                // None means use system locale
            crash_reporting_consent: None, // None means not asked yet
        }
    }
}

// ============================================================================
// Crash Reporting
// ============================================================================

/// Crash report data captured by the panic hook and stored to disk.
/// The frontend reads this on next startup and sends it to Sentry (if consent given).
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct CrashReportData {
    /// Type of crash (e.g., "rust_panic")
    pub crash_type: String,
    /// Panic message
    pub message: String,
    /// Source location (file:line:column), if available
    pub location: Option<String>,
    /// Full backtrace string
    pub backtrace: String,
    /// Unix timestamp (seconds since epoch)
    pub timestamp: f64,
    /// Application version when the crash occurred
    pub app_version: String,
}

// ============================================================================
// Recovery Errors
// ============================================================================

/// Error types for recovery operations (typed for frontend matching).
/// Uses `tag = "kind"` to stay consistent with `AppError`'s serde tag,
/// so the frontend can use a single discriminator field for all errors.
#[derive(Debug, Clone, thiserror::Error, Serialize, Deserialize, Type)]
#[serde(tag = "kind")]
pub enum RecoveryError {
    /// File does not exist (expected case, not a failure)
    #[error("File not found")]
    FileNotFound,
    /// Filename validation failed
    #[error("Validation error: {message}")]
    ValidationError { message: String },
    /// Data exceeds size limit
    #[error("Data too large (max {max_bytes} bytes)")]
    DataTooLarge { max_bytes: u32 },
    /// File system read/write error
    #[error("IO error: {message}")]
    IoError { message: String },
    /// JSON serialization/deserialization error
    #[error("Parse error: {message}")]
    ParseError { message: String },
}

// ============================================================================
// Validation Functions
// ============================================================================

/// Validates a filename for safe file system operations.
/// Only allows alphanumeric characters, dashes, underscores, and a single extension.
pub fn validate_filename(filename: &str) -> Result<(), AppError> {
    if filename.is_empty() {
        return Err(AppError::validation("Filename cannot be empty"));
    }

    if filename.chars().count() > 100 {
        return Err(AppError::validation(
            "Filename too long (max 100 characters)",
        ));
    }

    if !FILENAME_PATTERN.is_match(filename) {
        return Err(AppError::validation(
            "Invalid filename: only alphanumeric characters, dashes, underscores, and dots allowed",
        ));
    }

    Ok(())
}

/// Validates string input length (by character count, not bytes).
pub fn validate_string_input(
    input: &str,
    max_len: usize,
    field_name: &str,
) -> Result<(), AppError> {
    let char_count = input.chars().count();
    if char_count > max_len {
        return Err(AppError::validation(format!(
            "{field_name} too long (max {max_len} characters)"
        )));
    }
    Ok(())
}

/// Validates theme value.
pub fn validate_theme(theme: &str) -> Result<(), AppError> {
    match theme {
        "light" | "dark" | "system" => Ok(()),
        _ => Err(AppError::validation(
            "Invalid theme: must be 'light', 'dark', or 'system'",
        )),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    // =========================================================================
    // validate_filename — 正向用例 (Positive cases)
    // =========================================================================

    #[test]
    fn validate_filename_accepts_simple_name() {
        assert!(validate_filename("document").is_ok());
    }

    #[test]
    fn validate_filename_accepts_name_with_dashes() {
        assert!(validate_filename("my-document").is_ok());
    }

    #[test]
    fn validate_filename_accepts_name_with_underscores() {
        assert!(validate_filename("my_document").is_ok());
    }

    #[test]
    fn validate_filename_accepts_alphanumeric_mix() {
        assert!(validate_filename("file123").is_ok());
    }

    #[test]
    fn validate_filename_accepts_single_extension() {
        assert!(validate_filename("document.json").is_ok());
        assert!(validate_filename("archive_v2.txt").is_ok());
    }

    #[test]
    fn validate_filename_accepts_uppercase_chars() {
        assert!(validate_filename("MyDocument").is_ok());
    }

    // =========================================================================
    // validate_filename — 边界用例 (Boundary cases)
    // =========================================================================

    #[test]
    fn validate_filename_accepts_single_char() {
        assert!(validate_filename("a").is_ok());
    }

    #[test]
    fn validate_filename_accepts_exactly_100_chars() {
        let name = "a".repeat(100);
        assert!(validate_filename(&name).is_ok());
    }

    #[test]
    fn validate_filename_rejects_empty_string() {
        let result = validate_filename("");
        assert!(result.is_err());
        assert!(result.unwrap_err().to_string().contains("cannot be empty"));
    }

    #[test]
    fn validate_filename_rejects_101_chars() {
        let name = "a".repeat(101);
        let result = validate_filename(&name);
        assert!(result.is_err());
        assert!(result.unwrap_err().to_string().contains("too long"));
    }

    // =========================================================================
    // validate_filename — 异常用例 (Exception cases)
    // =========================================================================

    #[test]
    fn validate_filename_rejects_path_separator_slash() {
        assert!(validate_filename("path/to/file").is_err());
    }

    #[test]
    fn validate_filename_rejects_backslash() {
        assert!(validate_filename("path\\file").is_err());
    }

    #[test]
    fn validate_filename_rejects_colon() {
        assert!(validate_filename("file:name").is_err());
    }

    #[test]
    fn validate_filename_rejects_asterisk() {
        assert!(validate_filename("file*name").is_err());
    }

    #[test]
    fn validate_filename_rejects_question_mark() {
        assert!(validate_filename("file?name").is_err());
    }

    #[test]
    fn validate_filename_rejects_double_quote() {
        assert!(validate_filename("file\"name").is_err());
    }

    #[test]
    fn validate_filename_rejects_angle_brackets() {
        assert!(validate_filename("file<name>").is_err());
    }

    #[test]
    fn validate_filename_rejects_pipe() {
        assert!(validate_filename("file|name").is_err());
    }

    #[test]
    fn validate_filename_rejects_double_extension() {
        // The regex only allows a single extension segment
        assert!(validate_filename("file.tar.gz").is_err());
    }

    #[test]
    fn validate_filename_rejects_leading_dot() {
        assert!(validate_filename(".hidden").is_err());
    }

    #[test]
    fn validate_filename_rejects_spaces() {
        assert!(validate_filename("my file").is_err());
    }

    // =========================================================================
    // validate_string_input — 正向/边界/异常用例
    // =========================================================================

    #[test]
    fn validate_string_input_accepts_within_limit() {
        assert!(validate_string_input("hello", 100, "Name").is_ok());
    }

    #[test]
    fn validate_string_input_accepts_exact_max_length() {
        let input = "a".repeat(50);
        assert!(validate_string_input(&input, 50, "Field").is_ok());
    }

    #[test]
    fn validate_string_input_accepts_empty_string() {
        assert!(validate_string_input("", 100, "Name").is_ok());
    }

    #[test]
    fn validate_string_input_accepts_multibyte_chars() {
        // CJK characters: each counts as 1 char, not 3 bytes
        let input = "你好世界"; // 4 chars
        assert!(validate_string_input(input, 10, "Name").is_ok());
    }

    #[test]
    fn validate_string_input_rejects_exceeding_limit() {
        let input = "a".repeat(101);
        let result = validate_string_input(&input, 100, "Name");
        assert!(result.is_err());
        let err_msg = result.unwrap_err().to_string();
        assert!(err_msg.contains("too long"));
        assert!(err_msg.contains("Name"));
    }

    #[test]
    fn validate_string_input_rejects_exceeding_multibyte_limit() {
        let input = "你好".repeat(51); // 102 chars
        let result = validate_string_input(&input, 100, "Name");
        assert!(result.is_err());
        assert!(result.unwrap_err().to_string().contains("too long"));
    }

    // =========================================================================
    // validate_theme — 正向/边界/异常用例
    // =========================================================================

    #[test]
    fn validate_theme_accepts_light() {
        assert!(validate_theme("light").is_ok());
    }

    #[test]
    fn validate_theme_accepts_dark() {
        assert!(validate_theme("dark").is_ok());
    }

    #[test]
    fn validate_theme_accepts_system() {
        assert!(validate_theme("system").is_ok());
    }

    #[test]
    fn validate_theme_rejects_empty_string() {
        let result = validate_theme("");
        assert!(result.is_err());
        assert!(result.unwrap_err().to_string().contains("Invalid theme"));
    }

    #[test]
    fn validate_theme_rejects_invalid_value() {
        let result = validate_theme("purple");
        assert!(result.is_err());
        assert!(result.unwrap_err().to_string().contains("Invalid theme"));
    }

    #[test]
    fn validate_theme_rejects_case_variants() {
        assert!(validate_theme("Light").is_err());
        assert!(validate_theme("DARK").is_err());
        assert!(validate_theme("System").is_err());
    }

    // =========================================================================
    // AppPreferences::default — 正向用例
    // =========================================================================

    #[test]
    fn app_preferences_default_has_system_theme() {
        let prefs = AppPreferences::default();
        assert_eq!(prefs.theme, "system");
    }

    #[test]
    fn app_preferences_default_has_none_shortcut() {
        let prefs = AppPreferences::default();
        assert!(prefs.quick_pane_shortcut.is_none());
    }

    #[test]
    fn app_preferences_default_has_none_language() {
        let prefs = AppPreferences::default();
        assert!(prefs.language.is_none());
    }

    #[test]
    fn app_preferences_default_has_none_crash_consent() {
        let prefs = AppPreferences::default();
        assert!(prefs.crash_reporting_consent.is_none());
    }

    #[test]
    fn app_preferences_serializes_to_json() {
        let prefs = AppPreferences::default();
        let json = serde_json::to_string(&prefs).expect("Failed to serialize");
        assert!(json.contains("system"));
        // Deserialization round-trip
        let deserialized: AppPreferences =
            serde_json::from_str(&json).expect("Failed to deserialize");
        assert_eq!(deserialized.theme, prefs.theme);
    }

    // =========================================================================
    // RecoveryError — Display trait 用例
    // =========================================================================

    #[test]
    fn recovery_error_file_not_found_display() {
        let err = RecoveryError::FileNotFound;
        assert_eq!(format!("{err}"), "File not found");
    }

    #[test]
    fn recovery_error_validation_display() {
        let err = RecoveryError::ValidationError {
            message: "bad input".to_string(),
        };
        assert_eq!(format!("{err}"), "Validation error: bad input");
    }

    #[test]
    fn recovery_error_data_too_large_display() {
        let err = RecoveryError::DataTooLarge {
            max_bytes: 10485760,
        };
        assert!(format!("{err}").contains("10485760"));
    }

    #[test]
    fn recovery_error_io_error_display() {
        let err = RecoveryError::IoError {
            message: "disk full".to_string(),
        };
        assert_eq!(format!("{err}"), "IO error: disk full");
    }

    #[test]
    fn recovery_error_parse_error_display() {
        let err = RecoveryError::ParseError {
            message: "invalid json".to_string(),
        };
        assert_eq!(format!("{err}"), "Parse error: invalid json");
    }

    #[test]
    fn recovery_error_serializes_with_tag() {
        let err = RecoveryError::FileNotFound;
        let json = serde_json::to_string(&err).expect("Failed to serialize");
        assert!(json.contains("\"kind\":\"FileNotFound\""));
    }

    // =========================================================================
    // DEFAULT_QUICK_PANE_SHORTCUT 常量
    // =========================================================================

    #[test]
    fn default_quick_pane_shortcut_is_valid() {
        assert!(!DEFAULT_QUICK_PANE_SHORTCUT.is_empty());
        assert!(DEFAULT_QUICK_PANE_SHORTCUT.contains("CommandOrControl"));
    }
}
