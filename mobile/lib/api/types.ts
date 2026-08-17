export type TagType =
  | "tag"
  | "artist"
  | "character"
  | "parody"
  | "group"
  | "language"
  | "category";

export interface Tag {
  id: number;
  type: TagType;
  name: string;
  url: string;
  count: number;
}

export interface GalleryImage {
  t: "j" | "p" | "g" | "w"; // jpg, png, gif, webp
  w: number;
  h: number;
  url?: string;
  urlThumb?: string;
}

export interface Gallery {
  id: number;
  media_id: string;
  title: {
    english: string;
    japanese: string;
    pretty: string;
  };
  images: {
    pages: GalleryImage[];
    cover: GalleryImage;
    thumbnail: GalleryImage;
  };
  scanlator: string;
  upload_date: number;
  tags: Tag[];
  num_pages: number;
  num_favorites: number;
}

export interface Comment {
  id: number;
  gallery_id: number;
  poster: {
    id: number;
    username: string;
    slug: string;
    avatar_url: string;
    is_superuser: boolean;
    is_staff: boolean;
  };
  post_date: number;
  body: string;
}

export interface SearchResult {
  result: Gallery[];
  num_pages: number;
  per_page: number;
}
