
import { Injectable } from '@nestjs/common';
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';

import {
  StorageAdapter,
  assertStorageKey,
} from './storage.interface';

@Injectable()
export class S3StorageService implements StorageAdapter {
  private client?: S3Client;

  private configuration() {
    const {
      S3_ENDPOINT,
      S3_REGION,
      S3_BUCKET,
      S3_ACCESS_KEY,
      S3_SECRET_KEY,
    } = process.env;

    if (
      !S3_REGION ||
      !S3_BUCKET ||
      !S3_ACCESS_KEY ||
      !S3_SECRET_KEY
    ) {
      throw new Error('S3_CONFIGURATION_MISSING');
    }

    if (S3_ENDPOINT) {
      const parsed = new URL(S3_ENDPOINT);

      if (
        process.env.NODE_ENV === 'production' &&
        parsed.protocol !== 'https:'
      ) {
        throw new Error('S3_HTTPS_REQUIRED');
      }
    }

    return {
      endpoint: S3_ENDPOINT,
      region: S3_REGION,
      bucket: S3_BUCKET,
      accessKeyId: S3_ACCESS_KEY,
      secretAccessKey: S3_SECRET_KEY,
    };
  }

  private connection() {
    const config = this.configuration();

    if (!this.client) {
      this.client = new S3Client({
        region: config.region,

        ...(config.endpoint
          ? {
              endpoint: config.endpoint,
              forcePathStyle: true,
            }
          : {}),

        credentials: {
          accessKeyId: config.accessKeyId,
          secretAccessKey: config.secretAccessKey,
        },
      });
    }

    return {
      client: this.client,
      bucket: config.bucket,
    };
  }

  async upload(
    key: string,
    data: Buffer,
  ): Promise<void> {
    assertStorageKey(key);

    const { client, bucket } = this.connection();

    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: data,
        ContentType: 'image/webp',
        CacheControl:
          'public, max-age=31536000, immutable',
        IfNoneMatch: '*',
      }),
    );
  }

  async delete(key: string): Promise<void> {
    assertStorageKey(key);

    const { client, bucket } = this.connection();

    await client.send(
      new DeleteObjectCommand({
        Bucket: bucket,
        Key: key,
      }),
    );
  }

  getPublicUrl(key: string): string | null {
    assertStorageKey(key);

    const base = process.env.S3_PUBLIC_URL;

    if (!base) return null;

    return `${base.replace(/\/+$/, '')}/${key}`;
  }
}
