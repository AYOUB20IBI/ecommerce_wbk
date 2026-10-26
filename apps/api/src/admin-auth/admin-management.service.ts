
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { drizzle } from 'drizzle-orm/node-postgres';

import {
  and,
  asc,
  eq,
  inArray,
  isNull,
  sql,
} from 'drizzle-orm';

import { DATABASE } from '../database/database.provider';

import {
  adminSessions,
  adminUserRoles,
  adminUsers,
  roles,
} from '../database/schema/auth.schema';

import {
  auditLogs,
  permissions,
  rolePermissions,
} from '../database/schema/permissions.schema';

import type {
  CreateRoleInput,
  UpdateAdminInput,
  UpdateRoleInput,
} from './dto/manage-admin.dto';

type Database = ReturnType<typeof drizzle>;
type Transaction = Parameters<
  Parameters<Database['transaction']>[0]
>[0];

@Injectable()
export class AdminManagementService {
  constructor(
    @Inject(DATABASE)
    private readonly db: Database,
  ) {}

  private async lockManagement(tx: Transaction) {
    await tx.execute(
      sql`SELECT pg_advisory_xact_lock(317001, 2026)`,
    );
  }

  private async assertManagerRemains(
    tx: Transaction,
  ) {
    const result = await tx.execute<{
      total: number;
    }>(sql`
      SELECT COUNT(DISTINCT au.id)::int AS total
      FROM admin_users au
      JOIN admin_user_roles aur
        ON aur.user_id = au.id
      JOIN role_permissions rp
        ON rp.role_id = aur.role_id
      JOIN permissions p
        ON p.id = rp.permission_id
      WHERE au.is_active = TRUE
        AND p.code = 'roles.manage'
    `);

    const count = Number(
      result.rows[0]?.total ?? 0,
    );

    if (count < 1) {
      throw new ConflictException(
        'Cannot remove the last active access manager.',
      );
    }
  }

  private async revokeUserSessions(
    tx: Transaction,
    userIds: string[],
  ) {
    const uniqueIds = [...new Set(userIds)];

    if (uniqueIds.length === 0) {
      return;
    }

    await tx
      .update(adminSessions)
      .set({
        revokedAt: new Date(),
      })
      .where(
        and(
          inArray(adminSessions.userId, uniqueIds),
          isNull(adminSessions.revokedAt),
        ),
      );
  }

  private async writeAudit(
    tx: Transaction,
    actorId: string,
    action: string,
    entityType: string,
    entityId: string,
    metadata: Record<string, unknown>,
  ) {
    await tx.insert(auditLogs).values({
      adminUserId: actorId,
      action,
      entityType,
      entityId,
      metadata,
    });
  }

  private async getRoleUsers(
    tx: Transaction,
    roleId: string,
  ): Promise<string[]> {
    const users = await tx
      .select({
        userId: adminUserRoles.userId,
      })
      .from(adminUserRoles)
      .where(eq(adminUserRoles.roleId, roleId));

    return users.map((user) => user.userId);
  }

  private async validatePermissions(
    tx: Transaction,
    permissionIds: string[],
  ) {
    if (permissionIds.length === 0) {
      return;
    }

    const found = await tx
      .select({
        id: permissions.id,
      })
      .from(permissions)
      .where(
        inArray(permissions.id, permissionIds),
      );

    if (found.length !== permissionIds.length) {
      throw new BadRequestException(
        'One or more permission IDs are invalid.',
      );
    }
  }

  private async ensureRoleNameAllowed(
    tx: Transaction,
    name: string,
    excludeId?: string,
  ) {
    if (name === 'super_admin') {
      throw new ForbiddenException(
        'The super_admin role name is reserved.',
      );
    }

    const matches = await tx
      .select({
        id: roles.id,
      })
      .from(roles)
      .where(eq(roles.name, name))
      .limit(1);

    if (
      matches.length > 0 &&
      matches[0].id !== excludeId
    ) {
      throw new ConflictException(
        'Role name already exists.',
      );
    }
  }

  // ----------------------------
  // ADMIN USERS
  // ----------------------------

  async getUser(id: string) {
    const [user] = await this.db
      .select({
        id: adminUsers.id,
        email: adminUsers.email,
        firstName: adminUsers.firstName,
        lastName: adminUsers.lastName,
        isActive: adminUsers.isActive,
        createdAt: adminUsers.createdAt,
        updatedAt: adminUsers.updatedAt,
      })
      .from(adminUsers)
      .where(eq(adminUsers.id, id))
      .limit(1);

    if (!user) {
      throw new NotFoundException(
        'Admin account not found.',
      );
    }

    const assignedRoles = await this.db
      .select({
        id: roles.id,
        name: roles.name,
      })
      .from(adminUserRoles)
      .innerJoin(
        roles,
        eq(roles.id, adminUserRoles.roleId),
      )
      .where(eq(adminUserRoles.userId, id));

    return {
      ...user,
      roles: assignedRoles,
    };
  }

  async updateUser(
    id: string,
    input: UpdateAdminInput,
    actorId: string,
  ) {
    try {
      return await this.db.transaction(
        async (tx) => {
          await this.lockManagement(tx);

          const [existing] = await tx
            .select({
              id: adminUsers.id,
            })
            .from(adminUsers)
            .where(eq(adminUsers.id, id))
            .limit(1);

          if (!existing) {
            throw new NotFoundException(
              'Admin account not found.',
            );
          }

          const [updated] = await tx
            .update(adminUsers)
            .set({
              ...input,
              updatedAt: new Date(),
            })
            .where(eq(adminUsers.id, id))
            .returning({
              id: adminUsers.id,
              email: adminUsers.email,
              firstName: adminUsers.firstName,
              lastName: adminUsers.lastName,
              isActive: adminUsers.isActive,
              updatedAt: adminUsers.updatedAt,
            });

          await this.writeAudit(
            tx,
            actorId,
            'admin_user.updated',
            'admin_user',
            id,
            {
              fields: Object.keys(input),
            },
          );

          return updated;
        },
      );
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
          'Email already in use.',
        );
      }

      throw error;
    }
  }

  async setUserRoles(
    id: string,
    roleIds: string[],
    actorId: string,
  ) {
    return this.db.transaction(
      async (tx) => {
        await this.lockManagement(tx);

        if (id === actorId) {
          throw new ForbiddenException(
            'You cannot change your own roles.',
          );
        }

        const [user] = await tx
          .select({
            id: adminUsers.id,
          })
          .from(adminUsers)
          .where(eq(adminUsers.id, id))
          .limit(1);

        if (!user) {
          throw new NotFoundException(
            'Admin account not found.',
          );
        }

        const selectedRoles = await tx
          .select({
            id: roles.id,
            name: roles.name,
          })
          .from(roles)
          .where(
            inArray(roles.id, roleIds),
          );

        if (selectedRoles.length !== roleIds.length) {
          throw new BadRequestException(
            'One or more roles do not exist.',
          );
        }

        await tx
          .delete(adminUserRoles)
          .where(
            eq(adminUserRoles.userId, id),
          );

        await tx
          .insert(adminUserRoles)
          .values(
            roleIds.map((roleId) => ({
              userId: id,
              roleId,
            })),
          );

        await this.assertManagerRemains(tx);

        await this.revokeUserSessions(
          tx,
          [id],
        );

        await this.writeAudit(
          tx,
          actorId,
          'admin_user.roles_updated',
          'admin_user',
          id,
          {
            roleIds,
          },
        );

        return {
          id,
          roles: selectedRoles,
        };
      },
    );
  }

  async setUserStatus(
    id: string,
    isActive: boolean,
    actorId: string,
  ) {
    return this.db.transaction(
      async (tx) => {
        await this.lockManagement(tx);

        if (id === actorId && !isActive) {
          throw new ForbiddenException(
            'You cannot disable your own account.',
          );
        }

        const [updated] = await tx
          .update(adminUsers)
          .set({
            isActive,
            updatedAt: new Date(),
          })
          .where(eq(adminUsers.id, id))
          .returning({
            id: adminUsers.id,
            isActive: adminUsers.isActive,
          });

        if (!updated) {
          throw new NotFoundException(
            'Admin account not found.',
          );
        }

        await this.assertManagerRemains(tx);

        if (!isActive) {
          await this.revokeUserSessions(
            tx,
            [id],
          );
        }

        await this.writeAudit(
          tx,
          actorId,
          'admin_user.status_updated',
          'admin_user',
          id,
          {
            isActive,
          },
        );

        return updated;
      },
    );
  }

  // ----------------------------
  // PERMISSIONS
  // ----------------------------

  async listPermissions() {
    return this.db
      .select({
        id: permissions.id,
        code: permissions.code,
        description: permissions.description,
      })
      .from(permissions)
      .orderBy(
        asc(permissions.code),
      );
  }

  // ----------------------------
  // ROLES
  // ----------------------------

  async listRoles() {
    const allRoles = await this.db
      .select({
        id: roles.id,
        name: roles.name,
        description: roles.description,
      })
      .from(roles)
      .orderBy(
        asc(roles.name),
      );

    const assignedPermissions = await this.db
      .select({
        roleId: rolePermissions.roleId,
        id: permissions.id,
        code: permissions.code,
      })
      .from(rolePermissions)
      .innerJoin(
        permissions,
        eq(
          rolePermissions.permissionId,
          permissions.id,
        ),
      );

    return allRoles.map((role) => ({
      ...role,
      permissions: assignedPermissions
        .filter(
          (permission) =>
            permission.roleId === role.id,
        )
        .map((permission) => ({
          id: permission.id,
          code: permission.code,
        })),
    }));
  }

  async getRole(id: string) {
    const [role] = await this.db
      .select({
        id: roles.id,
        name: roles.name,
        description: roles.description,
      })
      .from(roles)
      .where(eq(roles.id, id))
      .limit(1);

    if (!role) {
      throw new NotFoundException(
        'Role not found.',
      );
    }

    const assignedPermissions = await this.db
      .select({
        id: permissions.id,
        code: permissions.code,
        description: permissions.description,
      })
      .from(rolePermissions)
      .innerJoin(
        permissions,
        eq(
          rolePermissions.permissionId,
          permissions.id,
        ),
      )
      .where(
        eq(rolePermissions.roleId, id),
      )
      .orderBy(asc(permissions.code));

    return {
      ...role,
      permissions: assignedPermissions,
    };
  }

  async createRole(
    input: CreateRoleInput,
    actorId: string,
  ) {
    try {
      return await this.db.transaction(
        async (tx) => {
          await this.lockManagement(tx);

          await this.ensureRoleNameAllowed(
            tx,
            input.name,
          );

          await this.validatePermissions(
            tx,
            input.permissionIds,
          );

          const [role] = await tx
            .insert(roles)
            .values({
              name: input.name,
              description:
                input.description ?? null,
            })
            .returning({
              id: roles.id,
              name: roles.name,
              description: roles.description,
            });

          if (input.permissionIds.length > 0) {
            await tx
              .insert(rolePermissions)
              .values(
                input.permissionIds.map(
                  (permissionId) => ({
                    roleId: role.id,
                    permissionId,
                  }),
                ),
              );
          }

          await this.writeAudit(
            tx,
            actorId,
            'role.created',
            'role',
            role.id,
            {
              name: role.name,
              permissionIds:
                input.permissionIds,
            },
          );

          return {
            ...role,
            permissionIds:
              input.permissionIds,
          };
        },
      );
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
          'Role name already exists.',
        );
      }

      throw error;
    }
  }

  async updateRole(
    id: string,
    input: UpdateRoleInput,
    actorId: string,
  ) {
    return this.db.transaction(
      async (tx) => {
        await this.lockManagement(tx);

        const [existing] = await tx
          .select({
            name: roles.name,
          })
          .from(roles)
          .where(eq(roles.id, id))
          .limit(1);

        if (!existing) {
          throw new NotFoundException(
            'Role not found.',
          );
        }

        if (
          existing.name === 'super_admin' &&
          input.name !== undefined &&
          input.name !== existing.name
        ) {
          throw new ForbiddenException(
            'Cannot rename super_admin.',
          );
        }

        if (
          input.name !== undefined &&
          input.name !== existing.name
        ) {
          await this.ensureRoleNameAllowed(
            tx,
            input.name,
            id,
          );
        }

        const [updated] = await tx
          .update(roles)
          .set(input)
          .where(eq(roles.id, id))
          .returning({
            id: roles.id,
            name: roles.name,
            description: roles.description,
          });

        await this.writeAudit(
          tx,
          actorId,
          'role.updated',
          'role',
          id,
          {
            fields: Object.keys(input),
          },
        );

        return updated;
      },
    );
  }

  async setRolePermissions(
    id: string,
    permissionIds: string[],
    actorId: string,
  ) {
    return this.db.transaction(
      async (tx) => {
        await this.lockManagement(tx);

        const [existing] = await tx
          .select({
            name: roles.name,
          })
          .from(roles)
          .where(eq(roles.id, id))
          .limit(1);

        if (!existing) {
          throw new NotFoundException(
            'Role not found.',
          );
        }

        if (existing.name === 'super_admin') {
          throw new ForbiddenException(
            'Cannot modify super_admin permissions.',
          );
        }

        await this.validatePermissions(
          tx,
          permissionIds,
        );

        await tx
          .delete(rolePermissions)
          .where(
            eq(rolePermissions.roleId, id),
          );

        if (permissionIds.length > 0) {
          await tx
            .insert(rolePermissions)
            .values(
              permissionIds.map(
                (permissionId) => ({
                  roleId: id,
                  permissionId,
                }),
              ),
            );
        }

        await this.assertManagerRemains(tx);

        const affectedUsers =
          await this.getRoleUsers(tx, id);

        await this.revokeUserSessions(
          tx,
          affectedUsers,
        );

        await this.writeAudit(
          tx,
          actorId,
          'role.permissions_updated',
          'role',
          id,
          {
            permissionIds,
            affectedUsersCount:
              affectedUsers.length,
          },
        );

        return {
          id,
          permissionIds,
          revokedUserCount:
            affectedUsers.length,
        };
      },
    );
  }

  async deleteRole(
    id: string,
    actorId: string,
  ) {
    return this.db.transaction(
      async (tx) => {
        await this.lockManagement(tx);

        const [existing] = await tx
          .select({
            name: roles.name,
          })
          .from(roles)
          .where(eq(roles.id, id))
          .limit(1);

        if (!existing) {
          throw new NotFoundException(
            'Role not found.',
          );
        }

        if (existing.name === 'super_admin') {
          throw new ForbiddenException(
            'Cannot delete super_admin.',
          );
        }

        const assignedUsers =
          await this.getRoleUsers(tx, id);

        if (assignedUsers.length > 0) {
          throw new ConflictException(
            'Role is assigned to admin accounts. Reassign users first.',
          );
        }

        await tx
          .delete(roles)
          .where(eq(roles.id, id));

        await this.assertManagerRemains(tx);

        await this.writeAudit(
          tx,
          actorId,
          'role.deleted',
          'role',
          id,
          {
            name: existing.name,
          },
        );

        return {
          deleted: true,
          id,
        };
      },
    );
  }
}
