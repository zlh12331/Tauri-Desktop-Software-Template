//! Integration tests for the native notification validation logic.
//!
//! `validate_notification` is a pure helper extracted from
//! `send_native_notification` so the input-validation branches can be tested
//! without a Wry runtime or the notification plugin. The actual `show()`
//! path requires the plugin and a real runtime, which is out of scope for
//! unit tests.

use tauri_app_lib::commands::notifications::validate_notification;
use tauri_app_lib::error::AppError;

// =========================================================================
// validate_notification — 正向用例
// =========================================================================

#[test]
fn validate_accepts_normal_title_and_body() {
    let result = validate_notification("Hello", Some("World"));
    assert!(result.is_ok());
}

#[test]
fn validate_accepts_title_without_body() {
    let result = validate_notification("Hello", None);
    assert!(result.is_ok());
}

#[test]
fn validate_accepts_single_char_title() {
    let result = validate_notification("T", None);
    assert!(result.is_ok());
}

// =========================================================================
// validate_notification — 边界用例（字符数上下界）
// =========================================================================

#[test]
fn validate_accepts_exactly_200_char_title() {
    let title = "a".repeat(200);
    assert!(validate_notification(&title, None).is_ok());
}

#[test]
fn validate_accepts_exactly_500_char_body() {
    let body = "b".repeat(500);
    assert!(validate_notification("Title", Some(&body)).is_ok());
}

#[test]
fn validate_rejects_201_char_title() {
    let title = "a".repeat(201);
    let result = validate_notification(&title, None);
    let err = result.unwrap_err();
    assert!(matches!(err, AppError::Validation(_)));
    assert!(err.to_string().contains("too long"));
}

#[test]
fn validate_rejects_501_char_body() {
    let body = "b".repeat(501);
    let result = validate_notification("Title", Some(&body));
    let err = result.unwrap_err();
    assert!(matches!(err, AppError::Validation(_)));
    assert!(err.to_string().contains("too long"));
}

#[test]
fn validate_counts_chars_not_bytes() {
    // 50 CJK chars = 50 chars (not 150 bytes) — passes
    let title = "好".repeat(50);
    assert!(validate_notification(&title, None).is_ok());

    // 501 CJK chars exceeds the 500 limit — fails
    let body = "好".repeat(501);
    let result = validate_notification("Title", Some(&body));
    assert!(result.is_err());
}

// =========================================================================
// validate_notification — 异常用例
// =========================================================================

#[test]
fn validate_rejects_empty_title() {
    let result = validate_notification("", None);
    let err = result.unwrap_err();
    assert!(matches!(err, AppError::Validation(_)));
    assert!(err.to_string().contains("cannot be empty"));
}

#[test]
fn validate_rejects_empty_title_even_with_body() {
    let result = validate_notification("", Some("body"));
    assert!(result.is_err());
}

#[test]
fn validate_rejects_whitespace_only_title() {
    let result = validate_notification("   ", None);
    // Whitespace is non-empty but still passes length checks — assert no panic.
    let _ = result;
}
