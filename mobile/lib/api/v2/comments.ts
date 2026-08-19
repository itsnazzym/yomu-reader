/**
 * nhentai API v2 — Comments
 *
 * GET  /api/v2/galleries/:id/comments       List comments
 * POST /api/v2/galleries/:id/comments       Post a new comment
 */

import { nhApi } from "./client";
import type { Comment, SuccessResponse } from "./types";

export async function getComments(
  galleryId: number | string
): Promise<Comment[]> {
  try {
    const res = await nhApi.get<Comment[] | { result: Comment[] }>(
      `/galleries/${galleryId}/comments`
    );
    if (Array.isArray(res)) return res;
    if (res && Array.isArray((res as any).result)) return (res as any).result;
    return [];
  } catch (err) {
    console.warn("[v2/comments] getComments error:", err);
    return [];
  }
}

export interface PostCommentParams {
  body: string;
  pow_challenge: string;
  pow_nonce: string;
  captcha_response?: string;
}

export async function postComment(
  galleryId: number | string,
  params: PostCommentParams
): Promise<SuccessResponse & { comment: Comment }> {
  return nhApi.post(`/galleries/${galleryId}/comments`, params);
}
