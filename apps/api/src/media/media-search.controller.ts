
import {
  BadRequestException,
  Controller,
  Get,
  Query,
  UseGuards,
} from '@nestjs/common';

import { AdminAuthGuard } from '../admin-auth/guards/admin-auth.guard';
import { PermissionsGuard } from '../admin-auth/guards/permissions.guard';

import { RequirePermissions } from '../admin-auth/decorators/require-permissions.decorator';

import { mediaSearchSchema } from './dto/media-search.dto';
import { MediaSearchService } from './media-search.service';

@Controller('admin/media/search')
@UseGuards(AdminAuthGuard, PermissionsGuard)
export class MediaSearchController {
  constructor(
    private readonly mediaSearch: MediaSearchService,
  ) {}

  @Get()
  @RequirePermissions('media.read')
  async search(@Query() query: unknown) {
    const parsed = mediaSearchSchema.safeParse(query);

    if (!parsed.success) {
      throw new BadRequestException({
        success: false,
        message: 'Invalid media search parameters.',
        errors: parsed.error.flatten().fieldErrors,
      });
    }

    return {
      success: true,
      message: 'Media loaded successfully.',
      data: await this.mediaSearch.findAll(parsed.data),
    };
  }
}
