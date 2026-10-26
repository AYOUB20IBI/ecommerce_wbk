
import { Inject, Injectable } from '@nestjs/common';
import { drizzle } from 'drizzle-orm/node-postgres';
import { eq, sql } from 'drizzle-orm';

import { DATABASE } from '../database/database.provider';
import {
  adminUserRoles,
  roles,
} from '../database/schema/auth.schema';

@Injectable()
export class RbacService {
  constructor(
    @Inject(DATABASE)
    private readonly db: ReturnType<typeof drizzle>,
  ) {}

  async getRoles(adminId: string): Promise<string[]> {
    const result = await this.db
      .select({
        name: roles.name,
      })
      .from(adminUserRoles)
      .innerJoin(
        roles,
        eq(adminUserRoles.roleId, roles.id),
      )
      .where(eq(adminUserRoles.userId, adminId));

    return result.map((row) => row.name);
  }

  async getPermissions(adminId: string): Promise<string[]> {
    const result = await this.db.execute<{
      permission: string | null;
    }>(sql`
      SELECT DISTINCT
        COALESCE(
          to_jsonb(p)->>'code',
          to_jsonb(p)->>'name',
          to_jsonb(p)->>'key'
        ) AS permission
      FROM admin_user_roles aur
      INNER JOIN roles r
        ON r.id = aur.role_id
      INNER JOIN role_permissions rp
        ON rp.role_id = r.id
      INNER JOIN permissions p
        ON p.id = rp.permission_id
      INNER JOIN admin_users a
        ON a.id = aur.user_id
      WHERE aur.user_id = ${adminId}::uuid
        AND a.is_active = true
    `);

    return result.rows
      .map((row) => row.permission)
      .filter(
        (permission): permission is string =>
          typeof permission === 'string',
      );
  }

  async hasAllPermissions(
    adminId: string,
    required: string[],
  ): Promise<boolean> {
    if (required.length === 0) return false;

    const permissions = new Set(
      await this.getPermissions(adminId),
    );

    return required.every((permission) =>
      permissions.has(permission),
    );
  }
}
