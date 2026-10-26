
import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Get,
  Inject,
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
import {
  auditLogs,
} from '../database/schema/permissions.schema';
import { AdminAuthGuard } from './guards/admin-auth.guard';
import { CsrfGuard } from '../security/csrf.guard';

const profileSchema = z.object({
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().min(1).max(100),
  email: z.email().max(255)
    .transform((value) => value.trim().toLowerCase()),
}).strict();

const passwordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(12).max(128),
  confirmPassword: z.string(),
}).strict().refine(
  (value) => value.newPassword === value.confirmPassword,
  {
    message: 'Passwords do not match.',
    path: ['confirmPassword'],
  },
);

function actorId(request: FastifyRequest): string {
  if (!request.admin) {
    throw new UnauthorizedException(
      'Admin authentication required.',
    );
  }

  return request.admin.id;
}

function validate<T extends z.ZodType>(
  schema: T,
  body: unknown,
): z.output<T> {
  const parsed = schema.safeParse(body);

  if (!parsed.success) {
    throw new BadRequestException({
      success: false,
      message: 'Validation failed.',
      errors: parsed.error.flatten().fieldErrors,
    });
  }

  return parsed.data;
}

@Controller('admin/profile')
@UseGuards(AdminAuthGuard)
export class AdminProfileController {
  constructor(
    @Inject(DATABASE)
    private readonly db: ReturnType<typeof drizzle>,
  ) {}

  @Get()
  async getProfile(@Req() request: FastifyRequest) {
    const id = actorId(request);

    const [admin] = await this.db
      .select({
        id: adminUsers.id,
        firstName: adminUsers.firstName,
        lastName: adminUsers.lastName,
        email: adminUsers.email,
        isActive: adminUsers.isActive,
        createdAt: adminUsers.createdAt,
        updatedAt: adminUsers.updatedAt,
      })
      .from(adminUsers)
      .where(eq(adminUsers.id, id))
      .limit(1);

    if (!admin || !admin.isActive) {
      throw new UnauthorizedException();
    }

    return {
      success: true,
      data: admin,
    };
  }

  @Patch()
  @UseGuards(AdminAuthGuard, CsrfGuard)
  async updateProfile(
    @Req() request: FastifyRequest,
    @Body() body: unknown,
  ) {
    const id = actorId(request);
    const data = validate(profileSchema, body);

    try {
      return await this.db.transaction(async (tx) => {
        const [updated] = await tx
          .update(adminUsers)
          .set({
            firstName: data.firstName,
            lastName: data.lastName,
            email: data.email,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(adminUsers.id, id),
              eq(adminUsers.isActive, true),
            ),
          )
          .returning({
            id: adminUsers.id,
            firstName: adminUsers.firstName,
            lastName: adminUsers.lastName,
            email: adminUsers.email,
            updatedAt: adminUsers.updatedAt,
          });

        if (!updated) {
          throw new UnauthorizedException();
        }

        await tx.insert(auditLogs).values({
          adminUserId: id,
          action: 'admin_profile.updated',
          entityType: 'admin_user',
          entityId: id,
          metadata: {
            changedFields: [
              'firstName',
              'lastName',
              'email',
            ],
          },
        });

        return {
          success: true,
          message: 'Profile updated successfully.',
          data: updated,
        };
      });
    } catch (error) {
      const dbError = error as {
        code?: string;
        cause?: { code?: string };
      };

      if (
        dbError.code === '23505' ||
        dbError.cause?.code === '23505'
      ) {
        throw new ConflictException(
          'This email is already in use.',
        );
      }

      throw error;
    }
  }

  @Patch('password')
  @UseGuards(AdminAuthGuard, CsrfGuard)
  @Throttle({
    default: {
      limit: 5,
      ttl: 60_000,
    },
  })
  async updatePassword(
    @Req() request: FastifyRequest,
    @Body() body: unknown,
  ) {
    const id = actorId(request);
    const data = validate(passwordSchema, body);

    // Serialize password changes for this specific account.
    // Re-verify the current password inside the transaction.
    await this.db.transaction(async (tx) => {
      const [admin] = await tx
        .select({
          id: adminUsers.id,
          passwordHash: adminUsers.passwordHash,
        })
        .from(adminUsers)
        .where(
          and(
            eq(adminUsers.id, id),
            eq(adminUsers.isActive, true),
          ),
        )
        .for('update')
        .limit(1);

      if (!admin) {
        throw new UnauthorizedException();
      }

      const correct = await argon2.verify(
        admin.passwordHash,
        data.currentPassword,
      ).catch(() => false);

      if (!correct) {
        throw new BadRequestException(
          'Current password is incorrect.',
        );
      }

      const samePassword = await argon2.verify(
        admin.passwordHash,
        data.newPassword,
      ).catch(() => false);

      if (samePassword) {
        throw new BadRequestException(
          'New password must differ from current password.',
        );
      }

      const passwordHash = await argon2.hash(
        data.newPassword,
        {
          type: argon2.argon2id,
          memoryCost: 65536,
          timeCost: 3,
          parallelism: 1,
        },
      );

      await tx
        .update(adminUsers)
        .set({
          passwordHash,
          updatedAt: new Date(),
        })
        .where(eq(adminUsers.id, id));

      await tx
        .update(adminSessions)
        .set({
          revokedAt: new Date(),
        })
        .where(
          and(
            eq(adminSessions.userId, id),
            isNull(adminSessions.revokedAt),
          ),
        );

      await tx.insert(auditLogs).values({
        adminUserId: id,
        action: 'admin_profile.password_changed',
        entityType: 'admin_user',
        entityId: id,
        metadata: {
          sessionsRevoked: true,
        },
      });
    });

    return {
      success: true,
      message:
        'Password changed. Please sign in again.',
      data: {
        sessionsRevoked: true,
      },
    };
  }
}
