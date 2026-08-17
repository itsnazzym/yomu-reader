pub mod api;
pub mod commands;
pub mod downloader;
pub mod models;

use commands::*;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .manage(commands::AppState::new())
        .invoke_handler(tauri::generate_handler![
            search_galleries,
            get_gallery,
            get_default_settings,
            format_filename_preview,
            start_download,
            cancel_download,
            open_folder,
            open_auth_window
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
