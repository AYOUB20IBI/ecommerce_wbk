
import {
  BadRequestException,
  Controller,
  Get,
  Inject,
  NotFoundException,
  Param,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';

import { and, eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { z } from 'zod';

import { DATABASE } from '../database/database.provider';

import { media } from '../database/schema/catalog-media.schema';

import { AdminAuthGuard } from '../admin-auth/guards/admin-auth.guard';
import { PermissionsGuard } from '../admin-auth/guards/permissions.guard';
import { RequirePermissions } from '../admin-auth/decorators/require-permissions.decorator';

import { LocalPrivateMediaStorageService } from './storage/local-private-media-storage.service';

const ID_SCHEMA = z.uuid();

const DOWNLOADABLE_MIME_TYPES = new Set([
  'application/pdf',
  'text/plain',
  'text/csv',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/zip',
  'video/mp4',
]);

function safeFilename(name: string): string {
  const cleaned = name
    .replace(/[\r\n"\\\/\x00-\x1F\x7F]/g, '_')
    .trim()
    .slice(0, 180);

  return cleaned || 'download';
}

@Controller('admin/media')
@UseGuards(AdminAuthGuard, PermissionsGuard)
export class PrivateMediaDownloadController {
  constructor(
    @Inject(DATABASE)
    private readonly db: ReturnType<typeof drizzle>,

    private readonly privateStorage:
      LocalPrivateMediaStorageService,
  ) {}

  @Get(':id/download')
  @RequirePermissions('media.read')
  async download(
    @Param('id') id: string,
  ): Promise<StreamableFile> {
    const parsed = ID_SCHEMA.safeParse(id);

    if (!parsed.success) {
      throw new BadRequestException({
        success: false,
        message: 'Invalid media ID.',
      });
    }

    const [item] = await this.db
      .select({
        id: media.id,
        sourceType: media.sourceType,
        storageProvider: media.storageProvider,
        storageKey: media.storageKey,
        originalName: media.originalName,
        mimeType: media.mimeType,
        status: media.status,
      })
      .from(media)
      .where(
        and(
          eq(media.id, parsed.data),
          eq(media.status, 'ready'),
        ),
      )
      .limit(1);

    if (
      !item ||
      item.sourceType !== 'upload' ||
      item.storageProvider !== 'local' ||
      !item.storageKey ||
      !item.mimeType ||
      !DOWNLOADABLE_MIME_TYPES.has(item.mimeType)
    ) {
      throw new NotFoundException({
        success: false,
        message: 'Download is not available.',
      });
    }

    const buffer = await this.privateStorage.get(
      item.storageKey,
    );

    const filename = safeFilename(
      item.originalName,
    );

    return new StreamableFile(buffer, {
      type: 'application/octet-stream',
      disposition: `attachment; filename="${filename}"`,
      length: buffer.length,
    });
  }
}
