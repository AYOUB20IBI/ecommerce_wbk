
import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  PayloadTooLargeException,
  ConflictException
} from '@nestjs/common';

import { randomUUID } from 'node:crypto';
import { and, desc, eq, sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import sharp from 'sharp';

import { DATABASE } from '../database/database.provider';
import {
  media,
  mediaActivity,
  productImages,
} from '../database/schema/catalog-media.schema';



import type {
  ExternalMediaInput,
  UpdateMediaInput,
} from './dto/media.dto';

import type {
  StorageProvider,
} from './storage/storage.interface';
import { StorageManagerService } from './storage/storage-manager.service';
import { InternalServerErrorException } from '@nestjs/common';

import {
  mediaDeletionJobs,
} from '../database/schema/media-deletion-job.schema';

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const MAX_PIXELS = 20_000_000;

@Injectable()
export class MediaService {
  constructor(
    @Inject(DATABASE)
    private readonly db: ReturnType<typeof drizzle>,

    private readonly storage: StorageManagerService,
  ) {}

  // =====================================
  // RESOLVE PUBLIC IMAGE URL
  // =====================================

  private publicUrl(item: {
    sourceType: 'upload' | 'external';
    storageProvider: StorageProvider | null;
    storageKey: string | null;
    externalUrl: string | null;
  }): string | null {
    if (item.sourceType === 'external') {
      return item.externalUrl;
    }

    if (!item.storageProvider || !item.storageKey) {
      return null;
    }

    return this.storage.getPublicUrl(
      item.storageProvider,
      item.storageKey,
    );
  }

  // =====================================
  // UPLOAD
  // =====================================

  async uploadImage(
    buffer: Buffer,
    originalName: string,
    declaredMimeType: string,
    adminId: string,
  ) {
    if (!buffer.length) {
      throw new BadRequestException({
        success: false,
        message: 'Le fichier est vide.',
        errors: {
          file: ['Veuillez sélectionner une image.'],
        },
      });
    }

    if (buffer.length > MAX_UPLOAD_BYTES) {
      throw new PayloadTooLargeException({
        success: false,
        message: 'La taille maximale est de 5 Mo.',
      });
    }

    const allowed = [
      'image/jpeg',
      'image/png',
      'image/webp',
    ];

    if (!allowed.includes(declaredMimeType)) {
      throw new BadRequestException({
        success: false,
        message: 'Format non autorisé.',
        errors: {
          file: ['JPEG, PNG et WebP uniquement.'],
        },
      });
    }

    let output: Buffer;
    let width: number;
    let height: number;

    try {
      const instance = sharp(buffer, {
        limitInputPixels: MAX_PIXELS,
        animated: false,
        failOn: 'error',
      });

      const metadata = await instance.metadata();

      const mimeByFormat: Record<string, string> = {
        jpeg: 'image/jpeg',
        png: 'image/png',
        webp: 'image/webp',
      };

      if (
        !metadata.format ||
        mimeByFormat[metadata.format] !== declaredMimeType ||
        !metadata.width ||
        !metadata.height ||
        (metadata.pages ?? 1) !== 1
      ) {
        throw new Error('INVALID_IMAGE');
      }

      output = await instance
        .rotate()
        .resize({
          width: 2000,
          height: 2000,
          fit: 'inside',
          withoutEnlargement: true,
        })
        .webp({
          quality: 82,
          effort: 4,
        })
        .toBuffer();

      const result = await sharp(output).metadata();

      if (!result.width || !result.height) {
        throw new Error('INVALID_OUTPUT');
      }

      width = result.width;
      height = result.height;
    } catch {
      throw new BadRequestException({
        success: false,
        message: 'Image invalide.',
        errors: {
          file: [
            'Le fichier image est invalide ou non supporté.',
          ],
        },
      });
    }

    const now = new Date();
    const year = now.getUTCFullYear();
    const month = String(
      now.getUTCMonth() + 1,
    ).padStart(2, '0');

    const key = `${year}/${month}/${randomUUID()}.webp`;

    const provider = await this.storage.upload(
      key,
      output,
    );

    try {
      const created = await this.db.transaction(
        async (tx) => {
          const [record] = await tx
            .insert(media)
            .values({
              sourceType: 'upload',
              storageProvider: provider,
              storageKey: key,
              originalName: originalName.slice(0, 255),
              mimeType: 'image/webp',
              fileSize: output.length,
              width,
              height,
              uploadedBy: adminId,
              updatedBy: adminId,
            })
            .returning();

          await tx.insert(mediaActivity).values({
            mediaId: record.id,
            actorId: adminId,
            action: 'media.uploaded',
          });

          return record;
        },
      );

      return this.serialize(created);
    } catch (error) {
      // Object storage + PostgreSQL cannot share
      // a single ACID transaction.
      await this.storage
        .delete(provider, key)
        .catch(() => undefined);

      throw error;
    }
  }

  // =====================================
  // EXTERNAL URL
  // =====================================

  async addExternal(
    input: ExternalMediaInput,
    adminId: string,
  ) {
    const created = await this.db.transaction(
      async (tx) => {
        const [record] = await tx
          .insert(media)
          .values({
            sourceType: 'external',
            storageProvider: null,
            storageKey: null,
            externalUrl: input.url,
            originalName: 'External image',
            mimeType: null,
            fileSize: null,
            width: null,
            height: null,
            altText: input.altText ?? null,
            uploadedBy: adminId,
            updatedBy: adminId,
          })
          .returning();

        await tx.insert(mediaActivity).values({
          mediaId: record.id,
          actorId: adminId,
          action: 'media.external_added',
        });

        return record;
      },
    );

    return this.serialize(created);
  }

  // =====================================
  // OUTPUT
  // =====================================

  private serialize(item: typeof media.$inferSelect) {
    return {
      id: item.id,
      sourceType: item.sourceType,
      storageProvider: item.storageProvider,
      url: this.publicUrl(item),
      originalName: item.originalName,
      mimeType: item.mimeType,
      fileSize: item.fileSize,
      width: item.width,
      height: item.height,
      altText: item.altText,
      status: item.status,
      uploadedBy: item.uploadedBy,
      updatedBy: item.updatedBy,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    };
  }

  // =====================================
  // LIST
  // =====================================

  async findAll(page: number, limit: number) {
    const [items, countResult] = await Promise.all([
      this.db
        .select()
        .from(media)
        .where(eq(media.status, 'ready'))
        .orderBy(
          desc(media.createdAt),
          desc(media.id),
        )
        .limit(limit)
        .offset((page - 1) * limit),

      this.db
        .select({ total: sql<number>`count(*)::int` })
        .from(media)
        .where(eq(media.status, 'ready')),
    ]);

    const total = countResult[0]?.total ?? 0;

    return {
      items: items.map((item) => this.serialize(item)),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // =====================================
  // GET ONE
  // =====================================

  async findOne(id: string) {
    const [item] = await this.db
      .select()
      .from(media)
      .where(
        and(
          eq(media.id, id),
          eq(media.status, 'ready'),
        ),
      )
      .limit(1);

    if (!item) {
      throw new NotFoundException({
        success: false,
        message: 'Image introuvable.',
      });
    }

    return this.serialize(item);
  }

  // =====================================
  // UPDATE ALT TEXT
  // =====================================

  async update(
    id: string,
    input: UpdateMediaInput,
    adminId: string,
  ) {
    const record = await this.db.transaction(
      async (tx) => {
        const [old] = await tx
          .select()
          .from(media)
          .where(
            and(
              eq(media.id, id),
              eq(media.status, 'ready'),
            ),
          )
          .for('update')
          .limit(1);

        if (!old) {
          throw new NotFoundException({
            success: false,
            message: 'Image introuvable.',
          });
        }

        const [updated] = await tx
          .update(media)
          .set({
            altText: input.altText,
            updatedBy: adminId,
            updatedAt: new Date(),
          })
          .where(eq(media.id, id))
          .returning();

        await tx.insert(mediaActivity).values({
          mediaId: id,
          actorId: adminId,
          action: 'media.updated',
          changes: JSON.stringify({
            altText: {
              old: old.altText,
              new: input.altText,
            },
          }),
        });

        return updated;
      },
    );

    return this.serialize(record);
  }

  // =====================================
  // SOFT DELETE
  // =====================================

  
  
  async requestDeletion(id: string, adminId: string) {
    return this.db.transaction(async (tx) => {
      const [item] = await tx
        .select()
        .from(media)
        .where(eq(media.id, id))
        .for('update')
        .limit(1);

      if (!item) {
        throw new NotFoundException({
          success: false,
          message: 'Image introuvable.',
        });
      }

      if (item.status === 'deleting') {
        return {
          id,
          status: 'deleting',
          message: 'Suppression déjà programmée.',
        };
      }

      if (item.status === 'deleted') {
        return {
          id,
          status: 'deleted',
          message: 'Image déjà supprimée.',
        };
      }

      // Check product references.
      const [used] = await tx
        .select({ id: productImages.id })
        .from(productImages)
        .where(eq(productImages.mediaId, id))
        .limit(1);

      if (used) {
        throw new ConflictException({
          success: false,
          message: 'Image utilisée par un produit.',
          errors: {
            media: [
              'Détachez cette image du produit avant suppression.',
            ],
          },
        });
      }

      // Change visibility immediately.
      await tx
        .update(media)
        .set({
          status: 'deleting',
          updatedBy: adminId,
          updatedAt: new Date(),
        })
        .where(eq(media.id, id));

      // External URL: nothing physical to delete.
      if (item.sourceType === 'external') {
        await tx
          .update(media)
          .set({
            status: 'deleted',
            updatedAt: new Date(),
          })
          .where(eq(media.id, id));

        await tx.insert(mediaActivity).values({
          mediaId: id,
          actorId: adminId,
          action: 'media.deleted',
        });

        return {
          id,
          status: 'deleted',
          queued: false,
        };
      }

      if (!item.storageProvider || !item.storageKey) {
        throw new ConflictException({
          success: false,
          message: 'Informations de stockage manquantes.',
        });
      }

      await tx.insert(mediaDeletionJobs).values({
        mediaId: id,
        provider: item.storageProvider,
        storageKey: item.storageKey,
        status: 'pending',
      });

      await tx.insert(mediaActivity).values({
        mediaId: id,
        actorId: adminId,
        action: 'media.delete_requested',
      });

      return {
        id,
        status: 'deleting',
        queued: true,
      };
    });
  }



  // =====================================
  // ACTIVITY HISTORY
  // =====================================

  
  async activity(id: string) {
    const [item] = await this.db
      .select({ id: media.id })
      .from(media)
      .where(eq(media.id, id))
      .limit(1);

    if (!item) {
      throw new NotFoundException({
        success: false,
        message: 'Image introuvable.',
      });
    }

    return this.db
      .select({
        id: mediaActivity.id,
        action: mediaActivity.action,
        actorId: mediaActivity.actorId,
        changes: mediaActivity.changes,
        createdAt: mediaActivity.createdAt,
      })
      .from(mediaActivity)
      .where(eq(mediaActivity.mediaId, id))
      .orderBy(
        desc(mediaActivity.createdAt),
        desc(mediaActivity.id),
      )
      .limit(100);
  }

}
