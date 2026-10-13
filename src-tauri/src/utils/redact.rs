//! Sensitive data redaction for logs and error messages.
//!
//! Inspired by the codex-main `RedactingMakeWriter` pattern: before any log
//! line or error message is persisted or transmitted, values associated with
//! sensitive keys are replaced with `***`. This prevents accidental leakage
//! of API keys, tokens, passwords, and other credentials through log files
//! or Sentry events.
//!
//! The redaction is pattern-based and operates on the formatted output. It
//! matches key-value pairs in common formats:
//! - `api_key=abc123`
//! - `"api_key": "abc123"`
//! - `Authorization: Bearer xyz`

use regex::Regex;
use std::sync::LazyLock;

/// Pattern that matches sensitive key-value pairs.
///
/// Captures the key name, optional closing quote, separator, and optional
/// opening quote in one group. The value portion is replaced with `***`.
///
/// Handles:
/// - Query strings: `api_key=abc123`
/// - JSON: `"api_key": "abc123"`
/// - Headers: `Authorization: Bearer abc123` (Bearer pattern captured fully)
/// - Logs: `token: xyz`
static SENSITIVE_VALUE_PATTERN: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(
        r#"(?i)((?:access[_-]?token|refresh[_-]?token|api[_-]?key|authorization|password|secret|cookie|token)"?\s*[:=]\s*"?)(?:Bearer\s+\S+|[^",}\s\]]+)"#,
    )
    .expect("Failed to compile sensitive data redaction regex")
});

/// Keys whose entire value should be replaced with `***` when found in
/// structured data (e.g. JSON objects, HTTP headers).
static SENSITIVE_KEY_NAMES: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"(?i)^(?:access[_-]?token|refresh[_-]?token|api[_-]?key|authorization|password|secret|cookie|token)$")
        .expect("Failed to compile sensitive key name regex")
});

/// Replaces sensitive values in a string with `***`.
///
/// # Examples
///
/// ```
/// # use tauri_app_lib::utils::redact::redact_sensitive;
/// assert_eq!(redact_sensitive("api_key=abc123"), "api_key=***");
/// assert_eq!(
///     redact_sensitive(r#""token": "xyz""#),
///     r#""token": "***""#
/// );
/// ```
pub fn redact_sensitive(input: &str) -> String {
    SENSITIVE_VALUE_PATTERN
        .replace_all(input, "${1}***")
        .to_string()
}

/// Returns `true` if the key name is considered sensitive.
pub fn is_sensitive_key(key: &str) -> bool {
    SENSITIVE_KEY_NAMES.is_match(key)
}

/// Renders one line in the layout `tauri-plugin-log` uses by default on desktop:
/// `<timestamp>[<target>][<level>] <message>`, with the message redacted.
///
/// The plugin offers no hook that post-processes the default layout, so redacting
/// log output means replacing its formatter — and a replaced formatter must
/// reproduce the layout or every log file silently changes shape. Kept as a pure
/// function so the two halves (layout fidelity and redaction) can be tested
/// without a running app.
pub fn render_log_line(timestamp: &str, target: &str, level: &str, message: &str) -> String {
    format!(
        "{timestamp}[{target}][{level}] {}",
        redact_sensitive(message)
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    // =========================================================================
    // render_log_line — layout fidelity + redaction in one line
    // =========================================================================

    #[test]
    fn renders_the_plugin_default_layout() {
        assert_eq!(
            render_log_line("2026-10-13T10:00:00Z", "tauri-app", "INFO", "started"),
            "2026-10-13T10:00:00Z[tauri-app][INFO] started"
        );
    }

    #[test]
    fn redacts_the_message_inside_the_line() {
        let line = render_log_line("TS", "tauri-app", "WARN", "login failed api_key=abc123");
        assert_eq!(line, "TS[tauri-app][WARN] login failed api_key=***");
        assert!(!line.contains("abc123"));
    }

    #[test]
    fn redacts_every_occurrence_in_one_line() {
        let line = render_log_line("TS", "http", "ERROR", "token=AAA and secret=BBB sent");
        assert_eq!(line, "TS[http][ERROR] token=*** and secret=*** sent");
    }

    #[test]
    fn leaves_a_clean_message_untouched() {
        assert_eq!(
            render_log_line("TS", "tauri-app", "DEBUG", "window focused"),
            "TS[tauri-app][DEBUG] window focused"
        );
    }

    #[test]
    fn only_the_message_is_redacted_not_the_metadata() {
        // Documents the scope: a key-looking target or level is not rewritten,
        // so a target named `token` survives. Redaction guards what callers log,
        // not what the logging framework labels.
        let line = render_log_line("TS", "token", "INFO", "hello");
        assert_eq!(line, "TS[token][INFO] hello");
    }

    #[test]
    fn timestamp_keeps_the_plugin_default_shape() {
        // The formatter in `lib.rs` restates tauri-plugin-log's own desktop
        // timestamp description instead of trusting `OffsetDateTime`'s Display.
        // This is the test that says why: Display yields
        // "2026-10-13 5:18:16.014407 +00:00" — spaces, no brackets, no zero
        // padding — which would have changed the shape of every log file.
        let format =
            time::macros::format_description!("[[[year]-[month]-[day]][[[hour]:[minute]:[second]]");
        let rendered = tauri_plugin_log::TimezoneStrategy::UseUtc
            .get_now()
            .format(&format)
            .expect("static format description must apply");
        assert_eq!(rendered.len(), 22, "unexpected timestamp: {rendered}");
        assert!(
            rendered.starts_with('['),
            "unexpected timestamp: {rendered}"
        );
        assert_eq!(rendered.matches(']').count(), 2, "{rendered}");
        assert!(!rendered.contains(' '), "{rendered}");
    }

    // =========================================================================
    // redact_sensitive — 正向用例
    // =========================================================================

    #[test]
    fn redact_replaces_api_key_value() {
        let result = redact_sensitive("api_key=abc123");
        assert!(result.contains("***"));
        assert!(!result.contains("abc123"));
    }

    #[test]
    fn redact_replaces_token_value() {
        let result = redact_sensitive("token=secret_token_value");
        assert!(result.contains("***"));
        assert!(!result.contains("secret_token_value"));
    }

    #[test]
    fn redact_replaces_authorization_header() {
        let result = redact_sensitive("Authorization: Bearer abc123");
        assert!(result.contains("***"));
        assert!(!result.contains("abc123"));
    }

    #[test]
    fn redact_replaces_password_in_json() {
        let input = r#"{"password": "mypassword"}"#;
        let result = redact_sensitive(input);
        assert!(result.contains("***"));
        assert!(!result.contains("mypassword"));
    }

    #[test]
    fn redact_replaces_access_token() {
        let result = redact_sensitive("access_token=eyJhbGciOi");
        assert!(result.contains("***"));
        assert!(!result.contains("eyJhbGciOi"));
    }

    #[test]
    fn redact_replaces_refresh_token() {
        let result = redact_sensitive("refresh_token=xyz789");
        assert!(result.contains("***"));
        assert!(!result.contains("xyz789"));
    }

    #[test]
    fn redact_replaces_secret_value() {
        let result = redact_sensitive("secret=my_super_secret");
        assert!(result.contains("***"));
        assert!(!result.contains("my_super_secret"));
    }

    #[test]
    fn redact_replaces_cookie_value() {
        let result = redact_sensitive("cookie=session_id_abc");
        assert!(result.contains("***"));
        assert!(!result.contains("session_id_abc"));
    }

    #[test]
    fn redact_preserves_key_name() {
        let result = redact_sensitive("api_key=abc123");
        assert!(result.contains("api_key"));
    }

    #[test]
    fn redact_preserves_separator() {
        let result = redact_sensitive("api_key=abc123");
        assert!(result.contains("api_key="));
    }

    #[test]
    fn redact_handles_multiple_sensitive_fields() {
        let input = "api_key=abc token=xyz password=secret";
        let result = redact_sensitive(input);
        assert!(result.contains("api_key=***"));
        assert!(result.contains("token=***"));
        assert!(result.contains("password=***"));
        assert!(!result.contains("abc"));
        assert!(!result.contains("xyz"));
        assert!(!result.contains("secret"));
    }

    #[test]
    fn redact_handles_quoted_json_values() {
        let input = r#""api_key": "my_secret_key""#;
        let result = redact_sensitive(input);
        assert!(result.contains("***"));
        assert!(!result.contains("my_secret_key"));
    }

    #[test]
    fn redact_is_case_insensitive() {
        let result = redact_sensitive("API_KEY=abc123");
        assert!(result.contains("***"));
        assert!(!result.contains("abc123"));
    }

    // =========================================================================
    // redact_sensitive — 边界用例
    // =========================================================================

    #[test]
    fn redact_does_not_modify_non_sensitive_text() {
        let input = "user_id=12345 session=active";
        let result = redact_sensitive(input);
        assert_eq!(result, input);
    }

    #[test]
    fn redact_handles_empty_string() {
        assert_eq!(redact_sensitive(""), "");
    }

    #[test]
    fn redact_preserves_non_sensitive_parts() {
        let input = "user=john api_key=secret123 action=login";
        let result = redact_sensitive(input);
        assert!(result.contains("user=john"));
        assert!(result.contains("action=login"));
        assert!(result.contains("api_key=***"));
    }

    #[test]
    fn redact_does_not_match_partial_key_names() {
        // "mytoken" should not trigger redaction because "token" is a
        // substring — but actually it will match because the regex is
        // not anchored. This is acceptable: being over-cautious is safer
        // than leaking sensitive data. We test the behavior here to
        // document it.
        let result = redact_sensitive("mytoken=abc123");
        // The regex matches "token=abc123" within "mytoken=abc123"
        assert!(result.contains("***"));
    }

    #[test]
    fn redact_handles_key_without_value() {
        let input = "api_key";
        let result = redact_sensitive(input);
        assert_eq!(result, input);
    }

    // =========================================================================
    // is_sensitive_key — 正向用例
    // =========================================================================

    #[test]
    fn is_sensitive_key_recognizes_api_key() {
        assert!(is_sensitive_key("api_key"));
    }

    #[test]
    fn is_sensitive_key_recognizes_token() {
        assert!(is_sensitive_key("token"));
    }

    #[test]
    fn is_sensitive_key_recognizes_password() {
        assert!(is_sensitive_key("password"));
    }

    #[test]
    fn is_sensitive_key_recognizes_authorization() {
        assert!(is_sensitive_key("authorization"));
    }

    #[test]
    fn is_sensitive_key_recognizes_access_token() {
        assert!(is_sensitive_key("access_token"));
    }

    #[test]
    fn is_sensitive_key_recognizes_refresh_token() {
        assert!(is_sensitive_key("refresh_token"));
    }

    #[test]
    fn is_sensitive_key_recognizes_secret() {
        assert!(is_sensitive_key("secret"));
    }

    #[test]
    fn is_sensitive_key_recognizes_cookie() {
        assert!(is_sensitive_key("cookie"));
    }

    // =========================================================================
    // is_sensitive_key — 边界用例
    // =========================================================================

    #[test]
    fn is_sensitive_key_rejects_non_sensitive_keys() {
        assert!(!is_sensitive_key("user_id"));
        assert!(!is_sensitive_key("session"));
        assert!(!is_sensitive_key("name"));
    }

    #[test]
    fn is_sensitive_key_is_case_insensitive() {
        assert!(is_sensitive_key("API_KEY"));
        assert!(is_sensitive_key("Token"));
        assert!(is_sensitive_key("PASSWORD"));
    }

    #[test]
    fn is_sensitive_key_rejects_partial_matches() {
        // "my_api_key" is not exactly "api_key"
        assert!(!is_sensitive_key("my_api_key"));
        // "api_key_extra" is not exactly "api_key"
        assert!(!is_sensitive_key("api_key_extra"));
    }

    #[test]
    fn is_sensitive_key_rejects_empty_string() {
        assert!(!is_sensitive_key(""));
    }
}
