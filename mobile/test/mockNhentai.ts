import type { Gallery, SearchResult } from "../lib/api/types";

type SearchHandler = (query: string, page: number) => Gallery[];

let handler: SearchHandler = () => [];

export function __setSearchHandler(fn: SearchHandler): void {
  handler = fn;
}

export async function searchGalleries(
  query = "",
  page = 1
): Promise<SearchResult> {
  return {
    result: handler(query, page),
    num_pages: 1,
    per_page: 25,
  };
}
