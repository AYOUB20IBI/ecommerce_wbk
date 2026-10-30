
import { z } from 'zod';

const fileGroupSchema = z.strictObject({
  enabled: z.boolean(),

  maxSizeMb: z.number()
    .int()
    .min(1)
    .max(500),
});

export const mediaSettingsSchema = z.strictObject({
  images: fileGroupSchema.extend({
    maxSizeMb: z.number().int().min(1).max(20),
  }),

  modernImages: fileGroupSchema.extend({
    maxSizeMb: z.number().int().min(1).max(20),
  }),

  documents: fileGroupSchema.extend({
    maxSizeMb: z.number().int().min(1).max(50),
  }),

  spreadsheets: fileGroupSchema.extend({
    maxSizeMb: z.number().int().min(1).max(50),
  }),

  videos: fileGroupSchema.extend({
    maxSizeMb: z.number().int().min(1).max(500),
  }),

  archives: fileGroupSchema.extend({
    maxSizeMb: z.number().int().min(1).max(50),
  }),

  allowExternalHttp: z.boolean(),
  allowExternalHttps: z.boolean(),
});

export type MediaSettingsInput =
  z.infer<typeof mediaSettingsSchema>;

export const DEFAULT_MEDIA_SETTINGS: MediaSettingsInput = {
  images: {
    enabled: true,
    maxSizeMb: 5,
  },

  modernImages: {
    enabled: true,
    maxSizeMb: 5,
  },

  documents: {
    enabled: true,
    maxSizeMb: 20,
  },

  spreadsheets: {
    enabled: true,
    maxSizeMb: 20,
  },

  videos: {
    enabled: false,
    maxSizeMb: 100,
  },

  archives: {
    enabled: false,
    maxSizeMb: 20,
  },

  allowExternalHttp: true,
  allowExternalHttps: true,
};
