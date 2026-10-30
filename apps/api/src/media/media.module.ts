
import { Module } from '@nestjs/common';

import { AdminAuthModule } from '../admin-auth/admin-auth.module';
import { SecurityModule } from '../security/security.module';

import { MediaController } from './media.controller';
import { MediaService } from './media.service';

import { MediaSearchController } from './media-search.controller';
import { MediaSearchService } from './media-search.service';

import { LocalStorageService } from './storage/local-storage.service';
import { S3StorageService } from './storage/s3-storage.service';
import { StorageManagerService } from './storage/storage-manager.service';
import { LocalPrivateMediaStorageService } from './storage/local-private-media-storage.service';

import { MediaDeletionWorker } from './media-deletion.worker';

import { MediaSettingsController } from './settings/media-settings.controller';
import { MediaSettingsService } from './settings/media-settings.service';
import { MediaUploadPolicyService } from './settings/media-upload-policy.service';

import { MediaFileValidatorService } from './validation/media-file-validator.service';

import { PrivateMediaDownloadController } from './private-media-download.controller';
import { PrivateDocumentUploadController } from './private-document-upload.controller';
import { PrivateDocumentUploadService } from './private-document-upload.service';

@Module({
  imports: [
    AdminAuthModule,
    SecurityModule,
  ],

  controllers: [
    MediaController,
    MediaSearchController,
    MediaSettingsController,
    PrivateMediaDownloadController,
    PrivateDocumentUploadController,
  ],

  providers: [
    MediaService,
    MediaSearchService,

    LocalStorageService,
    S3StorageService,
    LocalPrivateMediaStorageService,
    StorageManagerService,

    MediaDeletionWorker,

    MediaSettingsService,
    MediaUploadPolicyService,
    MediaFileValidatorService,

    PrivateDocumentUploadService,
  ],

  exports: [
    MediaService,
    MediaSearchService,
    StorageManagerService,
    LocalPrivateMediaStorageService,
    MediaSettingsService,
    MediaUploadPolicyService,
    MediaFileValidatorService,
    PrivateDocumentUploadService,
  ],
})
export class MediaModule {}
