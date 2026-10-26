
import {
  BadRequestException,
  Body,
  Controller,
  Inject,
  NotFoundException,
  Param,
  Patch,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { FastifyRequest } from 'fastify';
import { z } from 'zod';
import * as argon2 from 'argon2';
import { and, eq, isNull } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';

import { DATABASE } from '../database/database.provider';

import {
  adminUsers,
  adminSessions,
} from '../database/schema/auth.schema';

import { auditLogs } from '../database/schema/permissions.schema';

import { AdminAuthGuard } from './guards/admin-auth.guard';
import { PermissionsGuard } from './guards/permissions.guard';
import { CsrfGuard } from '../security/csrf.guard';
import { RequirePermissions } from './decorators/require-permissions.decorator';

const passwordSchema = z
  .object({
    password: z.string().min(12).max(128),
    confirmPassword: z.string(),
  })
  .strict()
  .refine(
    (data) => data.password === data.confirmPassword,
    {
      path: ['confirmPassword'],
      message: 'Passwords do not match.',
    },
  );

@Controller('admin/users')
export class AdminPasswordController {
  constructor(
    @Inject(DATABASE)
    private readonly db: ReturnType<typeof drizzle>,
  ) {}

  @Patch(':id/password')
  @UseGuards(
    AdminAuthGuard,
    PermissionsGuard,
    CsrfGuard,
  )
  @RequirePermissions('roles.manage')
  @Throttle({
    default: {
      limit: 5,
      ttl: 60_000,
    },
  })
  async changePassword(
    @Param('id') id: string,
    @Body() body: unknown,
    @Req() request: FastifyRequest,
  ) {
    const idResult = z.uuid().safeParse(id);
    const parsed = passwordSchema.safeParse(body);

    if (!idResult.success || !parsed.success) {
      throw new BadRequestException({
        success: false,
        message: 'Invalid password request.',
        errors: parsed.success
          ? undefined
          : parsed.error.flatten().fieldErrors,
      });
    }

    const admin = request.admin;

    if (!admin) {
      throw new UnauthorizedException(
        'Admin authentication required.',
      );
    }

    // Capture the ID before entering the async transaction.
    // TypeScript can now guarantee actorId is a string.
    const actorId = admin.id;
    const targetUserId = idResult.data;

    const passwordHash = await argon2.hash(
      parsed.data.password,
      {
        type: argon2.argon2id,
        memoryCost: 65536,
        timeCost: 3,
        parallelism: 1,
      },
    );

    await this.db.transaction(async (tx) => {
      const [updated] = await tx
        .update(adminUsers)
        .set({
          passwordHash,
          updatedAt: new Date(),
        })
        .where(eq(adminUsers.id, targetUserId))
        .returning({
          id: adminUsers.id,
        });

      if (!updated) {
        throw new NotFoundException(
          'Admin account not found.',
        );
      }

      // Invalidate active sessions after changing the password.
      await tx
        .update(adminSessions)
        .set({
          revokedAt: new Date(),
        })
        .where(
          and(
            eq(adminSessions.userId, targetUserId),
            isNull(adminSessions.revokedAt),
          ),
        );

      // Never store passwords or password hashes in audit logs.
      await tx.insert(auditLogs).values({
        adminUserId: actorId,
        action: 'admin_user.password_changed',
        entityType: 'admin_user',
        entityId: targetUserId,
        metadata: {
          sessionsRevoked: true,
        },
      });
    });

    return {
      success: true,
      message:
        'Password changed successfully. Existing sessions revoked.',
    };
  }
}
