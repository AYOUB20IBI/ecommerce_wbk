
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

function validateId(id: string): string {
  const parsed = mediaIdSchema.safeParse(id);

  if (!parsed.success) {
    throw new BadRequestException({
      success: false,
      message: 'Identifiant invalide.',
      errors: {
        id: ['UUID invalide.'],
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
      | { success: true; data: T }
      | { success: false; error: {
          flatten: () => {
            fieldErrors: Record<string, string[] | undefined>;
          };
        } };
  },
  value: unknown,
): T {
  const result = schema.safeParse(value);

  if (!result.success) {
    throw new BadRequestException({
      success: false,
      message: 'Les données fournies sont invalides.',
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
  ) {}

  // -------------------------------------
  // POST /admin/media/upload
  // -------------------------------------

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
        message: 'multipart/form-data requis.',
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
        throw new BadRequestException({
          success: false,
          message: 'Le fichier dépasse la taille autorisée.',
        });
      }

      throw error;
    }

    if (!file || file.fieldname !== 'file') {
      throw new BadRequestException({
        success: false,
        message: 'Le champ file est obligatoire.',
      });
    }

    const buffer = await file.toBuffer();

    // Multipart may report a truncated stream.
    if (file.file.truncated) {
      throw new BadRequestException({
        success: false,
        message: 'Le fichier dépasse 5 Mo.',
      });
    }

    return {
      success: true,
      message: 'Image ajoutée avec succès.',
      data: await this.service.uploadImage(
        buffer,
        file.filename,
        file.mimetype,
        admin.id,
      ),
    };
  }

  // -------------------------------------
  // POST /admin/media/external
  // -------------------------------------

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

    return {
      success: true,
      message: 'Image externe ajoutée avec succès.',
      data: await this.service.addExternal(
        input,
        admin.id,
      ),
    };
  }

  // -------------------------------------
  // GET /admin/media
  // -------------------------------------

  @Get()
  @RequirePermissions('media.read')
  async list(@Query() query: unknown) {
    const input = validateBody(
      mediaListSchema,
      query,
    );

    return {
      success: true,
      message: 'Images récupérées avec succès.',
      data: await this.service.findAll(
        input.page,
        input.limit,
      ),
    };
  }

  // -------------------------------------
  // GET /admin/media/:id
  // -------------------------------------

  @Get(':id')
  @RequirePermissions('media.read')
  async one(@Param('id') id: string) {
    return {
      success: true,
      message: 'Image récupérée avec succès.',
      data: await this.service.findOne(
        validateId(id),
      ),
    };
  }

  // -------------------------------------
  // GET /admin/media/:id/activity
  // -------------------------------------

  @Get(':id/activity')
  @RequirePermissions('media.read')
  async activity(@Param('id') id: string) {
    return {
      success: true,
      message: 'Historique récupéré avec succès.',
      data: await this.service.activity(
        validateId(id),
      ),
    };
  }

  // -------------------------------------
  // PATCH /admin/media/:id
  // -------------------------------------

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
      message: 'Image modifiée avec succès.',
      data: await this.service.update(
        validateId(id),
        input,
        admin.id,
      ),
    };
  }

  // -------------------------------------
  // DELETE /admin/media/:id
  // -------------------------------------


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
        ? 'Suppression programmée avec succès.'
        : 'Image déjà supprimée ou suppression terminée.',
      data,
    };
  }

}
