export interface Tag {
  id: number;
  type: "artist" | "group" | "parody" | "character" | "category" | "language" | "tag";
  name: string;
  url: string;
  count: number;
}

export interface ImageInfo {
  t: "j" | "p" | "w" | "g";
  w: number;
  h: number;
  path?: string;
  thumbnail?: string;
  number?: number;
}

export interface GalleryImages {
  pages: ImageInfo[];
  cover: ImageInfo;
  thumbnail: ImageInfo;
}

export interface GalleryTitle {
  english?: string;
  japanese?: string;
  pretty?: string;
}

export interface Gallery {
  id: number;
  media_id: string;
  title: GalleryTitle;
  images: GalleryImages;
  scanlator?: string;
  upload_date: number;
  tags: Tag[];
  num_pages: number;
  num_favorites: number;
}

export interface SearchResponse {
  result: Gallery[];
  num_pages: number;
  per_page: number;
}

export type DownloadFormat = "cbz" | "zip" | "folder";
export type DownloadStatus = "queued" | "downloading" | "paused" | "completed" | "error" | "cancelled";

export interface DownloadItem {
  id: number;
  gallery: Gallery;
  format: DownloadFormat;
  status: DownloadStatus;
  progress: number; // 0.0 to 1.0
  downloaded_pages: number;
  total_pages: number;
  speed_kb_s: number;
  error_message?: string;
  target_path?: string;
  created_at: number;
}

export interface LocalBookPage {
  number: number;
  name: string;
  dataUrl: string;
}

export interface LocalBookContent {
  title: string;
  artist?: string;
  format: "cbz" | "zip" | "folder";
  filePath: string;
  totalPages: number;
  pages: LocalBookPage[];
}

export interface LocalBookItem {
  filename: string;
  filePath: string;
  sizeBytes: number;
  modifiedAt: number;
  isCbz?: boolean;
  isFolder?: boolean;
  galleryId?: number;
  title?: string;
  artist?: string;
  language?: string;
  pagesCount?: number;
  coverDataUrl?: string;
}

export interface AppSettings {
  download_directory: string;
  naming_pattern: string;
  default_format: DownloadFormat;
  concurrent_downloads: number;
  concurrent_images_per_gallery: number;
  blacklisted_tags: string[];
  cookies?: string;
  api_key?: string;
  hasSecureCookies?: boolean;
  hasSecureApiKey?: boolean;
  language_filter?: string;
  dns_provider?: "adguard" | "cloudflare" | "google" | "quad9" | "system";
  enable_custom_dns?: boolean;
  enable_doh?: boolean;
}

export interface DownloadProgressPayload {
  id: number;
  downloaded_pages: number;
  total_pages: number;
  progress: number;
  speed_kb_s: number;
  status: DownloadStatus;
  error?: string;
  target_path?: string;
}

export type TabType =
  | "explorer"
  | "favorites"
  | "history"
  | "series"
  | "tags"
  | "characters"
  | "artists"
  | "groups"
  | "library"
  | "batch"
  | "downloads"
  | "settings";

export type SortOption = "date" | "popular-today" | "popular-week" | "popular";

export interface CdnConfig {
  image_servers: string[];
  thumb_servers: string[];
}

export interface GalleryCommentPoster {
  id: number;
  username: string;
  slug?: string;
  avatar_url?: string;
  is_superuser?: boolean;
  is_staff?: boolean;
}

export interface GalleryComment {
  id: number;
  gallery_id: number;
  poster: GalleryCommentPoster;
  post_date: number;
  body: string;
  votes?: number;
}
