//! Tauri build script.
//!
//! Performs three tasks:
//!
//! 1. **Tauri build** — `tauri_build::try_build()` with
//!    `WindowsAttributes::new_without_app_manifest()` handles Tauri-specific
//!    resource generation (icons, capabilities, version info) for the
//!    application binary. We disable tauri-build's own manifest embedding
//!    to avoid duplicate manifest resources (see step 2).
//!
//! 2. **Windows manifest** — `embed_resource::compile_for_everything()` embeds
//!    a Common-Controls v6 manifest into ALL targets via
//!    `cargo:rustc-link-arg` (applies to binaries, test binaries, etc.).
//!
//!    This fixes `cargo test` on Windows: tauri-build internally uses
//!    `embed_resource::compile()` which outputs `cargo:rustc-link-arg-bins`
//!    (binary targets only). Test binaries get no manifest and crash with
//!    STATUS_ENTRYPOINT_NOT_FOUND (0xc0000139) because comctl32.dll v5 lacks
//!    entry points that Tauri/WebView2 dependencies expect.
//!
//!    By disabling tauri-build's manifest and embedding our own via
//!    `compile_for_everything()`, all targets get the manifest without
//!    duplicate resource conflicts.
//!
//! 3. **Sentry DSN** — Reads the frontend `.env` file to extract
//!    `VITE_SENTRY_DSN` and sets it as a compile-time environment variable
//!    (`SENTRY_DSN`) via `cargo:rustc-env`. The Rust `sentry` crate consumes
//!    it in `lib.rs` through `option_env!("SENTRY_DSN")` at compile time.
//!    This keeps DSN configuration in a single place (`.env`) for both the
//!    frontend (`@sentry/react`) and the Rust backend (`sentry` crate).

use std::fs;
use std::path::PathBuf;

fn main() {
    // 1. Tauri build — compile resources WITHOUT a manifest (we embed our own
    //    in step 2 to cover all targets, including test binaries).
    tauri_build::try_build(
        tauri_build::Attributes::new()
            .windows_attributes(tauri_build::WindowsAttributes::new_without_app_manifest()),
    )
    .expect("failed to run tauri-build");

    // 2. Embed Windows manifest (Common-Controls v6) into ALL targets.
    //    compile_for_everything() outputs cargo:rustc-link-arg, which applies
    //    to binaries, test binaries, benches, and examples.
    //    On non-Windows platforms this is a no-op (returns NotWindows).
    #[cfg(target_os = "windows")]
    embed_resource::compile_for_everything("app-manifest.rc", embed_resource::NONE)
        .manifest_required()
        .unwrap();

    // 3. Read .env for Sentry DSN configuration.
    let env_path = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .expect("src-tauri should have a parent directory")
        .join(".env");

    if !env_path.exists() {
        println!(
            "cargo:warning=No .env file found at {}, Sentry DSN not configured",
            env_path.display()
        );
        return;
    }

    // Rebuild when .env changes — Cargo only watches package-internal files
    // by default; .env lives in the parent directory and would otherwise be
    // ignored, causing stale DSN values after edits.
    println!("cargo:rerun-if-changed={}", env_path.display());

    let content = match fs::read_to_string(&env_path) {
        Ok(c) => c,
        Err(e) => {
            println!("cargo:warning=Failed to read .env file: {e}");
            return;
        }
    };

    // Parse simple KEY=VALUE format (ignoring comments and empty lines)
    for line in content.lines() {
        let line = line.trim();

        // Skip comments and empty lines
        if line.is_empty() || line.starts_with('#') {
            continue;
        }

        // Find the KEY=VALUE separator
        if let Some((key, value)) = line.split_once('=') {
            let key = key.trim();
            let value = value.trim();
            // Remove surrounding quotes if present (e.g. KEY="value" → value)
            let value = value
                .strip_prefix('"')
                .and_then(|v| v.strip_suffix('"'))
                .or_else(|| value.strip_prefix('\'').and_then(|v| v.strip_suffix('\'')))
                .unwrap_or(value);

            // Map VITE_SENTRY_DSN → SENTRY_DSN for the Rust sentry crate
            if key == "VITE_SENTRY_DSN" && !value.is_empty() {
                // Set as compile-time env var — consumed in lib.rs via
                // `option_env!("SENTRY_DSN")` (NOT runtime env::var).
                println!("cargo:rustc-env=SENTRY_DSN={value}");
                println!("cargo:warning=Sentry DSN configured from .env file");
                return;
            }
        }
    }

    println!("cargo:warning=Sentry DSN not found in .env — crash reporting disabled");
}
