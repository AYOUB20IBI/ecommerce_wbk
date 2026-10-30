
import {
  mediaRequest,
  normalizeMediaPage,
  type MediaPage,
} from "./media-api";

export type MediaSearchType =
  | "all"
  | "image"
  | "document";

export type MediaSearchParams = {
  page: number;
  limit?: number;
  search: string;
  type: MediaSearchType;
};

export async function searchMedia(
  params: MediaSearchParams,
  signal?: AbortSignal,
): Promise<MediaPage> {
  const query = new URLSearchParams({
    page: String(params.page),
    limit: String(params.limit ?? 24),
    search: params.search.trim(),
    type: params.type,
  });

  const data = await mediaRequest(
    `/api/admin/media-search?${query.toString()}`,
    { signal },
  );

  return normalizeMediaPage(data);
}
