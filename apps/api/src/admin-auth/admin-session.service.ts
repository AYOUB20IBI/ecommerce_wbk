
import {
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import { and, eq, gt, isNull } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';

import { DATABASE } from '../database/database.provider';
import {
  adminSessions,
  adminUsers,
} from '../database/schema/auth.schema';

@Injectable()
export class AdminSessionService {
  constructor(
    @Inject(DATABASE)
    private readonly db: ReturnType<typeof drizzle>,
  ) {}

  async createSession(adminUserId: string) {
    const token = randomBytes(32).toString('hex');

    const tokenHash = createHash('sha256')
      .update(token)
      .digest('hex');

    const expiresAt = new Date(
      Date.now() + 12 * 60 * 60 * 1000,
    );

    await this.db.insert(adminSessions).values({
      userId: adminUserId,
      tokenHash,
      expiresAt,
    });

    return { token, expiresAt };
  }

  async findValidSession(token: string) {
    if (!/^[a-f0-9]{64}$/.test(token)) {
      throw new UnauthorizedException('Session invalide.');
    }

    const tokenHash = createHash('sha256')
      .update(token)
      .digest('hex');

    const [session] = await this.db
      .select({
        sessionId: adminSessions.id,
        adminId: adminUsers.id,
        email: adminUsers.email,
        firstName: adminUsers.firstName,
        lastName: adminUsers.lastName,
      })
      .from(adminSessions)
      .innerJoin(
        adminUsers,
        eq(adminSessions.userId, adminUsers.id),
      )
      .where(
        and(
          eq(adminSessions.tokenHash, tokenHash),
          gt(adminSessions.expiresAt, new Date()),
          isNull(adminSessions.revokedAt),
          eq(adminUsers.isActive, true),
        ),
      )
      .limit(1);

    if (!session) {
      throw new UnauthorizedException(
        'Session invalide ou expirée.',
      );
    }

    return session;
  }

  async revokeSession(token: string): Promise<void> {
    if (!/^[a-f0-9]{64}$/.test(token)) {
      return;
    }

    const tokenHash = createHash('sha256')
      .update(token)
      .digest('hex');

    await this.db
      .update(adminSessions)
      .set({ revokedAt: new Date() })
      .where(
        and(
          eq(adminSessions.tokenHash, tokenHash),
          isNull(adminSessions.revokedAt),
        ),
      );
  }
}
