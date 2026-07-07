//! Native notification commands.
//!
//! Provides cross-platform native notification support using the Tauri notification plugin.

use tauri::AppHandle;

use crate::error::AppError;

/// Sends a native system notification.
/// On mobile platforms, returns an error as notifications are not yet supported.
#[tauri::command]
#[specta::specta]
pub async fn send_native_notification(
    app: AppHandle,
    title: String,
    body: Option<String>,
) -> Result<(), AppError> {
    // Validate inputs
    if title.is_empty() {
        return Err(AppError::validation("Notification title cannot be empty"));
    }
    if title.chars().count() > 200 {
        return Err(AppError::validation(
            "Notification title too long (max 200 characters)",
        ));
    }
    if let Some(b) = &body
        && b.chars().count() > 500
    {
        return Err(AppError::validation(
            "Notification body too long (max 500 characters)",
        ));
    }

    log::info!("Sending native notification: {title}");

    #[cfg(not(mobile))]
    {
        use tauri_plugin_notification::NotificationExt;

        let mut notification = app.notification().builder().title(title);

        if let Some(body_text) = body {
            notification = notification.body(body_text);
        }

        match notification.show() {
            Ok(_) => {
                log::info!("Native notification sent successfully");
                Ok(())
            }
            Err(e) => {
                log::error!("Failed to send native notification: {e}");
                Err(AppError::notification(format!(
                    "Failed to send notification: {e}"
                )))
            }
        }
    }

    #[cfg(mobile)]
    {
        let _ = (app, body);
        log::warn!("Native notifications not supported on mobile");
        Err(AppError::notification(
            "Native notifications not supported on mobile".to_string(),
        ))
    }
}
