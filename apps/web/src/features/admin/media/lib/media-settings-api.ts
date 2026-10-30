
import { z } from "zod";

const group = (maximum: number) =>
  z.strictObject({
    enabled: z.boolean(),
    maxSizeMb: z.number().int().min(1).max(maximum),
  });

export const settingsSchema = z.strictObject({
  images: group(20),
  modernImages: group(20),
  documents: group(50),
  spreadsheets: group(50),
  videos: group(500),
  archives: group(50),
  allowExternalHttp: z.boolean(),
  allowExternalHttps: z.boolean(),
});

export type MediaSettings = z.infer<typeof settingsSchema>;

export type SettingsResponse = {
  configuration: MediaSettings;
  updatedAt: string | null;
};

const responseSchema = z.strictObject({
  configuration: settingsSchema,
  updatedAt: z.string().nullable(),
});

async function request(
  method: "GET" | "PATCH",
  settings?: MediaSettings,
): Promise<SettingsResponse> {
  const response = await fetch("/api/admin/media-settings", {
    method,
    credentials: "same-origin",
    cache: "no-store",
    headers: {
      Accept: "application/json",
      ...(method === "PATCH"
        ? { "Content-Type": "application/json" }
        : {}),
    },
    ...(method === "PATCH"
      ? { body: JSON.stringify(settingsSchema.parse(settings)) }
      : {}),
  });

  let body: unknown;

  try {
    body = await response.json();
  } catch {
    throw new Error("Invalid settings API response.");
  }

  if (
    !body ||
    typeof body !== "object" ||
    !("success" in body) ||
    body.success !== true ||
    !("data" in body)
  ) {
    let message = `Request failed (${response.status}).`;

    if (
      body &&
      typeof body === "object" &&
      "message" in body &&
      typeof body.message === "string"
    ) {
      message = body.message;
    }

    if (response.status === 401) {
      throw new Error("Your session has expired. Please sign in again.");
    }

    if (response.status === 403) {
      throw new Error("Only administrators can access Media Settings.");
    }

    throw new Error(message);
  }

  if (!response.ok) {
    throw new Error(`Request failed (${response.status}).`);
  }

  return responseSchema.parse(body.data);
}

export function getMediaSettings() {
  return request("GET");
}

export function saveMediaSettings(settings: MediaSettings) {
  return request("PATCH", settings);
}
