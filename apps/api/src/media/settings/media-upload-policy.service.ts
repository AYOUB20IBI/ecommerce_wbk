
import {
  BadRequestException,
  Injectable,
  PayloadTooLargeException,
  UnsupportedMediaTypeException,
} from '@nestjs/common';

import { MediaSettingsService } from './media-settings.service';

const MB = 1024 * 1024;

// Current image pipeline converts JPEG/PNG/WebP
// into optimized WebP using Sharp.
//
// This limit remains in force until we update
// MediaService, Multipart and the storage adapters.
const CURRENT_IMAGE_PIPELINE_LIMIT = 5 * MB;

const SUPPORTED_IMAGE_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
]);

@Injectable()
export class MediaUploadPolicyService {
  constructor(
    private readonly settings: MediaSettingsService,
  ) {}

  async validateImageUpload(
    file: {
      filename: string;
      mimetype: string;
      size: number;
    },
  ): Promise<void> {
    const configuration =
      await this.settings.getConfiguration();

    if (!configuration.images.enabled) {
      throw new BadRequestException({
        success: false,
        message:
          'Image uploads are disabled by the administrator.',
        errors: {
          file: [
            'Image uploads are currently disabled.',
          ],
        },
      });
    }

    if (!SUPPORTED_IMAGE_TYPES.has(file.mimetype)) {
      throw new UnsupportedMediaTypeException({
        success: false,
        message:
          'This file format is not supported by the current image upload pipeline.',
        errors: {
          file: [
            'Only JPEG, PNG and WebP are currently supported.',
          ],
        },
      });
    }

    if (
      typeof file.filename !== 'string' ||
      file.filename.trim().length === 0 ||
      file.filename.length > 255
    ) {
      throw new BadRequestException({
        success: false,
        message: 'Invalid file name.',
      });
    }

    if (
      !Number.isSafeInteger(file.size) ||
      file.size <= 0
    ) {
      throw new BadRequestException({
        success: false,
        message: 'The uploaded file is empty or invalid.',
      });
    }

    // Both limits apply:
    // 1. Administrator-configured limit
    // 2. Current image processing safety limit
    const configuredLimit =
      configuration.images.maxSizeMb * MB;

    const effectiveLimit = Math.min(
      configuredLimit,
      CURRENT_IMAGE_PIPELINE_LIMIT,
    );

    if (file.size > effectiveLimit) {
      throw new PayloadTooLargeException({
        success: false,
        message:
          `Maximum image size is ${
            effectiveLimit / MB
          } MB.`,
        errors: {
          file: [
            'The image exceeds the permitted size.',
          ],
        },
      });
    }
  }

  async validateExternalUrl(
    inputUrl: string,
  ): Promise<void> {
    const configuration =
      await this.settings.getConfiguration();

    let url: URL;

    try {
      url = new URL(inputUrl);
    } catch {
      throw new BadRequestException({
        success: false,
        message: 'Invalid external media URL.',
      });
    }

    const protocol = url.protocol;

    if (
      protocol !== 'http:' &&
      protocol !== 'https:'
    ) {
      throw new BadRequestException({
        success: false,
        message:
          'Only HTTP and HTTPS URLs are supported.',
      });
    }

    if (
      protocol === 'http:' &&
      !configuration.allowExternalHttp
    ) {
      throw new BadRequestException({
        success: false,
        message:
          'HTTP external media URLs are disabled by the administrator.',
      });
    }

    if (
      protocol === 'https:' &&
      !configuration.allowExternalHttps
    ) {
      throw new BadRequestException({
        success: false,
        message:
          'HTTPS external media URLs are disabled by the administrator.',
      });
    }

    if (url.username || url.password) {
      throw new BadRequestException({
        success: false,
        message:
          'External URLs cannot contain credentials.',
      });
    }
  }
}
