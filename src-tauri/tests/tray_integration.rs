//! Integration tests for tray types and the position mapping helper.
//!
//! `handle_menu_event` / `handle_tray_event` are private and require real
//! menu/tray SDK objects or a Wry runtime, so they are covered by the
//! crate-internal unit tests instead.

use tauri_app_lib::commands::tray::{TrayIconState, TrayPosition};

// =========================================================================
// 枚举 — 集成层序列化（跨 crate 可见性验证）
// =========================================================================

#[test]
fn tray_enum_types_are_usable_from_outside_crate() {
    let state = TrayIconState::Normal;
    let pos = TrayPosition::BottomRight;
    assert_ne!(state, TrayIconState::Notification);
    assert_ne!(pos, TrayPosition::TopLeft);
}

#[test]
fn tray_icon_state_serializes_to_variant_string() {
    let json = serde_json::to_string(&TrayIconState::Notification).unwrap();
    assert_eq!(json, r#""Notification""#);
}

#[test]
fn tray_position_serializes_to_variant_string() {
    let json = serde_json::to_string(&TrayPosition::TopLeft).unwrap();
    assert_eq!(json, r#""TopLeft""#);
}

// =========================================================================
// map_tray_position — 正向用例（公开纯函数）
// =========================================================================

#[test]
fn map_tray_position_returns_corresponding_plugin_position() {
    use tauri_app_lib::commands::tray::map_tray_position;

    // Position has no PartialEq; assert via discriminant match.
    let pos = map_tray_position(TrayPosition::TopLeft);
    assert!(matches!(pos, tauri_plugin_positioner::Position::TopLeft));
}
