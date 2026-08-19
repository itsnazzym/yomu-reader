/**
 * nhentai API v2 — Current user (me)
 *
 * GET    /api/v2/user             Get own profile
 * PUT    /api/v2/user             Update profile
 * DELETE /api/v2/user             Delete account
 * GET    /api/v2/user/keys        List API keys
 * POST   /api/v2/user/keys        Create API key
 * DELETE /api/v2/user/keys/:id    Revoke API key
 */

import { nhApi } from "./client";
import type { ApiKey, Me, SuccessResponse } from "./types";

let getMeInflight: Promise<Me> | null = null;

export async function getMe(): Promise<Me> {
  if (!getMeInflight) {
    getMeInflight = nhApi.get<Me>("/user").finally(() => {
      getMeInflight = null;
    });
  }
  return getMeInflight;
}

export interface UpdateProfileParams {
  username?: string;
  email?: string;
  about?: string;
  favorite_tags?: string;
  current_password?: string;
  new_password?: string;
  avatar_url?: string;
  remove_avatar?: boolean;
}

export async function updateProfile(
  params: UpdateProfileParams
): Promise<SuccessResponse & { username: string; email: string; avatar_url: string }> {
  return nhApi.put("/user", params);
}

export async function deleteAccount(): Promise<SuccessResponse> {
  return nhApi.delete("/user");
}

export async function listApiKeys(): Promise<ApiKey[]> {
  return nhApi.get("/user/keys");
}

export async function createApiKey(
  name: string
): Promise<ApiKey & { key: string }> {
  return nhApi.post("/user/keys", { name });
}

export async function revokeApiKey(keyId: string): Promise<SuccessResponse> {
  return nhApi.delete(`/user/keys/${keyId}`);
}
