
import { Module } from '@nestjs/common';

import { MediaFileValidatorService } from './media-file-validator.service';
import { MediaSettingsService } from '../settings/media-settings.service';

@Module({
  providers: [
    MediaSettingsService,
    MediaFileValidatorService,
  ],
  exports: [
    MediaFileValidatorService,
  ],
})
export class MediaValidationModule {}
