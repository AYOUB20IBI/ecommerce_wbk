
import {
  BadRequestException,
  Injectable,
  PayloadTooLargeException,
  UnsupportedMediaTypeException,
} from '@nestjs/common';

import sharp from 'sharp';

import { MediaSettingsService } from '../settings/media-settings.service';

type FileGroup =
  | 'images'
  | 'modernImages'
  | 'documents'
  | 'spreadsheets'
  | 'videos'
  | 'archives';

export type ValidatedMediaFile = {
  originalName: string;
  mimeType: string;
  extension: string;
  group: FileGroup;
  fileSize: number;
  width: number | null;
  height: number | null;
  buffer: Buffer;
};

const MB = 1024 * 1024;

const SUPPORTED = {
  'image/jpeg': {
    extensions: ['jpg', 'jpeg'],
    group: 'images',
  },
  'image/png': {
    extensions: ['png'],
    group: 'images',
  },
  'image/webp': {
    extensions: ['webp'],
    group: 'images',
  },
  'image/gif': {
    extensions: ['gif'],
    group: 'modernImages',
  },
  'image/avif': {
    extensions: ['avif'],
    group: 'modernImages',
  },
  'application/pdf': {
    extensions: ['pdf'],
    group: 'documents',
  },
  'text/plain': {
    extensions: ['txt'],
    group: 'documents',
  },
  'text/csv': {
    extensions: ['csv'],
    group: 'spreadsheets',
  },
} as const;

type SupportedMime = keyof typeof SUPPORTED;

function isSupportedMime(
  value: string,
): value is SupportedMime {
  return Object.prototype.hasOwnProperty.call(
    SUPPORTED,
    value,
  );
}

function invalidFile(message: string): never {
  throw new BadRequestException({
    success: false,
    message,
  });
}

function checkSignature(
  buffer: Buffer,
  mimeType: SupportedMime,
): boolean {
  switch (mimeType) {
    case 'image/jpeg':
      return (
        buffer.length >= 3 &&
        buffer[0] === 0xff &&
        buffer[1] === 0xd8 &&
        buffer[2] === 0xff
      );

    case 'image/png':
      return (
        buffer.length >= 8 &&
        buffer.subarray(0, 8).equals(
          Buffer.from([
            137, 80, 78, 71,
            13, 10, 26, 10,
          ]),
        )
      );

    case 'image/webp':
      return (
        buffer.length >= 12 &&
        buffer.toString('ascii', 0, 4) === 'RIFF' &&
        buffer.toString('ascii', 8, 12) === 'WEBP'
      );

    case 'image/gif':
      return (
        buffer.length >= 6 &&
        ['GIF87a', 'GIF89a'].includes(
          buffer.toString('ascii', 0, 6),
        )
      );

    case 'image/avif':
      return (
        buffer.length >= 16 &&
        buffer.toString('ascii', 4, 8) === 'ftyp' &&
        (
          buffer.toString('ascii', 8, 12) === 'avif' ||
          buffer.toString('ascii', 8, 12) === 'avis'
        )
      );

    case 'application/pdf':
      return (
        buffer.length >= 8 &&
        buffer.toString('ascii', 0, 5) === '%PDF-' &&
        /^%PDF-[12]\.\d/.test(
          buffer.toString('ascii', 0, 8),
        )
      );

    case 'text/plain':
    case 'text/csv':
      return true;
  }
}

function validateText(
  buffer: Buffer,
): void {
  if (buffer.includes(0)) {
    invalidFile('Binary content is not allowed in text files.');
  }

  const decoder = new TextDecoder('utf-8', {
    fatal: true,
  });

  let text: string;

  try {
    text = decoder.decode(buffer);
  } catch {
    invalidFile('Only UTF-8 text files are supported.');
  }

  if (
    text.startsWith('<!DOCTYPE') ||
    /^\s*<html[\s>]/i.test(text) ||
    /^\s*<script[\s>]/i.test(text)
  ) {
    invalidFile('HTML or script content is not allowed.');
  }

  for (const char of text) {
    const code = char.charCodeAt(0);

    if (
      code < 32 &&
      code !== 9 &&
      code !== 10 &&
      code !== 13
    ) {
      invalidFile('Text file contains invalid control characters.');
    }
  }
}

@Injectable()
export class MediaFileValidatorService {
  constructor(
    private readonly settings: MediaSettingsService,
  ) {}

  async validate(
    buffer: Buffer,
    originalName: string,
    declaredMime: string,
  ): Promise<ValidatedMediaFile> {
    if (
      !Buffer.isBuffer(buffer) ||
      buffer.length === 0
    ) {
      invalidFile('The uploaded file is empty.');
    }

    if (
      typeof originalName !== 'string' ||
      originalName.length === 0 ||
      originalName.length > 255 ||
      originalName.includes('/') ||
      originalName.includes('\\') ||
      originalName.includes('\0') ||
      originalName === '.' ||
      originalName === '..'
    ) {
      invalidFile('Invalid file name.');
    }

    const extension = originalName
      .split('.')
      .pop()
      ?.toLowerCase();

    if (!extension || !/^[a-z0-9]+$/.test(extension)) {
      invalidFile('Invalid file extension.');
    }

    const mimeType = declaredMime
      .split(';')[0]
      .trim()
      .toLowerCase();

    if (!isSupportedMime(mimeType)) {
      throw new UnsupportedMediaTypeException({
        success: false,
        message:
          'This file type is not enabled in the secure upload pipeline.',
      });
    }

    const definition = SUPPORTED[mimeType];

    if (
      !definition.extensions.some(
        (allowed) => allowed === extension,
      )
    ) {
      invalidFile(
        'File extension does not match the declared format.',
      );
    }

    const config =
      await this.settings.getConfiguration();

    const group: FileGroup = definition.group;

    const policy = config[group];

    if (!policy.enabled) {
      throw new UnsupportedMediaTypeException({
        success: false,
        message:
          'This file type is disabled by the administrator.',
      });
    }

    const maxBytes = policy.maxSizeMb * MB;

    if (buffer.length > maxBytes) {
      throw new PayloadTooLargeException({
        success: false,
        message: `Maximum file size: ${policy.maxSizeMb} MB.`,
      });
    }

    if (!checkSignature(buffer, mimeType)) {
      invalidFile('File signature does not match its format.');
    }

    let width: number | null = null;
    let height: number | null = null;

    if (mimeType.startsWith('image/')) {
      try {
        const metadata = await sharp(buffer, {
          limitInputPixels: 20_000_000,
          failOn: 'error',
        }).metadata();

        const expectedFormat: Record<string, string> = {
          'image/jpeg': 'jpeg',
          'image/png': 'png',
          'image/webp': 'webp',
          'image/gif': 'gif',
          'image/avif': 'heif',
        };

        if (
          metadata.format !== expectedFormat[mimeType] ||
          !metadata.width ||
          !metadata.height ||
          metadata.width * metadata.height > 20_000_000
        ) {
          invalidFile('Invalid image format or dimensions.');
        }

        // Animated GIF/AVIF will require a separate,
        // explicitly defined animation processing policy.
        if ((metadata.pages ?? 1) > 1) {
          invalidFile(
            'Animated images are not supported by this pipeline yet.',
          );
        }

        width = metadata.width;
        height = metadata.height;
      } catch {
        invalidFile(
          'The image is invalid or unsupported.',
        );
      }
    }

    if (
      mimeType === 'text/plain' ||
      mimeType === 'text/csv'
    ) {
      validateText(buffer);
    }

    // PDF signature is checked here.
    // Malware scanning and safe download handling
    // must be completed before PDF upload is enabled
    // on a public endpoint.

    return {
      originalName,
      mimeType,
      extension,
      group,
      fileSize: buffer.length,
      width,
      height,
      buffer,
    };
  }
}
