use reqwest::header::{HeaderMap, HeaderValue, USER_AGENT, COOKIE, ACCEPT, ACCEPT_LANGUAGE};
use std::time::Duration;
use crate::models::{Gallery, SearchResponse};

const DEFAULT_USER_AGENT: &str = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36";

pub struct NhClient {
    client: reqwest::Client,
    cookies: Option<String>,
}

impl NhClient {
    pub fn new(cookies: Option<String>) -> Self {
        let mut headers = HeaderMap::new();
        headers.insert(
            USER_AGENT,
            HeaderValue::from_static(DEFAULT_USER_AGENT),
        );
        headers.insert(
            ACCEPT,
            HeaderValue::from_static("application/json, text/html, */*"),
        );
        headers.insert(
            ACCEPT_LANGUAGE,
            HeaderValue::from_static("en-US,en;q=0.9,ja;q=0.8,fr;q=0.7"),
        );

        if let Some(ref c) = cookies {
            if let Ok(val) = HeaderValue::from_str(c) {
                headers.insert(COOKIE, val);
            }
        }

        let client = reqwest::Client::builder()
            .default_headers(headers)
            .timeout(Duration::from_secs(30))
            .build()
            .unwrap_or_else(|_| reqwest::Client::new());

        Self { client, cookies }
    }

    pub async fn search(
        &self,
        query: &str,
        sort: &str,
        page: u32,
    ) -> Result<SearchResponse, String> {
        let clean_query = query.trim();
        let url = if clean_query.is_empty() {
            format!("https://nhentai.net/api/galleries/all?page={}", page.max(1))
        } else {
            let sort_param = match sort {
                "popular-today" => "&sort=popular-today",
                "popular-week" => "&sort=popular-week",
                "popular" | "popular-all" => "&sort=popular",
                _ => "", // default is recent/date
            };
            format!(
                "https://nhentai.net/api/galleries/search?query={}&page={}{}",
                urlencoding::encode(clean_query),
                page.max(1),
                sort_param
            )
        };

        let response = self
            .client
            .get(&url)
            .send()
            .await
            .map_err(|e| format!("Erreur de connexion à nhentai: {}", e))?;

        if response.status() == 403 || response.status() == 503 {
            return Err("Protection Cloudflare active (403/503). Veuillez vous connecter ou actualiser la session dans les paramètres.".to_string());
        }

        if !response.status().is_success() {
            return Err(format!("Erreur HTTP {}", response.status()));
        }

        let text = response
            .text()
            .await
            .map_err(|e| format!("Erreur lors de la lecture du résultat: {}", e))?;

        serde_json::from_str::<SearchResponse>(&text).map_err(|e| {
            if text.contains("<title>Just a moment...</title>") || text.contains("cf-browser-verification") {
                "Cloudflare Challenge détecté. Veuillez ouvrir la fenêtre de connexion.".to_string()
            } else {
                format!("Erreur de désérialisation JSON: {}", e)
            }
        })
    }

    pub async fn get_gallery_by_id(&self, id: u64) -> Result<Gallery, String> {
        let url = format!("https://nhentai.net/api/gallery/{}", id);

        let response = self
            .client
            .get(&url)
            .send()
            .await
            .map_err(|e| format!("Erreur réseau pour l'ID #{}: {}", id, e))?;

        if response.status() == 404 {
            return Err(format!("Galerie #{} introuvable sur nhentai.", id));
        }

        if response.status() == 403 || response.status() == 503 {
            return Err("Protection Cloudflare active. Veuillez actualiser votre session.".to_string());
        }

        let gallery = response
            .json::<Gallery>()
            .await
            .map_err(|e| format!("Impossible de parser la galerie #{}: {}", id, e))?;

        Ok(gallery)
    }

    pub async fn download_image(&self, url: &str) -> Result<Vec<u8>, String> {
        const MAX_IMAGE_BYTES: usize = 25 * 1024 * 1024;
        let mut retries = 3;
        while retries > 0 {
            match self.client.get(url).send().await {
                Ok(resp) if resp.status().is_success() => {
                    if let Some(len) = resp.content_length() {
                        if len > MAX_IMAGE_BYTES as u64 {
                            return Err("Image trop volumineuse".to_string());
                        }
                    }
                    let bytes = resp
                        .bytes()
                        .await
                        .map_err(|e| format!("Erreur lecture binaire image: {}", e))?;
                    if bytes.len() > MAX_IMAGE_BYTES {
                        return Err("Image trop volumineuse".to_string());
                    }
                    return Ok(bytes.to_vec());
                }
                Ok(resp) => {
                    retries -= 1;
                    tokio::time::sleep(Duration::from_millis(500)).await;
                    if retries == 0 {
                        return Err(format!("Erreur HTTP {} sur {}", resp.status(), url));
                    }
                }
                Err(e) => {
                    retries -= 1;
                    tokio::time::sleep(Duration::from_millis(500)).await;
                    if retries == 0 {
                        return Err(format!("Erreur téléchargement: {}", e));
                    }
                }
            }
        }
        Err("Échec après 3 tentatives de téléchargement.".to_string())
    }
}
