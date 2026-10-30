
import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  PayloadTooLargeException,
  Post,
  Query,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';

import type { FastifyRequest } from 'fastify';

import { AdminAuthGuard } from '../admin-auth/guards/admin-auth.guard';
import { PermissionsGuard } from '../admin-auth/guards/permissions.guard';
import { RequirePermissions } from '../admin-auth/decorators/require-permissions.decorator';
import { CsrfGuard } from '../security/csrf.guard';

import {
  externalMediaSchema,
  updateMediaSchema,
  mediaListSchema,
  mediaIdSchema,
} from './dto/media.dto';

import { MediaService } from './media.service';
import { MediaUploadPolicyService } from './settings/media-upload-policy.service';

function validateId(id: string): string {
  const parsed = mediaIdSchema.safeParse(id);

  if (!parsed.success) {
    throw new BadRequestException({
      success: false,
      message: 'Invalid media ID.',
      errors: {
        id: ['A valid UUID is required.'],
      },
    });
  }

  return parsed.data;
}

function validateBody<T>(
  schema: {
    safeParse: (
      value: unknown,
    ) =>
      | {
          success: true;
          data: T;
        }
      | {
          success: false;
          error: {
            flatten: () => {
              fieldErrors: Record<
                string,
                string[] | undefined
              >;
            };
          };
        };
  },
  value: unknown,
): T {
  const result = schema.safeParse(value);

  if (!result.success) {
    throw new BadRequestException({
      success: false,
      message: 'Invalid request data.',
      errors: result.error.flatten().fieldErrors,
    });
  }

  return result.data;
}

@Controller('admin/media')
@UseGuards(AdminAuthGuard, PermissionsGuard)
export class MediaController {
  constructor(
    private readonly service: MediaService,
    private readonly uploadPolicy: MediaUploadPolicyService,
  ) {}

  // =====================================
  // UPLOAD IMAGE
  // POST /api/v1/admin/media/upload
  // =====================================

  @Post('upload')
  @UseGuards(CsrfGuard)
  @RequirePermissions('media.create')
  async upload(@Req() request: FastifyRequest) {
    const admin = request.admin;

    if (!admin) {
      throw new UnauthorizedException();
    }

    if (!request.isMultipart()) {
      throw new BadRequestException({
        success: false,
        message: 'multipart/form-data is required.',
      });
    }

    let file: Awaited<
      ReturnType<FastifyRequest['file']>
    >;

    try {
      file = await request.file();
    } catch (error) {
      const status = (
        error as { statusCode?: number }
      ).statusCode;

      if (status === 413) {
        throw new PayloadTooLargeException({
          success: false,
          message:
            'The upload exceeds the server size limit.',
        });
      }

      throw error;
    }

    if (!file || file.fieldname !== 'file') {
      throw new BadRequestException({
        success: false,
        message:
          'The multipart field "file" is required.',
      });
    }

    let buffer: Buffer;

    try {
      buffer = await file.toBuffer();
    } catch (error) {
      const status = (
        error as { statusCode?: number }
      ).statusCode;

      if (status === 413) {
        throw new PayloadTooLargeException({
          success: false,
          message:
            'The upload exceeds the server size limit.',
        });
      }

      throw error;
    }

    if (file.file.truncated) {
      throw new PayloadTooLargeException({
        success: false,
        message:
          'The upload exceeds the server size limit.',
      });
    }

    await this.uploadPolicy.validateImageUpload({
      filename: file.filename,
      mimetype: file.mimetype,
      size: buffer.length,
    });

    // MediaService performs the actual
    // content-based image verification using Sharp.
    //
    // It also converts the image to WebP,
    // persists its metadata and logs the upload.
    const result = await this.service.uploadImage(
      buffer,
      file.filename,
      file.mimetype,
      admin.id,
    );

    return {
      success: true,
      message: 'Image uploaded successfully.',
      data: result,
    };
  }

  // =====================================
  // EXTERNAL IMAGE
  // POST /api/v1/admin/media/external
  // =====================================

  @Post('external')
  @UseGuards(CsrfGuard)
  @RequirePermissions('media.create')
  async external(
    @Body() body: unknown,
    @Req() request: FastifyRequest,
  ) {
    const admin = request.admin;

    if (!admin) {
      throw new UnauthorizedException();
    }

    const input = validateBody(
      externalMediaSchema,
      body,
    );

    // Apply the administrator's current
    // HTTP/HTTPS policy before creating media.
    await this.uploadPolicy.validateExternalUrl(
      input.url,
    );

    const result = await this.service.addExternal(
      input,
      admin.id,
    );

    return {
      success: true,
      message: 'External media added successfully.',
      data: result,
    };
  }

  // =====================================
  // MEDIA LIST
  // GET /api/v1/admin/media
  // =====================================

  @Get()
  @RequirePermissions('media.read')
  async list(@Query() query: unknown) {
    const input = validateBody(
      mediaListSchema,
      query,
    );

    return {
      success: true,
      message: 'Media loaded successfully.',
      data: await this.service.findAll(
        input.page,
        input.limit,
      ),
    };
  }

  // =====================================
  // GET ONE MEDIA
  // GET /api/v1/admin/media/:id
  // =====================================

  @Get(':id')
  @RequirePermissions('media.read')
  async one(@Param('id') id: string) {
    return {
      success: true,
      message: 'Media loaded successfully.',
      data: await this.service.findOne(
        validateId(id),
      ),
    };
  }

  // =====================================
  // MEDIA ACTIVITY
  // GET /api/v1/admin/media/:id/activity
  // =====================================

  @Get(':id/activity')
  @RequirePermissions('media.read')
  async activity(@Param('id') id: string) {
    return {
      success: true,
      message: 'Media activity loaded successfully.',
      data: await this.service.activity(
        validateId(id),
      ),
    };
  }

  // =====================================
  // UPDATE MEDIA
  // PATCH /api/v1/admin/media/:id
  // =====================================

  @Patch(':id')
  @UseGuards(CsrfGuard)
  @RequirePermissions('media.update')
  async update(
    @Param('id') id: string,
    @Body() body: unknown,
    @Req() request: FastifyRequest,
  ) {
    const admin = request.admin;

    if (!admin) {
      throw new UnauthorizedException();
    }

    const input = validateBody(
      updateMediaSchema,
      body,
    );

    return {
      success: true,
      message: 'Media updated successfully.',
      data: await this.service.update(
        validateId(id),
        input,
        admin.id,
      ),
    };
  }

  // =====================================
  // DELETE MEDIA
  // DELETE /api/v1/admin/media/:id
  // =====================================

  @Delete(':id')
  @HttpCode(HttpStatus.ACCEPTED)
  @UseGuards(CsrfGuard)
  @RequirePermissions('media.delete')
  async delete(
    @Param('id') id: string,
    @Req() request: FastifyRequest,
  ) {
    const admin = request.admin;

    if (!admin) {
      throw new UnauthorizedException();
    }

    const data = await this.service.requestDeletion(
      validateId(id),
      admin.id,
    );

    return {
      success: true,
      message: data.queued
        ? 'Media deletion has been queued.'
        : 'Media has already been deleted.',
      data,
    };
  }
}
