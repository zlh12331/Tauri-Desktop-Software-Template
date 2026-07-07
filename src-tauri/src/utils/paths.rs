//! Shared path utilities for app data directory access.
//!
//! Provides helpers for resolving file paths within the app data directory.
//! Directory creation is separated from path resolution so that async callers
//! can move the blocking `create_dir_all` syscall into `spawn_blocking`.

use std::path::PathBuf;

use tauri::{AppHandle, Manager, Runtime};

use crate::error::AppError;

/// Resolves the path to a file in the app data directory **without** creating
/// the directory.
///
/// This is safe to call from async context — it only reads the path from the
/// Tauri `Manager`, performing no filesystem I/O. Callers that need to write
/// files should call [`ensure_dir_exists`] inside a `spawn_blocking` closure.
///
/// # Arguments
///
/// * `app` - The Tauri application handle
/// * `filename` - The name of the file within the app data directory
///
/// # Errors
///
/// Returns an `AppError` if the app data directory path cannot be resolved.
pub fn get_app_data_file_path<R: Runtime>(
    app: &AppHandle<R>,
    filename: &str,
) -> Result<PathBuf, AppError> {
    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| AppError::path(format!("Failed to get app data directory: {e}")))?;

    Ok(app_data_dir.join(filename))
}

/// Ensures a directory exists, creating it if necessary.
///
/// This is a blocking filesystem operation — callers in async context should
/// invoke it inside `spawn_blocking`.
///
/// # Errors
///
/// Returns an `AppError` if the directory cannot be created.
pub fn ensure_dir_exists(dir: &std::path::Path) -> Result<(), AppError> {
    std::fs::create_dir_all(dir)
        .map_err(|e| AppError::io(format!("Failed to create directory: {e}")))
}

/// Resolves the path to a file in the app data directory and ensures the
/// directory exists.
///
/// ** Convenience wrapper** for synchronous callers. Async Tauri commands
/// should use [`get_app_data_file_path`] + [`ensure_dir_exists`] separately,
/// with the latter inside `spawn_blocking`.
///
/// # Errors
///
/// Returns an `AppError` if the app data directory cannot be resolved
/// or created.
pub fn get_app_data_file_path_sync<R: Runtime>(
    app: &AppHandle<R>,
    filename: &str,
) -> Result<PathBuf, AppError> {
    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| AppError::path(format!("Failed to get app data directory: {e}")))?;

    ensure_dir_exists(&app_data_dir)?;

    Ok(app_data_dir.join(filename))
}
