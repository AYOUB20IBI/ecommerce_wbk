
import {
  BadRequestException,
  Controller,
  PayloadTooLargeException,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';

import type { FastifyRequest } from 'fastify';

import { AdminAuthGuard } from '../admin-auth/guards/admin-auth.guard';
import { PermissionsGuard } from '../admin-auth/guards/permissions.guard';
import { RequirePermissions } from '../admin-auth/decorators/require-permissions.decorator';
import { CsrfGuard } from '../security/csrf.guard';

import { PrivateDocumentUploadService } from './private-document-upload.service';

const MAX_DOCUMENT_BYTES = 20 * 1024 * 1024;

@Controller('admin/media')
@UseGuards(AdminAuthGuard, PermissionsGuard)
export class PrivateDocumentUploadController {
  constructor(
    private readonly documents:
      PrivateDocumentUploadService,
  ) {}

  @Post('documents')
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

    let part: Awaited<
      ReturnType<FastifyRequest['file']>
    >;

    try {
      part = await request.file({
        limits: {
          fileSize: MAX_DOCUMENT_BYTES,
          files: 1,
          fields: 0,
          parts: 1,
        },
      });
    } catch (error) {
      if (
        (error as { statusCode?: number }).statusCode ===
        413
      ) {
        throw new PayloadTooLargeException({
          success: false,
          message: 'Maximum document upload size is 20 MB.',
        });
      }

      throw error;
    }

    if (!part || part.fieldname !== 'file') {
      throw new BadRequestException({
        success: false,
        message:
          'The multipart field "file" is required.',
      });
    }

    let buffer: Buffer;

    try {
      buffer = await part.toBuffer();
    } catch (error) {
      if (
        (error as { statusCode?: number }).statusCode ===
        413
      ) {
        throw new PayloadTooLargeException({
          success: false,
          message: 'Maximum document upload size is 20 MB.',
        });
      }

      throw error;
    }

    if (part.file.truncated) {
      throw new PayloadTooLargeException({
        success: false,
        message: 'Maximum document upload size is 20 MB.',
      });
    }

    const result = await this.documents.upload(
      buffer,
      part.filename,
      part.mimetype,
      admin.id,
    );

    return {
      success: true,
      message: 'Document uploaded successfully.',
      data: result,
    };
  }
}
