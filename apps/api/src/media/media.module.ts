
import { Module } from '@nestjs/common';

import { AdminAuthModule } from '../admin-auth/admin-auth.module';
import { SecurityModule } from '../security/security.module';

import { MediaController } from './media.controller';
import { MediaService } from './media.service';

import { LocalStorageService } from './storage/local-storage.service';
import { S3StorageService } from './storage/s3-storage.service';
import { StorageManagerService } from './storage/storage-manager.service';
import { MediaDeletionWorker } from './media-deletion.worker';

@Module({
  imports: [
    AdminAuthModule,
    SecurityModule,
  ],
  controllers: [MediaController],
  providers: [
    MediaService,
    LocalStorageService,
    S3StorageService,
    StorageManagerService,
    MediaDeletionWorker
  ],
  exports: [
    MediaService,
    StorageManagerService,
  ],
})
export class MediaModule {}
