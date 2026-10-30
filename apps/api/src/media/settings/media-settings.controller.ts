
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Patch,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';

import type { FastifyRequest } from 'fastify';

import { AdminAuthGuard } from '../../admin-auth/guards/admin-auth.guard';
import { CsrfGuard } from '../../security/csrf.guard';

import { mediaSettingsSchema } from './media-settings.dto';
import { MediaSettingsService } from './media-settings.service';

@Controller('admin/settings/media')
@UseGuards(AdminAuthGuard)
export class MediaSettingsController {
  constructor(
    private readonly settings: MediaSettingsService,
  ) {}

  @Get()
  async read(@Req() request: FastifyRequest) {
    const admin = request.admin;

    if (!admin) {
      throw new UnauthorizedException();
    }

    const data = await this.settings.getForAdmin(admin.id);

    return {
      success: true,
      message: 'Media settings loaded.',
      data,
    };
  }

  @Patch()
  @UseGuards(CsrfGuard)
  async update(
    @Req() request: FastifyRequest,
    @Body() body: unknown,
  ) {
    const admin = request.admin;

    if (!admin) {
      throw new UnauthorizedException();
    }

    const parsed = mediaSettingsSchema.safeParse(body);

    if (!parsed.success) {
      throw new BadRequestException({
        success: false,
        message: 'Invalid media settings.',
        errors: parsed.error.flatten().fieldErrors,
      });
    }

    const data = await this.settings.updateForAdmin(
      admin.id,
      parsed.data,
    );

    return {
      success: true,
      message: 'Media settings saved successfully.',
      data,
    };
  }
}
