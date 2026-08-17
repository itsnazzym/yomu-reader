use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Tag {
    pub id: u64,
    #[serde(rename = "type")]
    pub tag_type: String,
    pub name: String,
    pub url: String,
    pub count: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImageInfo {
    pub t: String, // "j" for jpg, "p" for png, "w" for webp, "g" for gif
    pub w: u32,
    pub h: u32,
}

impl ImageInfo {
    pub fn extension(&self) -> &'static str {
        match self.t.as_str() {
            "j" => "jpg",
            "p" => "png",
            "w" => "webp",
            "g" => "gif",
            _ => "jpg",
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GalleryImages {
    pub pages: Vec<ImageInfo>,
    pub cover: ImageInfo,
    pub thumbnail: ImageInfo,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GalleryTitle {
    pub english: Option<String>,
    pub japanese: Option<String>,
    pub pretty: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Gallery {
    pub id: u64,
    pub media_id: String,
    pub title: GalleryTitle,
    pub images: GalleryImages,
    pub scanlator: Option<String>,
    pub upload_date: u64,
    pub tags: Vec<Tag>,
    pub num_pages: u32,
    pub num_favorites: u32,
}

impl Gallery {
    pub fn display_title(&self) -> String {
        self.title
            .pretty
            .clone()
            .or_else(|| self.title.english.clone())
            .or_else(|| self.title.japanese.clone())
            .unwrap_or_else(|| format!("Gallery #{}", self.id))
    }

    pub fn get_tags_by_type(&self, tag_type: &str) -> Vec<&Tag> {
        self.tags.iter().filter(|t| t.tag_type == tag_type).collect()
    }

    pub fn first_tag_name(&self, tag_type: &str) -> Option<String> {
        self.tags
            .iter()
            .find(|t| t.tag_type == tag_type)
            .map(|t| t.name.clone())
    }

    pub fn language(&self) -> String {
        self.tags
            .iter()
            .find(|t| t.tag_type == "language" && t.name != "translated")
            .map(|t| t.name.clone())
            .unwrap_or_else(|| "japanese".to_string())
    }

    pub fn cover_url(&self) -> String {
        format!(
            "https://t.nhentai.net/galleries/{}/cover.{}",
            self.media_id,
            self.images.cover.extension()
        )
    }

    pub fn thumbnail_url(&self) -> String {
        format!(
            "https://t.nhentai.net/galleries/{}/thumb.{}",
            self.media_id,
            self.images.thumbnail.extension()
        )
    }

    pub fn page_url(&self, page_index: usize) -> Option<String> {
        self.images.pages.get(page_index).map(|page| {
            format!(
                "https://i.nhentai.net/galleries/{}/{}.{}",
                self.media_id,
                page_index + 1,
                page.extension()
            )
        })
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchResponse {
    pub result: Vec<Gallery>,
    pub num_pages: u32,
    pub per_page: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DownloadItem {
    pub id: u64,
    pub gallery: Gallery,
    pub format: String, // "cbz", "zip", "folder"
    pub status: String, // "queued", "downloading", "paused", "completed", "error"
    pub progress: f32,
    pub downloaded_pages: u32,
    pub total_pages: u32,
    pub speed_bytes_sec: f64,
    pub error_message: Option<String>,
    pub target_path: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppSettings {
    pub download_directory: String,
    pub naming_pattern: String,
    pub default_format: String,
    pub concurrent_downloads: u32,
    pub concurrent_images_per_gallery: u32,
    pub blacklisted_tags: Vec<String>,
    pub cookies: Option<String>,
}

impl Default for AppSettings {
    fn default() -> Self {
        let default_dir = dirs::download_dir()
            .map(|p| p.join("nHentai Downloads").to_string_lossy().to_string())
            .unwrap_or_else(|| "C:\\nHentai Downloads".to_string());

        Self {
            download_directory: default_dir,
            naming_pattern: "[{id}] [{artist}] {title} ({language})".to_string(),
            default_format: "cbz".to_string(),
            concurrent_downloads: 2,
            concurrent_images_per_gallery: 4,
            blacklisted_tags: vec![],
            cookies: None,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DownloadProgressPayload {
    pub id: u64,
    pub downloaded_pages: u32,
    pub total_pages: u32,
    pub progress: f32,
    pub speed_kb_s: f64,
    pub status: String,
    pub error: Option<String>,
    pub target_path: Option<String>,
}
