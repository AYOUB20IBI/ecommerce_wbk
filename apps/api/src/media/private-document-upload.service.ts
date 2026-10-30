
import {
  Inject,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';

import { drizzle } from 'drizzle-orm/node-postgres';

import { DATABASE } from '../database/database.provider';
import {
  media,
  mediaActivity,
} from '../database/schema/catalog-media.schema';

import { MediaFileValidatorService } from './validation/media-file-validator.service';
import { LocalPrivateMediaStorageService } from './storage/local-private-media-storage.service';

const ACCEPTED = new Set([
  'application/pdf',
  'text/plain',
  'text/csv',
]);

@Injectable()
export class PrivateDocumentUploadService {
  constructor(
    @Inject(DATABASE)
    private readonly db: ReturnType<typeof drizzle>,

    private readonly validator: MediaFileValidatorService,

    private readonly privateStorage:
      LocalPrivateMediaStorageService,
  ) {}

  async upload(
    buffer: Buffer,
    filename: string,
    mimetype: string,
    adminId: string,
  ) {
    const validated = await this.validator.validate(
      buffer,
      filename,
      mimetype,
    );

    if (!ACCEPTED.has(validated.mimeType)) {
      throw new InternalServerErrorException({
        success: false,
        message:
          'Document format not enabled in this upload endpoint.',
      });
    }

    const key = this.privateStorage.makeKey(
      validated.extension,
    );

    await this.privateStorage.put(
      key,
      validated.buffer,
    );

    try {
      const created = await this.db.transaction(
        async (tx) => {
          const [record] = await tx
            .insert(media)
            .values({
              sourceType: 'upload',
              storageProvider: 'local',
              storageKey: key,
              externalUrl: null,

              originalName: validated.originalName,
              mimeType: validated.mimeType,
              fileSize: validated.fileSize,

              width: null,
              height: null,

              status: 'ready',
              uploadedBy: adminId,
              updatedBy: adminId,
            })
            .returning();

          if (!record) {
            throw new Error(
              'MEDIA_DATABASE_INSERT_FAILED',
            );
          }

          await tx.insert(mediaActivity).values({
            mediaId: record.id,
            actorId: adminId,
            action: 'media.document_uploaded',
            changes: JSON.stringify({
              mimeType: validated.mimeType,
              size: validated.fileSize,
            }),
          });

          return record;
        },
      );

      return {
        id: created.id,
        sourceType: created.sourceType,
        storageProvider: created.storageProvider,
        url: null,
        downloadUrl:
          `/api/v1/admin/media/${created.id}/download`,
        originalName: created.originalName,
        mimeType: created.mimeType,
        fileSize: created.fileSize,
        width: created.width,
        height: created.height,
        altText: created.altText,
        status: created.status,
        uploadedBy: created.uploadedBy,
        createdAt: created.createdAt,
        updatedAt: created.updatedAt,
      };
    } catch (error) {
      // Object storage and PostgreSQL cannot share
      // a single database transaction.
      await this.privateStorage
        .delete(key)
        .catch(() => undefined);

      throw error;
    }
  }
}
