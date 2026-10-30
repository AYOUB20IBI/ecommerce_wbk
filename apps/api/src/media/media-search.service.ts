
import { Inject, Injectable } from '@nestjs/common';
import {
  and,
  desc,
  eq,
  ilike,
  or,
  sql,
  type SQL,
} from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';

import { DATABASE } from '../database/database.provider';
import { media } from '../database/schema/catalog-media.schema';

import { StorageManagerService } from './storage/storage-manager.service';

import type { MediaSearchInput } from './dto/media-search.dto';

@Injectable()
export class MediaSearchService {
  constructor(
    @Inject(DATABASE)
    private readonly db: ReturnType<typeof drizzle>,

    private readonly storage: StorageManagerService,
  ) {}

  private where(input: MediaSearchInput): SQL {
    const conditions: SQL[] = [
      eq(media.status, 'ready'),
    ];

    if (input.search.length > 0) {
      const escaped = input.search.replace(
        /[\\%_]/g,
        (char) => `\\${char}`,
      );

      const pattern = `%${escaped}%`;

      conditions.push(
        or(
          ilike(media.originalName, pattern),
          ilike(media.altText, pattern),
        )!,
      );
    }

    const images = or(
      sql`${media.mimeType} LIKE 'image/%'`,
      and(
        eq(media.sourceType, 'external'),
        or(
          sql`${media.mimeType} IS NULL`,
          sql`${media.mimeType} LIKE 'image/%'`,
        ),
      ),
    )!;

    const documents = or(
      eq(media.mimeType, 'application/pdf'),
      eq(media.mimeType, 'text/plain'),
      eq(media.mimeType, 'text/csv'),
      eq(media.mimeType, 'application/vnd.ms-excel'),
    )!;

    if (input.type === 'image') {
      conditions.push(images);
    }

    if (input.type === 'document') {
      conditions.push(documents);
    }

    return and(...conditions)!;
  }

  async findAll(input: MediaSearchInput) {
    const condition = this.where(input);

    const [rows, countResult] = await Promise.all([
      this.db
        .select({
          id: media.id,
          sourceType: media.sourceType,
          storageProvider: media.storageProvider,
          storageKey: media.storageKey,
          externalUrl: media.externalUrl,
          originalName: media.originalName,
          mimeType: media.mimeType,
          fileSize: media.fileSize,
          width: media.width,
          height: media.height,
          altText: media.altText,
          status: media.status,
          uploadedBy: media.uploadedBy,
          updatedBy: media.updatedBy,
          createdAt: media.createdAt,
          updatedAt: media.updatedAt,
        })
        .from(media)
        .where(condition)
        .orderBy(
          desc(media.createdAt),
          desc(media.id),
        )
        .limit(input.limit)
        .offset((input.page - 1) * input.limit),

      this.db
        .select({
          total: sql<number>`count(*)::int`,
        })
        .from(media)
        .where(condition),
    ]);

    const items = rows.map((item) => {
      const isDocument = [
        'application/pdf',
        'text/plain',
        'text/csv',
        'application/vnd.ms-excel',
      ].includes(item.mimeType ?? '');

      const url =
        isDocument
          ? null
          : item.sourceType === 'external'
            ? item.externalUrl
            : item.storageProvider && item.storageKey
              ? this.storage.getPublicUrl(
                  item.storageProvider,
                  item.storageKey,
                )
              : null;

      return {
        id: item.id,
        sourceType: item.sourceType,
        storageProvider: item.storageProvider,
        url,
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
    });

    const total = countResult[0]?.total ?? 0;

    return {
      items,
      pagination: {
        page: input.page,
        limit: input.limit,
        total,
        totalPages: Math.ceil(total / input.limit),
      },
    };
  }
}
