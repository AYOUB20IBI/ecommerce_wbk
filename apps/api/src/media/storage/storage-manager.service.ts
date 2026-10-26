
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

@Injectable()
export class StorageManagerService {
  constructor(
    private readonly local: LocalStorageService,
    private readonly s3: S3StorageService,
  ) {}

  currentProvider(): StorageProvider {
    const driver =
      process.env.MEDIA_STORAGE_DRIVER ?? 'local';

    if (driver !== 'local' && driver !== 's3') {
      throw new ServiceUnavailableException({
        success: false,
        message: 'Configuration du stockage invalide.',
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
    await this.adapter(provider).delete(key);
  }

  getPublicUrl(
    provider: StorageProvider,
    key: string,
  ): string | null {
    return this.adapter(provider).getPublicUrl(key);
  }
}
