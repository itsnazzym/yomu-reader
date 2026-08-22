use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use tokio::sync::Mutex;
use tauri::{AppHandle, Manager, State, WebviewUrl, WebviewWindowBuilder};

use crate::api::NhClient;
use crate::downloader::{download_gallery, format_filename};
use crate::models::{AppSettings, Gallery, SearchResponse};

pub struct AppState {
    pub cancel_tokens: Arc<Mutex<HashMap<u64, Arc<AtomicBool>>>>,
}

impl AppState {
    pub fn new() -> Self {
        Self {
            cancel_tokens: Arc::new(Mutex::new(HashMap::new())),
        }
    }
}

#[tauri::command]
pub async fn search_galleries(
    query: String,
    sort: String,
    page: u32,
    cookies: Option<String>,
) -> Result<SearchResponse, String> {
    let client = NhClient::new(cookies);
    client.search(&query, &sort, page).await
}

#[tauri::command]
pub async fn get_gallery(
    id: u64,
    cookies: Option<String>,
) -> Result<Gallery, String> {
    let client = NhClient::new(cookies);
    client.get_gallery_by_id(id).await
}

#[tauri::command]
pub async fn get_default_settings() -> Result<AppSettings, String> {
    Ok(AppSettings::default())
}

#[tauri::command]
pub fn format_filename_preview(pattern: String, gallery: Gallery) -> String {
    format_filename(&pattern, &gallery)
}

#[tauri::command]
pub async fn start_download(
    app: AppHandle,
    state: State<'_, AppState>,
    gallery: Gallery,
    format_type: String,
    pattern: String,
    dest_dir: String,
    cookies: Option<String>,
) -> Result<String, String> {
    let gallery_id = gallery.id;
    let cancel_flag = Arc::new(AtomicBool::new(false));

    {
        let mut tokens = state.cancel_tokens.lock().await;
        tokens.insert(gallery_id, cancel_flag.clone());
    }

    let client = Arc::new(NhClient::new(cookies));
    let destination = PathBuf::from(&dest_dir);

    let result = download_gallery(
        app,
        client,
        gallery,
        format_type,
        pattern,
        destination,
        cancel_flag,
    )
    .await;

    {
        let mut tokens = state.cancel_tokens.lock().await;
        tokens.remove(&gallery_id);
    }

    result
}

#[tauri::command]
pub async fn cancel_download(
    state: State<'_, AppState>,
    gallery_id: u64,
) -> Result<(), String> {
    let tokens = state.cancel_tokens.lock().await;
    if let Some(token) = tokens.get(&gallery_id) {
        token.store(true, Ordering::Relaxed);
    }
    Ok(())
}

#[tauri::command]
pub fn open_folder(path: String) -> Result<(), String> {
    let p = Path::new(&path);
    let target_dir = if p.is_file() {
        p.parent().unwrap_or(p)
    } else {
        p
    };

    #[cfg(target_os = "windows")]
    {
        Command::new("explorer")
            .arg(target_dir)
            .spawn()
            .map_err(|e| format!("Impossible d'ouvrir l'explorateur: {}", e))?;
    }

    #[cfg(target_os = "macos")]
    {
        Command::new("open")
            .arg(target_dir)
            .spawn()
            .map_err(|e| format!("Impossible d'ouvrir le Finder: {}", e))?;
    }

    #[cfg(target_os = "linux")]
    {
        Command::new("xdg-open")
            .arg(target_dir)
            .spawn()
            .map_err(|e| format!("Impossible d'ouvrir le gestionnaire de fichiers: {}", e))?;
    }

    Ok(())
}

#[tauri::command]
pub async fn open_auth_window(app: AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("auth-window") {
        let _ = window.set_focus();
        return Ok(());
    }

    let url = WebviewUrl::External("https://nhentai.net/login/".parse().map_err(|e| format!("{}", e))?);
    let _window = WebviewWindowBuilder::new(&app, "auth-window", url)
        .title("Connexion nHentai (Cloudflare)")
        .inner_size(800.0, 700.0)
        .center()
        .build()
        .map_err(|e| format!("Impossible d'ouvrir la fenêtre de connexion: {}", e))?;

    Ok(())
}
