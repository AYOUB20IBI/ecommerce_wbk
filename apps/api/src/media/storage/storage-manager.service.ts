
import {
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';

import {
  StorageAdapter,
  StorageProvider,
} from './storage.interface';

import { LocalStorageService } from './local-storage.service';
import { S3StorageService } from './s3-storage.service';
import { LocalPrivateMediaStorageService } from './local-private-media-storage.service';

const PRIVATE_DOCUMENT_KEY =
  /^\d{4}\/(0[1-9]|1[0-2])\/[0-9a-f-]{36}\.(pdf|txt|csv|xls|xlsx|zip|mp4)$/i;

@Injectable()
export class StorageManagerService {
  constructor(
    private readonly local: LocalStorageService,
    private readonly s3: S3StorageService,
    private readonly privateStorage:
      LocalPrivateMediaStorageService,
  ) {}

  currentProvider(): StorageProvider {
    const driver =
      process.env.MEDIA_STORAGE_DRIVER ?? 'local';

    if (driver !== 'local' && driver !== 's3') {
      throw new ServiceUnavailableException({
        success: false,
        message: 'Invalid media storage configuration.',
      });
    }

    return driver;
  }

  adapter(provider: StorageProvider): StorageAdapter {
    switch (provider) {
      case 'local':
        return this.local;

      case 's3':
        return this.s3;
    }
  }

  async upload(
    key: string,
    data: Buffer,
  ): Promise<StorageProvider> {
    const provider = this.currentProvider();

    await this.adapter(provider).upload(key, data);

    return provider;
  }

  async delete(
    provider: StorageProvider,
    key: string,
  ): Promise<void> {
    if (PRIVATE_DOCUMENT_KEY.test(key)) {
      if (provider !== 'local') {
        throw new ServiceUnavailableException({
          success: false,
          message:
            'Private document storage provider mismatch.',
        });
      }

      await this.privateStorage.delete(key);
      return;
    }

    await this.adapter(provider).delete(key);
  }

  getPublicUrl(
    provider: StorageProvider,
    key: string,
  ): string | null {
    if (PRIVATE_DOCUMENT_KEY.test(key)) {
      return null;
    }

    return this.adapter(provider).getPublicUrl(key);
  }
}
