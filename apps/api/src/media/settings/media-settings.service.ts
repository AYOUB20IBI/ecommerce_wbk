
import {
  ForbiddenException,
  Inject,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';

import { drizzle } from 'drizzle-orm/node-postgres';
import { eq, sql } from 'drizzle-orm';

import { DATABASE } from '../../database/database.provider';

import {
  adminUserRoles,
  adminUsers,
  roles,
} from '../../database/schema/auth.schema';

import {
  mediaSettingsSchema,
  type MediaSettingsInput,
} from './media-settings.dto';

type SettingsRow = {
  configuration: unknown;
  updated_at: Date;
};

@Injectable()
export class MediaSettingsService {
  constructor(
    @Inject(DATABASE)
    private readonly db: ReturnType<typeof drizzle>,
  ) {}

  // Only active Admin / Super Admin roles.
  // Store Manager never receives access, even
  // when media.update is assigned.
  async assertAdmin(adminId: string): Promise<void> {
    const assignedRoles = await this.db
      .select({
        name: roles.name,
        active: adminUsers.isActive,
      })
      .from(adminUserRoles)
      .innerJoin(
        roles,
        eq(adminUserRoles.roleId, roles.id),
      )
      .innerJoin(
        adminUsers,
        eq(adminUserRoles.userId, adminUsers.id),
      )
      .where(eq(adminUserRoles.userId, adminId));

    const allowed = assignedRoles.some((role) => {
      if (!role.active) return false;

      const normalized = role.name
        .trim()
        .toLowerCase()
        .replace(/[_-]+/g, ' ');

      return (
        normalized === 'admin' ||
        normalized === 'super admin'
      );
    });

    if (!allowed) {
      throw new ForbiddenException({
        success: false,
        message: 'Admin role required.',
      });
    }
  }

  private async getRow(): Promise<SettingsRow> {
    const result = await this.db.execute<SettingsRow>(sql`
      SELECT configuration, updated_at
      FROM media_upload_settings
      WHERE id = 1
      LIMIT 1
    `);

    const row = result.rows[0];

    if (!row) {
      throw new InternalServerErrorException({
        success: false,
        message: 'Media settings have not been initialized.',
      });
    }

    return row;
  }

  private parseConfiguration(
    configuration: unknown,
  ): MediaSettingsInput {
    const parsed = mediaSettingsSchema.safeParse(
      configuration,
    );

    if (!parsed.success) {
      throw new InternalServerErrorException({
        success: false,
        message: 'Stored media settings are invalid.',
      });
    }

    return parsed.data;
  }

  // Internal read, used by the upload validators.
  // This intentionally does not perform an admin-role
  // check because the validation pipeline can run
  // for other authorized media users.
  async getConfiguration(): Promise<MediaSettingsInput> {
    const row = await this.getRow();

    return this.parseConfiguration(row.configuration);
  }

  // Admin-only settings read.
  async getForAdmin(adminId: string) {
    await this.assertAdmin(adminId);

    const row = await this.getRow();

    return {
      configuration: this.parseConfiguration(
        row.configuration,
      ),
      updatedAt: row.updated_at,
    };
  }

  // Admin-only settings update.
  async updateForAdmin(
    adminId: string,
    input: MediaSettingsInput,
  ) {
    await this.assertAdmin(adminId);

    const parsed = mediaSettingsSchema.safeParse(input);

    if (!parsed.success) {
      throw new InternalServerErrorException({
        success: false,
        message: 'Invalid internal media settings input.',
      });
    }

    const configuration = parsed.data;
    const payload = JSON.stringify(configuration);

    const result = await this.db.execute<SettingsRow>(sql`
      INSERT INTO media_upload_settings (
        id,
        configuration,
        updated_by,
        updated_at
      )
      VALUES (
        1,
        ${payload}::jsonb,
        ${adminId}::uuid,
        NOW()
      )
      ON CONFLICT (id)
      DO UPDATE SET
        configuration = EXCLUDED.configuration,
        updated_by = EXCLUDED.updated_by,
        updated_at = NOW()
      RETURNING configuration, updated_at
    `);

    const updated = result.rows[0];

    if (!updated) {
      throw new InternalServerErrorException({
        success: false,
        message: 'Media settings update failed.',
      });
    }

    return {
      configuration: this.parseConfiguration(
        updated.configuration,
      ),
      updatedAt: updated.updated_at,
    };
  }
}
