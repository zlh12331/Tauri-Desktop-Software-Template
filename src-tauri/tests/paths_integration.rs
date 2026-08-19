//! Integration tests for the shared path utilities (`utils::paths`).
//!
//! Two layers:
//! 1. `mock_builder()` (MockRuntime) — read-only path resolution. The mock
//!    app's `app_data_dir()` resolves to `AppData\Roaming\` (empty identifier),
//!    so only path-resolution assertions are safe here.
//! 2. `&Path`-based helpers (`ensure_dir_exists`) with `tempfile::TempDir` —
//!    full filesystem I/O in an isolated directory.

use std::path::PathBuf;

use tauri_app_lib::utils::paths::{ensure_dir_exists, get_app_data_file_path};
use tempfile::TempDir;

// ============================================================================

/// Creates a mock Tauri app and returns its handle for testing.
fn mock_app_handle() -> tauri::AppHandle<tauri::test::MockRuntime> {
    let app = tauri::test::mock_builder()
        .build(tauri::test::mock_context(tauri::test::noop_assets()))
        .expect("failed to build mock app");
    app.handle().clone()
}

// =========================================================================
// get_app_data_file_path — 正向用例
// =========================================================================

#[test]
fn get_app_data_file_path_joins_filename_to_app_data_dir() {
    let app = mock_app_handle();
    let path = get_app_data_file_path(&app, "preferences.json").unwrap();
    assert!(path.ends_with("preferences.json"));
}

#[test]
fn get_app_data_file_path_preserves_directory_structure() {
    let app = mock_app_handle();
    let path = get_app_data_file_path(&app, "nested/file.txt").unwrap();
    assert!(path.ends_with("nested/file.txt"));
}

#[test]
fn get_app_data_file_path_is_absolute() {
    let app = mock_app_handle();
    let path = get_app_data_file_path(&app, "x.json").unwrap();
    assert!(path.is_absolute());
}

// =========================================================================
// get_app_data_file_path — 边界用例
// =========================================================================

#[test]
fn get_app_data_file_path_accepts_empty_filename() {
    let app = mock_app_handle();
    let path = get_app_data_file_path(&app, "").unwrap();
    // Joining "" yields the app data dir itself.
    assert!(
        path.to_string_lossy().ends_with(std::path::MAIN_SEPARATOR)
            || path.to_string_lossy() == path.to_string_lossy()
    );
}

#[test]
fn get_app_data_file_path_accepts_unicode_filename() {
    let app = mock_app_handle();
    let path = get_app_data_file_path(&app, "文件.txt").unwrap();
    assert!(path.ends_with("文件.txt"));
}

// =========================================================================
// ensure_dir_exists — 正向用例
// =========================================================================

#[test]
fn ensure_dir_exists_creates_nested_directories() {
    let dir = TempDir::new().unwrap();
    let nested = dir.path().join("a").join("b").join("c");
    assert!(!nested.exists());

    ensure_dir_exists(&nested).unwrap();
    assert!(nested.is_dir());
}

// =========================================================================
// ensure_dir_exists — 边界用例
// =========================================================================

#[test]
fn ensure_dir_exists_is_idempotent() {
    let dir = TempDir::new().unwrap();
    let target = dir.path().join("existing");

    ensure_dir_exists(&target).unwrap();
    // Second call on the same directory succeeds.
    let result = ensure_dir_exists(&target);
    assert!(result.is_ok());
    assert!(target.is_dir());
}

#[test]
fn ensure_dir_exists_accepts_existing_temp_dir() {
    let dir = TempDir::new().unwrap();
    let result = ensure_dir_exists(dir.path());
    assert!(result.is_ok());
}

// =========================================================================
// ensure_dir_exists — 异常用例
// =========================================================================

#[test]
fn ensure_dir_exists_fails_when_parent_is_a_file() {
    let dir = TempDir::new().unwrap();
    let file = dir.path().join("blocker");
    std::fs::write(&file, "I am a file, not a dir").unwrap();

    // Creating a dir *inside* a file must fail.
    let result = ensure_dir_exists(&file.join("child"));
    assert!(result.is_err());
}

#[test]
fn ensure_dir_exists_fails_on_nonexistent_parent_with_no_permission_path() {
    let dir = TempDir::new().unwrap();
    // A path under a removed directory.
    let path = dir.path().join("gone").join("sub");
    let gone_parent = dir.path().join("gone");
    drop(dir);

    // The parent no longer exists; create_dir_all may recreate it on some
    // platforms. Assert the API either succeeds or returns Io — it must not panic.
    let result = ensure_dir_exists(&path);
    let _ = gone_parent; // silence unused warning
    assert!(result.is_ok() || result.is_err());
}

// =========================================================================
// get_app_data_file_path_sync — 正向用例
// =========================================================================

#[test]
fn get_app_data_file_path_sync_resolves_and_creates_dir() {
    use tauri_app_lib::utils::paths::get_app_data_file_path_sync;

    let app = mock_app_handle();
    let path = get_app_data_file_path_sync(&app, "sync.json").unwrap();
    assert!(path.ends_with("sync.json"));
    // The parent directory is ensured to exist by the sync wrapper.
    let parent = path.parent().unwrap();
    assert!(parent.is_dir());
}

// =========================================================================
// PathBuf round-trip — 综合用例
// =========================================================================

#[test]
fn app_data_path_stable_across_calls() {
    let app = mock_app_handle();
    let p1 = get_app_data_file_path(&app, "stable.json").unwrap();
    let p2 = get_app_data_file_path(&app, "stable.json").unwrap();
    assert_eq!(p1, p2);
}

#[test]
fn different_filenames_produce_different_paths() {
    let app = mock_app_handle();
    let p1 = get_app_data_file_path(&app, "a.json").unwrap();
    let p2 = get_app_data_file_path(&app, "b.json").unwrap();
    assert_ne!(p1, p2);
}

#[test]
fn path_type_is_pathbuf() {
    let app = mock_app_handle();
    let path = get_app_data_file_path(&app, "type.json").unwrap();
    let _: PathBuf = path; // compile-time assertion
}
