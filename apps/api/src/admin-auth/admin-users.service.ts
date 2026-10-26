
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
} from '@nestjs/common';

import { drizzle } from 'drizzle-orm/node-postgres';
import {
  asc,
  count,
  desc,
  eq,
  ilike,
  inArray,
  or,
} from 'drizzle-orm';

import * as argon2 from 'argon2';

import { DATABASE } from '../database/database.provider';

import {
  adminUsers,
  adminUserRoles,
  roles,
} from '../database/schema/auth.schema';

import { auditLogs } from '../database/schema/permissions.schema';

import type {
  CreateAdminUserDto,
} from './dto/create-admin-user.dto';

@Injectable()
export class AdminUsersService {
  constructor(
    @Inject(DATABASE)
    private readonly db: ReturnType<typeof drizzle>,
  ) {}

  async listUsers(page = 1, limit = 20, search = '') {
    const offset = (page - 1) * limit;
    const keyword = search.trim();

    const condition = keyword
      ? or(
          ilike(adminUsers.email, `%${keyword}%`),
          ilike(adminUsers.firstName, `%${keyword}%`),
          ilike(adminUsers.lastName, `%${keyword}%`),
        )
      : undefined;

    const [users, totals] = await Promise.all([
      this.db
        .select({
          id: adminUsers.id,
          email: adminUsers.email,
          firstName: adminUsers.firstName,
          lastName: adminUsers.lastName,
          isActive: adminUsers.isActive,
          createdAt: adminUsers.createdAt,
        })
        .from(adminUsers)
        .where(condition)
        .orderBy(desc(adminUsers.createdAt))
        .limit(limit)
        .offset(offset),

      this.db
        .select({ total: count() })
        .from(adminUsers)
        .where(condition),
    ]);

    const userIds = users.map((user) => user.id);

    const assignedRoles =
      userIds.length > 0
        ? await this.db
            .select({
              userId: adminUserRoles.userId,
              roleId: roles.id,
              roleName: roles.name,
            })
            .from(adminUserRoles)
            .innerJoin(
              roles,
              eq(adminUserRoles.roleId, roles.id),
            )
            .where(inArray(adminUserRoles.userId, userIds))
        : [];

    return {
      items: users.map((user) => ({
        ...user,
        roles: assignedRoles
          .filter((role) => role.userId === user.id)
          .map((role) => ({
            id: role.roleId,
            name: role.roleName,
          })),
      })),
      pagination: {
        page,
        limit,
        total: totals[0]?.total ?? 0,
        totalPages: Math.ceil(
          (totals[0]?.total ?? 0) / limit,
        ),
      },
    };
  }

  async listRoles() {
    return this.db
      .select({
        id: roles.id,
        name: roles.name,
        description: roles.description,
      })
      .from(roles)
      .orderBy(asc(roles.name));
  }

  async createUser(
    input: CreateAdminUserDto,
    actorId: string,
  ) {
    const email = input.email.trim().toLowerCase();

    const existing = await this.db
      .select({ id: adminUsers.id })
      .from(adminUsers)
      .where(eq(adminUsers.email, email))
      .limit(1);

    if (existing.length > 0) {
      throw new ConflictException(
        'An admin account with this email already exists.',
      );
    }

    const selectedRoles = await this.db
      .select({
        id: roles.id,
        name: roles.name,
      })
      .from(roles)
      .where(inArray(roles.id, input.roleIds));

    if (selectedRoles.length !== input.roleIds.length) {
      throw new BadRequestException(
        'One or more selected roles do not exist.',
      );
    }

    const passwordHash = await argon2.hash(
      input.password,
      {
        type: argon2.argon2id,
        memoryCost: 65536,
        timeCost: 3,
        parallelism: 1,
      },
    );

    try {
      return await this.db.transaction(async (tx) => {
        const [newUser] = await tx
          .insert(adminUsers)
          .values({
            email,
            firstName: input.firstName,
            lastName: input.lastName,
            passwordHash,
            isActive: true,
          })
          .returning({
            id: adminUsers.id,
            email: adminUsers.email,
            firstName: adminUsers.firstName,
            lastName: adminUsers.lastName,
            isActive: adminUsers.isActive,
            createdAt: adminUsers.createdAt,
          });

        if (!newUser) {
          throw new Error('Admin creation failed.');
        }

        await tx.insert(adminUserRoles).values(
          input.roleIds.map((roleId) => ({
            userId: newUser.id,
            roleId,
          })),
        );

        await tx.insert(auditLogs).values({
          adminUserId: actorId,
          action: 'admin_user.created',
          entityType: 'admin_user',
          entityId: newUser.id,
          metadata: {
            email: newUser.email,
            roleIds: input.roleIds,
          },
        });

        return {
          ...newUser,
          roles: selectedRoles.map((role) => ({
            id: role.id,
            name: role.name,
          })),
        };
      });
    } catch (error) {
      // PostgreSQL unique_violation; catches a race between
      // the initial email check and the actual INSERT.
      const databaseError = error as {
        code?: string;
        cause?: { code?: string };
      };

      if (
        databaseError.code === '23505' ||
        databaseError.cause?.code === '23505'
      ) {
        throw new ConflictException(
          'An admin account with this email already exists.',
        );
      }

      throw error;
    }
  }
}
