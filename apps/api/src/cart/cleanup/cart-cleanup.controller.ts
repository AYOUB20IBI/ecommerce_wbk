
import {
  BadRequestException,
  Controller,
  Get,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';

import { z } from 'zod';

import {
  AdminAuthGuard,
} from '../../admin-auth/guards/admin-auth.guard';

import {
  PermissionsGuard,
} from '../../admin-auth/guards/permissions.guard';

import {
  RequirePermissions,
} from '../../admin-auth/decorators/require-permissions.decorator';

import {
  CsrfGuard,
} from '../../security/csrf.guard';

import {
  CartCleanupService,
} from './cart-cleanup.service';

const logsQuerySchema = z.strictObject({
  limit: z.coerce.number()
    .int()
    .min(1)
    .max(100)
    .default(20),
});

@Controller('admin/cart-cleanup')
@UseGuards(
  AdminAuthGuard,
  PermissionsGuard,
)
export class CartCleanupController {
  constructor(
    private readonly cleanup: CartCleanupService,
  ) {}

  // ========================================
  // RUN MANUAL CLEANUP
  // ========================================

  @Post('run')
  @UseGuards(CsrfGuard)
  @RequirePermissions('products.purge')
  async run() {
    const result = await this.cleanup.run();

    return {
      success: true,
      message:
        'Nettoyage des paniers terminé.',
      data: result,
    };
  }

  // ========================================
  // VIEW CLEANUP LOGS
  // ========================================

  @Get('logs')
  @RequirePermissions('products.purge')
  async logs(@Query() query: unknown) {
    const result = logsQuerySchema.safeParse(
      query,
    );

    if (!result.success) {
      throw new BadRequestException({
        success: false,
        message:
          'Paramètres de recherche invalides.',
        errors: {
          limit: [
            'La limite doit être entre 1 et 100.',
          ],
        },
      });
    }

    return {
      success: true,
      message:
        'Historique des nettoyages récupéré.',
      data: await this.cleanup.getLogs(
        result.data.limit,
      ),
    };
  }
}
