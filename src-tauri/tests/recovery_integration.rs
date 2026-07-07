//! Integration tests for recovery Tauri commands.
//!
//! These tests exercise two layers:
//!
//! 1. **AppHandle-based tests** — verify path resolution and validation via
//!    `mock_builder()` (MockRuntime). Only validation-error and missing-file
//!    tests use AppHandle, since they fail before any file I/O occurs.
//!
//! 2. **`_to_path` / `_from_path` / `_in_dir` + TempDir write tests** —
//!    exercise the pure file I/O helpers with isolated `tempfile::TempDir`
//!    directories. This avoids the intermittent write failures on
//!    `AppData\Roaming\` that occur when the mock app's empty identifier
//!    causes all files to be written to the shared Roaming root.

use serde_json::json;
use tauri_app_lib::commands::recovery::{
    cleanup_old_recovery_files_impl, cleanup_old_recovery_files_in_dir,
    load_emergency_data_from_path, load_emergency_data_impl, save_emergency_data_impl,
    save_emergency_data_to_path,
};
use tauri_app_lib::types::RecoveryError;
use tempfile::TempDir;

/// Creates a mock Tauri app and returns its handle for testing.
fn mock_app_handle() -> tauri::AppHandle<tauri::test::MockRuntime> {
    let app = tauri::test::mock_builder()
        .build(tauri::test::mock_context(tauri::test::noop_assets()))
        .expect("failed to build mock app");
    app.handle().clone()
}

// =========================================================================
// save_emergency_data_impl (AppHandle) — 异常用例 (validation, no write)
// =========================================================================

#[tokio::test]
async fn save_emergency_data_rejects_empty_filename() {
    let handle = mock_app_handle();
    let data = json!({"ok": true}).to_string();
    let result = save_emergency_data_impl(handle, "".to_string(), data).await;
    assert!(matches!(result, Err(RecoveryError::ValidationError { .. })));
}

#[tokio::test]
async fn save_emergency_data_rejects_filename_too_long() {
    let handle = mock_app_handle();
    let filename = "a".repeat(101);
    let data = json!({"ok": true}).to_string();
    let result = save_emergency_data_impl(handle, filename, data).await;
    assert!(matches!(result, Err(RecoveryError::ValidationError { .. })));
}

#[tokio::test]
async fn save_emergency_data_rejects_filename_with_spaces() {
    let handle = mock_app_handle();
    let data = json!({"ok": true}).to_string();
    let result = save_emergency_data_impl(handle, "my file".to_string(), data).await;
    assert!(matches!(result, Err(RecoveryError::ValidationError { .. })));
}

#[tokio::test]
async fn save_emergency_data_rejects_filename_with_path_separator() {
    let handle = mock_app_handle();
    let data = json!({"ok": true}).to_string();
    let result = save_emergency_data_impl(handle, "dir/file".to_string(), data).await;
    assert!(matches!(result, Err(RecoveryError::ValidationError { .. })));
}

#[tokio::test]
async fn save_emergency_data_rejects_filename_with_dot_prefix() {
    let handle = mock_app_handle();
    let data = json!({"ok": true}).to_string();
    let result = save_emergency_data_impl(handle, ".hidden".to_string(), data).await;
    assert!(matches!(result, Err(RecoveryError::ValidationError { .. })));
}

#[tokio::test]
async fn save_emergency_data_rejects_invalid_json() {
    let handle = mock_app_handle();
    let result = save_emergency_data_impl(handle, "bad".to_string(), "not json".to_string()).await;
    assert!(matches!(result, Err(RecoveryError::ParseError { .. })));
}

#[tokio::test]
async fn save_emergency_data_rejects_empty_json_string() {
    let handle = mock_app_handle();
    let result = save_emergency_data_impl(handle, "empty".to_string(), "".to_string()).await;
    assert!(result.is_err());
}

// =========================================================================
// load_emergency_data_impl (AppHandle) — 异常用例 (validation, no file)
// =========================================================================

#[tokio::test]
async fn load_emergency_data_returns_error_for_missing_file() {
    let handle = mock_app_handle();
    let result = load_emergency_data_impl(handle, "nonexistent".to_string()).await;
    assert!(matches!(result, Err(RecoveryError::FileNotFound)));
}

#[tokio::test]
async fn load_emergency_data_rejects_empty_filename() {
    let handle = mock_app_handle();
    let result = load_emergency_data_impl(handle, "".to_string()).await;
    assert!(matches!(result, Err(RecoveryError::ValidationError { .. })));
}

#[tokio::test]
async fn load_emergency_data_rejects_filename_too_long() {
    let handle = mock_app_handle();
    let filename = "a".repeat(101);
    let result = load_emergency_data_impl(handle, filename).await;
    assert!(matches!(result, Err(RecoveryError::ValidationError { .. })));
}

#[tokio::test]
async fn load_emergency_data_rejects_filename_with_special_chars() {
    let handle = mock_app_handle();
    let result = load_emergency_data_impl(handle, "file!@#".to_string()).await;
    assert!(matches!(result, Err(RecoveryError::ValidationError { .. })));
}

// =========================================================================
// cleanup_old_recovery_files_impl (AppHandle) — 正向用例 (read-only)
// =========================================================================

#[tokio::test]
async fn cleanup_returns_zero_when_no_files() {
    let handle = mock_app_handle();
    let result = cleanup_old_recovery_files_impl(handle).await;
    assert!(result.is_ok());
    assert_eq!(result.unwrap(), 0);
}

// =========================================================================
// save/load_emergency_data_to_path (TempDir) — 正向用例
// =========================================================================

#[test]
fn save_and_load_roundtrip_with_object() {
    let dir = TempDir::new().unwrap();
    let data = json!({"key": "value", "number": 42});

    save_emergency_data_to_path(dir.path(), "test_save", &data).unwrap();
    let loaded = load_emergency_data_from_path(dir.path(), "test_save").unwrap();

    assert_eq!(loaded, data);
}

#[test]
fn save_and_load_roundtrip_with_string() {
    let dir = TempDir::new().unwrap();
    let data = json!("hello world");

    save_emergency_data_to_path(dir.path(), "string_data", &data).unwrap();
    let loaded = load_emergency_data_from_path(dir.path(), "string_data").unwrap();

    assert_eq!(loaded, data);
}

#[test]
fn save_and_load_roundtrip_with_array() {
    let dir = TempDir::new().unwrap();
    let data = json!([1, 2, 3]);

    save_emergency_data_to_path(dir.path(), "array_data", &data).unwrap();
    let loaded = load_emergency_data_from_path(dir.path(), "array_data").unwrap();

    assert_eq!(loaded, data);
}

#[test]
fn save_and_load_roundtrip_with_null() {
    let dir = TempDir::new().unwrap();
    let data = json!(null);

    save_emergency_data_to_path(dir.path(), "null_data", &data).unwrap();
    let loaded = load_emergency_data_from_path(dir.path(), "null_data").unwrap();

    assert_eq!(loaded, data);
}

#[test]
fn save_and_load_roundtrip_with_boolean() {
    let dir = TempDir::new().unwrap();
    let data = json!(true);

    save_emergency_data_to_path(dir.path(), "bool_data", &data).unwrap();
    let loaded = load_emergency_data_from_path(dir.path(), "bool_data").unwrap();

    assert_eq!(loaded, data);
}

#[test]
fn save_and_load_roundtrip_with_nested_object() {
    let dir = TempDir::new().unwrap();
    let data = json!({
        "user": {"name": "Alice", "age": 30},
        "items": [{"id": 1}, {"id": 2}],
        "meta": {"tags": ["a", "b"]}
    });

    save_emergency_data_to_path(dir.path(), "nested", &data).unwrap();
    let loaded = load_emergency_data_from_path(dir.path(), "nested").unwrap();

    assert_eq!(loaded, data);
}

// =========================================================================
// save_emergency_data_to_path — 边界用例
// =========================================================================

#[test]
fn save_with_dashed_filename() {
    let dir = TempDir::new().unwrap();
    let data = json!({"ok": true});

    save_emergency_data_to_path(dir.path(), "my-backup", &data).unwrap();
    assert_eq!(
        load_emergency_data_from_path(dir.path(), "my-backup").unwrap(),
        data
    );
}

#[test]
fn save_with_underscore_filename() {
    let dir = TempDir::new().unwrap();
    let data = json!({"ok": true});

    save_emergency_data_to_path(dir.path(), "my_backup", &data).unwrap();
    assert_eq!(
        load_emergency_data_from_path(dir.path(), "my_backup").unwrap(),
        data
    );
}

#[test]
fn save_with_numeric_filename() {
    let dir = TempDir::new().unwrap();
    let data = json!({"ok": true});

    save_emergency_data_to_path(dir.path(), "12345", &data).unwrap();
    assert_eq!(
        load_emergency_data_from_path(dir.path(), "12345").unwrap(),
        data
    );
}

#[test]
fn save_overwrites_existing_file() {
    let dir = TempDir::new().unwrap();

    let data1 = json!({"version": 1});
    save_emergency_data_to_path(dir.path(), "overwrite", &data1).unwrap();

    let data2 = json!({"version": 2});
    save_emergency_data_to_path(dir.path(), "overwrite", &data2).unwrap();

    let loaded = load_emergency_data_from_path(dir.path(), "overwrite").unwrap();
    assert_eq!(loaded["version"], 2);
}

// =========================================================================
// save/load — 异常用例
// =========================================================================

#[test]
fn save_rejects_empty_filename() {
    let dir = TempDir::new().unwrap();
    let data = json!({"ok": true});
    let result = save_emergency_data_to_path(dir.path(), "", &data);
    assert!(matches!(result, Err(RecoveryError::ValidationError { .. })));
}

#[test]
fn save_rejects_filename_too_long() {
    let dir = TempDir::new().unwrap();
    let filename = "a".repeat(101);
    let data = json!({"ok": true});
    let result = save_emergency_data_to_path(dir.path(), &filename, &data);
    assert!(matches!(result, Err(RecoveryError::ValidationError { .. })));
}

#[test]
fn save_rejects_filename_with_spaces() {
    let dir = TempDir::new().unwrap();
    let data = json!({"ok": true});
    let result = save_emergency_data_to_path(dir.path(), "my file", &data);
    assert!(matches!(result, Err(RecoveryError::ValidationError { .. })));
}

#[test]
fn save_rejects_filename_with_path_separator() {
    let dir = TempDir::new().unwrap();
    let data = json!({"ok": true});
    let result = save_emergency_data_to_path(dir.path(), "dir/file", &data);
    assert!(matches!(result, Err(RecoveryError::ValidationError { .. })));
}

#[test]
fn save_rejects_filename_with_dot_prefix() {
    let dir = TempDir::new().unwrap();
    let data = json!({"ok": true});
    let result = save_emergency_data_to_path(dir.path(), ".hidden", &data);
    assert!(matches!(result, Err(RecoveryError::ValidationError { .. })));
}

#[test]
fn load_returns_file_not_found_for_missing_file() {
    let dir = TempDir::new().unwrap();
    let result = load_emergency_data_from_path(dir.path(), "nonexistent");
    assert!(matches!(result, Err(RecoveryError::FileNotFound)));
}

#[test]
fn load_rejects_empty_filename() {
    let dir = TempDir::new().unwrap();
    let result = load_emergency_data_from_path(dir.path(), "");
    assert!(matches!(result, Err(RecoveryError::ValidationError { .. })));
}

#[test]
fn load_rejects_filename_too_long() {
    let dir = TempDir::new().unwrap();
    let filename = "a".repeat(101);
    let result = load_emergency_data_from_path(dir.path(), &filename);
    assert!(matches!(result, Err(RecoveryError::ValidationError { .. })));
}

#[test]
fn load_fails_on_corrupted_json() {
    let dir = TempDir::new().unwrap();
    std::fs::write(dir.path().join("corrupt.json"), "{ not valid json").unwrap();

    let result = load_emergency_data_from_path(dir.path(), "corrupt");
    assert!(matches!(result, Err(RecoveryError::ParseError { .. })));
}

// =========================================================================
// cleanup_old_recovery_files_in_dir (TempDir) — 正向用例
// =========================================================================

#[test]
fn cleanup_returns_zero_for_empty_dir() {
    let dir = TempDir::new().unwrap();
    let result = cleanup_old_recovery_files_in_dir(dir.path()).unwrap();
    assert_eq!(result, 0);
}

#[test]
fn cleanup_returns_zero_for_recent_files() {
    let dir = TempDir::new().unwrap();
    let data = json!({"x": 1});

    save_emergency_data_to_path(dir.path(), "recent", &data).unwrap();

    let removed = cleanup_old_recovery_files_in_dir(dir.path()).unwrap();
    assert_eq!(removed, 0);
}

// =========================================================================
// save → load → cleanup 综合 (TempDir)
// =========================================================================

#[test]
fn full_lifecycle_save_load_multiple_files() {
    let dir = TempDir::new().unwrap();

    let files = [
        ("doc1", json!({"type": "doc", "id": 1})),
        ("doc2", json!({"type": "doc", "id": 2})),
        ("doc3", json!({"type": "doc", "id": 3})),
    ];

    for (name, data) in &files {
        save_emergency_data_to_path(dir.path(), name, data).unwrap();
    }

    for (name, expected) in &files {
        let loaded = load_emergency_data_from_path(dir.path(), name).unwrap();
        assert_eq!(loaded, *expected);
    }

    let removed = cleanup_old_recovery_files_in_dir(dir.path()).unwrap();
    assert_eq!(removed, 0);

    for (name, expected) in &files {
        let loaded = load_emergency_data_from_path(dir.path(), name).unwrap();
        assert_eq!(loaded, *expected);
    }
}
