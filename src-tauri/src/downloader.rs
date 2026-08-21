use std::fs::{self, File};
use std::io::Write;
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::Instant;
use tauri::{AppHandle, Emitter};
use zip::write::{SimpleFileOptions, ZipWriter};
use zip::CompressionMethod;
use crate::api::NhClient;
use crate::models::{Gallery, DownloadProgressPayload};

const MAX_IMAGE_BYTES: usize = 25 * 1024 * 1024;

pub fn sanitize_filename(name: &str) -> String {
    let forbidden_chars = ['<', '>', ':', '"', '/', '\\', '|', '?', '*'];
    let mut clean: String = name
        .chars()
        .map(|c| if forbidden_chars.contains(&c) || c.is_control() { '_' } else { c })
        .collect();
    
    // Trim spaces and trailing dots
    clean = clean.trim().trim_end_matches('.').to_string();
    if clean.is_empty() {
        clean = "untitled".to_string();
    }
    // Limit length for Windows path safety
    if clean.len() > 180 {
        clean.truncate(180);
    }
    clean
}

pub fn format_filename(pattern: &str, gallery: &Gallery) -> String {
    let id_str = gallery.id.to_string();
    let title_str = sanitize_filename(&gallery.display_title());
    let artist_str = sanitize_filename(
        &gallery.first_tag_name("artist").unwrap_or_else(|| "Unknown".to_string())
    );
    let group_str = sanitize_filename(
        &gallery.first_tag_name("group").unwrap_or_else(|| "Original".to_string())
    );
    let parody_str = sanitize_filename(
        &gallery.first_tag_name("parody").unwrap_or_else(|| "Original".to_string())
    );
    let character_str = sanitize_filename(
        &gallery.first_tag_name("character").unwrap_or_else(|| "Original".to_string())
    );
    let language_str = sanitize_filename(&gallery.language());
    let pages_str = gallery.num_pages.to_string();
    let category_str = sanitize_filename(
        &gallery.first_tag_name("category").unwrap_or_else(|| "doujinshi".to_string())
    );

    let mut result = pattern.to_string();
    result = result.replace("{id}", &id_str);
    result = result.replace("{title}", &title_str);
    result = result.replace("{artist}", &artist_str);
    result = result.replace("{group}", &group_str);
    result = result.replace("{parody}", &parody_str);
    result = result.replace("{character}", &character_str);
    result = result.replace("{language}", &language_str);
    result = result.replace("{pages}", &pages_str);
    result = result.replace("{category}", &category_str);

    sanitize_filename(&result)
}

pub fn generate_comic_info_xml(gallery: &Gallery) -> String {
    let artist = gallery.first_tag_name("artist").unwrap_or_default();
    let group = gallery.first_tag_name("group").unwrap_or_default();
    let parody = gallery.first_tag_name("parody").unwrap_or_default();
    let tags: Vec<String> = gallery.tags.iter().map(|t| t.name.clone()).collect();
    let tags_str = tags.join(", ");
    let lang = gallery.language();

    format!(
r#"<?xml version="1.0" encoding="utf-8"?>
<ComicInfo xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema">
  <Title>{}</Title>
  <Series>{}</Series>
  <Number>{}</Number>
  <Summary>Source: https://nhentai.net/g/{}/</Summary>
  <Writer>{}</Writer>
  <Penciller>{}</Penciller>
  <Genre>{}</Genre>
  <Tags>{}</Tags>
  <PageCount>{}</PageCount>
  <LanguageISO>{}</LanguageISO>
  <Web>https://nhentai.net/g/{}/</Web>
  <Manga>YesAndRightToLeft</Manga>
</ComicInfo>"#,
        quick_xml_escape(&gallery.display_title()),
        quick_xml_escape(&parody),
        gallery.id,
        gallery.id,
        quick_xml_escape(&group),
        quick_xml_escape(&artist),
        quick_xml_escape(&gallery.first_tag_name("category").unwrap_or_else(|| "Doujinshi".to_string())),
        quick_xml_escape(&tags_str),
        gallery.num_pages,
        quick_xml_escape(&lang),
        gallery.id
    )
}

fn quick_xml_escape(raw: &str) -> String {
    raw.replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
        .replace('\'', "&apos;")
}

struct TempDownloadDir(PathBuf);

impl Drop for TempDownloadDir {
    fn drop(&mut self) {
        let _ = fs::remove_dir_all(&self.0);
    }
}

fn append_page_files(
    zip: &mut ZipWriter<File>,
    files: &[(usize, String, PathBuf)],
    options: SimpleFileOptions,
) -> Result<(), String> {
    for (page_num, ext, path) in files {
        let filename = format!("{:03}.{}", page_num, ext);
        zip.start_file(&filename, options)
            .map_err(|e| format!("Erreur ajout fichier zip: {}", e))?;
        let data = fs::read(path)
            .map_err(|e| format!("Impossible de relire la page {}: {}", filename, e))?;
        zip.write_all(&data)
            .map_err(|e| format!("Erreur écriture zip: {}", e))?;
    }
    Ok(())
}

pub async fn download_gallery(
    app: AppHandle,
    client: Arc<NhClient>,
    gallery: Gallery,
    format_type: String, // "cbz", "zip", "folder"
    pattern: String,
    dest_dir: PathBuf,
    is_cancelled: Arc<AtomicBool>,
) -> Result<String, String> {
    let base_name = format_filename(&pattern, &gallery);
    let total_pages = gallery.num_pages;
    let gallery_id = gallery.id;

    if !dest_dir.exists() {
        fs::create_dir_all(&dest_dir)
            .map_err(|e| format!("Impossible de créer le dossier de destination: {}", e))?;
    }

    let tmp = TempDownloadDir(dest_dir.join(format!(".nh-partial-{}", gallery_id)));
    fs::create_dir_all(&tmp.0)
        .map_err(|e| format!("Impossible de créer le dossier temporaire: {}", e))?;

    let start_time = Instant::now();
    let mut downloaded_bytes: usize = 0;
    let mut downloaded_files: Vec<(usize, String, PathBuf)> = Vec::new();

    let _ = app.emit("download-progress", DownloadProgressPayload {
        id: gallery_id,
        downloaded_pages: 0,
        total_pages,
        progress: 0.0,
        speed_kb_s: 0.0,
        status: "downloading".to_string(),
        error: None,
        target_path: None,
    });

    for page_idx in 0..gallery.images.pages.len() {
        if is_cancelled.load(Ordering::Relaxed) {
            let _ = app.emit("download-progress", DownloadProgressPayload {
                id: gallery_id,
                downloaded_pages: page_idx as u32,
                total_pages,
                progress: (page_idx as f32) / (total_pages as f32),
                speed_kb_s: 0.0,
                status: "cancelled".to_string(),
                error: Some("Téléchargement annulé.".to_string()),
                target_path: None,
            });
            return Err("Téléchargement annulé par l'utilisateur.".to_string());
        }

        let page_info = &gallery.images.pages[page_idx];
        let ext = page_info.extension();
        let page_num = page_idx + 1;
        let image_url = format!(
            "https://i.nhentai.net/galleries/{}/{}.{}",
            gallery.media_id, page_num, ext
        );

        let img_bytes = client.download_image(&image_url).await?;
        if img_bytes.len() > MAX_IMAGE_BYTES {
            return Err(format!("Image trop volumineuse ({} octets)", img_bytes.len()));
        }
        downloaded_bytes += img_bytes.len();
        let page_path = tmp.0.join(format!("{:03}.{}", page_num, ext));
        fs::write(&page_path, &img_bytes)
            .map_err(|e| format!("Impossible d'écrire la page temporaire: {}", e))?;
        downloaded_files.push((page_num, ext.to_string(), page_path));
        drop(img_bytes);

        let elapsed = start_time.elapsed().as_secs_f64().max(0.1);
        let speed_kb_s = (downloaded_bytes as f64 / 1024.0) / elapsed;
        let progress = (page_num as f32) / (total_pages as f32);

        let _ = app.emit("download-progress", DownloadProgressPayload {
            id: gallery_id,
            downloaded_pages: page_num as u32,
            total_pages,
            progress,
            speed_kb_s,
            status: "downloading".to_string(),
            error: None,
            target_path: None,
        });

        tokio::time::sleep(std::time::Duration::from_millis(60)).await;
    }

    let output_path: PathBuf = match format_type.as_str() {
        "zip" => {
            let zip_path = dest_dir.join(format!("{}.zip", base_name));
            let file = File::create(&zip_path)
                .map_err(|e| format!("Impossible de créer l'archive zip: {}", e))?;
            let mut zip = ZipWriter::new(file);
            let options = SimpleFileOptions::default()
                .compression_method(CompressionMethod::Deflated);
            append_page_files(&mut zip, &downloaded_files, options)?;
            zip.finish().map_err(|e| format!("Erreur fermeture zip: {}", e))?;
            zip_path
        }
        "folder" => {
            let folder_path = dest_dir.join(&base_name);
            fs::create_dir_all(&folder_path)
                .map_err(|e| format!("Impossible de créer le dossier: {}", e))?;

            for (page_num, ext, path) in &downloaded_files {
                let file_path = folder_path.join(format!("{:03}.{}", page_num, ext));
                fs::copy(path, &file_path)
                    .map_err(|e| format!("Impossible d'écrire l'image: {}", e))?;
            }
            folder_path
        }
        _ => {
            let cbz_path = dest_dir.join(format!("{}.cbz", base_name));
            let file = File::create(&cbz_path)
                .map_err(|e| format!("Impossible de créer le fichier CBZ: {}", e))?;
            let mut zip = ZipWriter::new(file);
            let options = SimpleFileOptions::default()
                .compression_method(CompressionMethod::Deflated);

            let comic_info = generate_comic_info_xml(&gallery);
            zip.start_file("ComicInfo.xml", options)
                .map_err(|e| format!("Erreur ajout ComicInfo.xml: {}", e))?;
            zip.write_all(comic_info.as_bytes())
                .map_err(|e| format!("Erreur écriture ComicInfo.xml: {}", e))?;

            append_page_files(&mut zip, &downloaded_files, options)?;
            zip.finish().map_err(|e| format!("Erreur finalisation CBZ: {}", e))?;
            cbz_path
        }
    };

    let target_path_str = output_path.to_string_lossy().to_string();

    let _ = app.emit("download-progress", DownloadProgressPayload {
        id: gallery_id,
        downloaded_pages: total_pages,
        total_pages,
        progress: 1.0,
        speed_kb_s: 0.0,
        status: "completed".to_string(),
        error: None,
        target_path: Some(target_path_str.clone()),
    });

    Ok(target_path_str)
}
