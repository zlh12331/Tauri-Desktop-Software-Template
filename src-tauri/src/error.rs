//! Structured error type for all Tauri commands.
//!
//! Uses `thiserror` for automatic `Display` and `std::error::Error` impl
//! generation, eliminating boilerplate. The `serde::Serialize` + `specta::Type`
//! derives allow the error to flow across the Tauri IPC boundary to the
//! frontend, where the `kind` tag enables type-safe error handling.

use specta::Type;

/// The unified error type used by all Tauri command handlers.
///
/// Each variant corresponds to a broad category of failure. The `kind` tag
/// allows the frontend to switch on error type, while the `message` field
/// carries human-readable details.
#[derive(Debug, Clone, thiserror::Error, serde::Serialize, Type)]
#[serde(tag = "kind", content = "message")]
pub enum AppError {
    /// File system or I/O error.
    #[error("IO error: {0}")]
    Io(String),
    /// JSON (de)serialization error.
    #[error("Serialization error: {0}")]
    Serialization(String),
    /// Path resolution error (e.g. app data dir not found).
    #[error("Path error: {0}")]
    Path(String),
    /// Input validation error.
    #[error("Validation error: {0}")]
    Validation(String),
    /// Resource not found.
    #[error("Not found: {0}")]
    NotFound(String),
    /// Task join error from `spawn_blocking`.
    #[error("Task join error: {0}")]
    TaskJoin(String),
    /// Tray icon operation error.
    #[error("Tray error: {0}")]
    Tray(String),
    /// Quick pane operation error.
    #[error("Quick pane error: {0}")]
    QuickPane(String),
    /// Notification error.
    #[error("Notification error: {0}")]
    Notification(String),
    /// Window operation error.
    #[error("Window error: {0}")]
    Window(String),
}

impl From<std::io::Error> for AppError {
    fn from(e: std::io::Error) -> Self {
        AppError::Io(e.to_string())
    }
}

impl From<serde_json::Error> for AppError {
    fn from(e: serde_json::Error) -> Self {
        AppError::Serialization(e.to_string())
    }
}

impl AppError {
    pub fn io(msg: impl Into<String>) -> Self {
        AppError::Io(msg.into())
    }

    pub fn serialization(msg: impl Into<String>) -> Self {
        AppError::Serialization(msg.into())
    }

    pub fn path(msg: impl Into<String>) -> Self {
        AppError::Path(msg.into())
    }

    pub fn validation(msg: impl Into<String>) -> Self {
        AppError::Validation(msg.into())
    }

    pub fn not_found(msg: impl Into<String>) -> Self {
        AppError::NotFound(msg.into())
    }

    pub fn task_join(msg: impl Into<String>) -> Self {
        AppError::TaskJoin(msg.into())
    }

    pub fn tray(msg: impl Into<String>) -> Self {
        AppError::Tray(msg.into())
    }

    pub fn quick_pane(msg: impl Into<String>) -> Self {
        AppError::QuickPane(msg.into())
    }

    pub fn notification(msg: impl Into<String>) -> Self {
        AppError::Notification(msg.into())
    }

    pub fn window(msg: impl Into<String>) -> Self {
        AppError::Window(msg.into())
    }

    /// Returns a stable error code string for programmatic error handling.
    ///
    /// These codes are mirrored in `src/lib/error-codes.ts` and must stay
    /// in sync. The frontend uses these codes to switch on error type
    /// without parsing human-readable messages.
    pub fn error_code(&self) -> &'static str {
        match self {
            AppError::Io(_) => "ERR_IO",
            AppError::Serialization(_) => "ERR_SERIALIZATION",
            AppError::Path(_) => "ERR_PATH",
            AppError::Validation(_) => "ERR_VALIDATION",
            AppError::NotFound(_) => "ERR_NOT_FOUND",
            AppError::TaskJoin(_) => "ERR_TASK_JOIN",
            AppError::Tray(_) => "ERR_TRAY",
            AppError::QuickPane(_) => "ERR_QUICK_PANE",
            AppError::Notification(_) => "ERR_NOTIFICATION",
            AppError::Window(_) => "ERR_WINDOW",
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    // =========================================================================
    // Display trait — 正向用例
    // =========================================================================

    #[test]
    fn display_io_shows_prefix() {
        let err = AppError::Io("disk full".into());
        assert_eq!(format!("{err}"), "IO error: disk full");
    }

    #[test]
    fn display_serialization_shows_prefix() {
        let err = AppError::Serialization("bad json".into());
        assert_eq!(format!("{err}"), "Serialization error: bad json");
    }

    #[test]
    fn display_path_shows_prefix() {
        let err = AppError::Path("not found".into());
        assert_eq!(format!("{err}"), "Path error: not found");
    }

    #[test]
    fn display_validation_shows_prefix() {
        let err = AppError::Validation("too long".into());
        assert_eq!(format!("{err}"), "Validation error: too long");
    }

    #[test]
    fn display_not_found_shows_prefix() {
        let err = AppError::NotFound("missing".into());
        assert_eq!(format!("{err}"), "Not found: missing");
    }

    #[test]
    fn display_task_join_shows_prefix() {
        let err = AppError::TaskJoin("panic".into());
        assert_eq!(format!("{err}"), "Task join error: panic");
    }

    #[test]
    fn display_tray_shows_prefix() {
        let err = AppError::Tray("icon failed".into());
        assert_eq!(format!("{err}"), "Tray error: icon failed");
    }

    #[test]
    fn display_quick_pane_shows_prefix() {
        let err = AppError::QuickPane("no window".into());
        assert_eq!(format!("{err}"), "Quick pane error: no window");
    }

    #[test]
    fn display_notification_shows_prefix() {
        let err = AppError::Notification("denied".into());
        assert_eq!(format!("{err}"), "Notification error: denied");
    }

    #[test]
    fn display_window_shows_prefix() {
        let err = AppError::Window("closed".into());
        assert_eq!(format!("{err}"), "Window error: closed");
    }

    // =========================================================================
    // From<std::io::Error> — 正向/异常用例
    // =========================================================================

    #[test]
    fn from_io_error_maps_to_io_variant() {
        let io_err = std::io::Error::new(std::io::ErrorKind::NotFound, "file missing");
        let app_err = AppError::from(io_err);
        assert!(matches!(app_err, AppError::Io(_)));
        assert!(app_err.to_string().contains("file missing"));
    }

    #[test]
    fn from_io_error_preserves_message() {
        let io_err = std::io::Error::new(std::io::ErrorKind::PermissionDenied, "access denied");
        let app_err = AppError::from(io_err);
        assert!(app_err.to_string().contains("access denied"));
    }

    // =========================================================================
    // From<serde_json::Error> — 正向/异常用例
    // =========================================================================

    #[test]
    fn from_serde_json_error_maps_to_serialization_variant() {
        let json_err = serde_json::from_str::<String>("not a string").unwrap_err();
        let app_err = AppError::from(json_err);
        assert!(matches!(app_err, AppError::Serialization(_)));
    }

    #[test]
    fn from_serde_json_error_preserves_message() {
        let json_err = serde_json::from_str::<serde_json::Value>("{bad}").unwrap_err();
        let app_err = AppError::from(json_err);
        assert!(!app_err.to_string().is_empty());
    }

    // =========================================================================
    // 构造函数 — 正向用例
    // =========================================================================

    #[test]
    fn constructor_io_creates_correct_variant() {
        let err = AppError::io("read failed");
        assert!(matches!(err, AppError::Io(s) if s == "read failed"));
    }

    #[test]
    fn constructor_serialization_creates_correct_variant() {
        let err = AppError::serialization("parse failed");
        assert!(matches!(err, AppError::Serialization(s) if s == "parse failed"));
    }

    #[test]
    fn constructor_path_creates_correct_variant() {
        let err = AppError::path("dir missing");
        assert!(matches!(err, AppError::Path(s) if s == "dir missing"));
    }

    #[test]
    fn constructor_validation_creates_correct_variant() {
        let err = AppError::validation("invalid input");
        assert!(matches!(err, AppError::Validation(s) if s == "invalid input"));
    }

    #[test]
    fn constructor_not_found_creates_correct_variant() {
        let err = AppError::not_found("resource");
        assert!(matches!(err, AppError::NotFound(s) if s == "resource"));
    }

    #[test]
    fn constructor_task_join_creates_correct_variant() {
        let err = AppError::task_join("cancelled");
        assert!(matches!(err, AppError::TaskJoin(s) if s == "cancelled"));
    }

    #[test]
    fn constructor_tray_creates_correct_variant() {
        let err = AppError::tray("init failed");
        assert!(matches!(err, AppError::Tray(s) if s == "init failed"));
    }

    #[test]
    fn constructor_quick_pane_creates_correct_variant() {
        let err = AppError::quick_pane("no window");
        assert!(matches!(err, AppError::QuickPane(s) if s == "no window"));
    }

    #[test]
    fn constructor_notification_creates_correct_variant() {
        let err = AppError::notification("unsupported");
        assert!(matches!(err, AppError::Notification(s) if s == "unsupported"));
    }

    #[test]
    fn constructor_window_creates_correct_variant() {
        let err = AppError::window("destroyed");
        assert!(matches!(err, AppError::Window(s) if s == "destroyed"));
    }

    // =========================================================================
    // 构造函数 — 边界用例
    // =========================================================================

    #[test]
    fn constructor_accepts_string_literal() {
        let err = AppError::io("literal");
        assert!(err.to_string().contains("literal"));
    }

    #[test]
    fn constructor_accepts_owned_string() {
        let msg = String::from("owned");
        let err = AppError::io(msg);
        assert!(err.to_string().contains("owned"));
    }

    #[test]
    fn constructor_accepts_empty_string() {
        let err = AppError::io("");
        assert!(matches!(err, AppError::Io(s) if s.is_empty()));
    }

    // =========================================================================
    // Serialize — 正向用例
    // =========================================================================

    #[test]
    fn serialize_produces_tagged_json() {
        let err = AppError::Validation("bad input".into());
        let json = serde_json::to_string(&err).unwrap();
        assert!(json.contains("\"kind\":\"Validation\""));
        assert!(json.contains("\"message\":\"bad input\""));
    }

    #[test]
    fn serialize_all_variants_have_kind_tag() {
        let cases = [
            (AppError::Io("x".into()), "Io"),
            (AppError::Serialization("x".into()), "Serialization"),
            (AppError::Path("x".into()), "Path"),
            (AppError::Validation("x".into()), "Validation"),
            (AppError::NotFound("x".into()), "NotFound"),
            (AppError::TaskJoin("x".into()), "TaskJoin"),
            (AppError::Tray("x".into()), "Tray"),
            (AppError::QuickPane("x".into()), "QuickPane"),
            (AppError::Notification("x".into()), "Notification"),
            (AppError::Window("x".into()), "Window"),
        ];
        for (err, expected_kind) in cases {
            let json = serde_json::to_string(&err).unwrap();
            assert!(
                json.contains(&format!("\"kind\":\"{expected_kind}\"")),
                "Serialized JSON missing kind tag for {expected_kind}: {json}"
            );
        }
    }

    // =========================================================================
    // Clone — 正向用例
    // =========================================================================

    #[test]
    fn clone_produces_equal_error() {
        let err = AppError::Io("test".into());
        let cloned = err.clone();
        assert_eq!(err.to_string(), cloned.to_string());
    }

    // =========================================================================
    // error_code — 正向用例
    // =========================================================================

    #[test]
    fn error_code_io_returns_stable_code() {
        let err = AppError::Io("test".into());
        assert_eq!(err.error_code(), "ERR_IO");
    }

    #[test]
    fn error_code_serialization_returns_stable_code() {
        let err = AppError::Serialization("test".into());
        assert_eq!(err.error_code(), "ERR_SERIALIZATION");
    }

    #[test]
    fn error_code_path_returns_stable_code() {
        let err = AppError::Path("test".into());
        assert_eq!(err.error_code(), "ERR_PATH");
    }

    #[test]
    fn error_code_validation_returns_stable_code() {
        let err = AppError::Validation("test".into());
        assert_eq!(err.error_code(), "ERR_VALIDATION");
    }

    #[test]
    fn error_code_not_found_returns_stable_code() {
        let err = AppError::NotFound("test".into());
        assert_eq!(err.error_code(), "ERR_NOT_FOUND");
    }

    #[test]
    fn error_code_task_join_returns_stable_code() {
        let err = AppError::TaskJoin("test".into());
        assert_eq!(err.error_code(), "ERR_TASK_JOIN");
    }

    #[test]
    fn error_code_tray_returns_stable_code() {
        let err = AppError::Tray("test".into());
        assert_eq!(err.error_code(), "ERR_TRAY");
    }

    #[test]
    fn error_code_quick_pane_returns_stable_code() {
        let err = AppError::QuickPane("test".into());
        assert_eq!(err.error_code(), "ERR_QUICK_PANE");
    }

    #[test]
    fn error_code_notification_returns_stable_code() {
        let err = AppError::Notification("test".into());
        assert_eq!(err.error_code(), "ERR_NOTIFICATION");
    }

    #[test]
    fn error_code_window_returns_stable_code() {
        let err = AppError::Window("test".into());
        assert_eq!(err.error_code(), "ERR_WINDOW");
    }

    // =========================================================================
    // error_code — 边界用例
    // =========================================================================

    #[test]
    fn error_code_is_stable_across_different_messages() {
        let err1 = AppError::Io("message1".into());
        let err2 = AppError::Io("message2".into());
        assert_eq!(err1.error_code(), err2.error_code());
    }

    #[test]
    fn error_code_differs_across_variants() {
        let io_err = AppError::Io("test".into());
        let validation_err = AppError::Validation("test".into());
        assert_ne!(io_err.error_code(), validation_err.error_code());
    }

    #[test]
    fn error_code_all_variants_unique() {
        let codes = [
            AppError::Io("x".into()).error_code(),
            AppError::Serialization("x".into()).error_code(),
            AppError::Path("x".into()).error_code(),
            AppError::Validation("x".into()).error_code(),
            AppError::NotFound("x".into()).error_code(),
            AppError::TaskJoin("x".into()).error_code(),
            AppError::Tray("x".into()).error_code(),
            AppError::QuickPane("x".into()).error_code(),
            AppError::Notification("x".into()).error_code(),
            AppError::Window("x".into()).error_code(),
        ];
        let unique: std::collections::HashSet<&str> = codes.iter().copied().collect();
        assert_eq!(codes.len(), unique.len(), "Duplicate error codes found");
    }
}
