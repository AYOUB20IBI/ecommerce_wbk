
import { Inject, Injectable } from '@nestjs/common';
import { randomBytes, createHash } from 'node:crypto';
import { drizzle } from 'drizzle-orm/node-postgres';

import { DATABASE } from '../database/database.provider';
import { customerSessions } from '../database/schema/customer.schema';


import { UnauthorizedException } from '@nestjs/common';
import { and, eq, gt, isNull } from 'drizzle-orm';
import { customers } from '../database/schema/customer.schema';


type Database = ReturnType<typeof drizzle>;

@Injectable()
export class CustomerSessionService {
  constructor(
    @Inject(DATABASE)
    private readonly db: Database,
  ) {}

  async createSession(customerId: string) {
    const token = randomBytes(32).toString('hex');

    const tokenHash = createHash('sha256')
      .update(token)
      .digest('hex');

    const expiresAt = new Date(
      Date.now() + 7 * 24 * 60 * 60 * 1000,
    );

    await this.db.insert(customerSessions).values({
      customerId,
      tokenHash,
      expiresAt,
    });

    return {
      token,
      expiresAt,
    };
  }


  
  async findValidSession(token: string) {
    if (!/^[a-f0-9]{64}$/.test(token)) {
      throw new UnauthorizedException('Session invalide.');
    }

    const tokenHash = createHash('sha256')
      .update(token)
      .digest('hex');

    const [result] = await this.db
      .select({
        sessionId: customerSessions.id,
        customerId: customers.id,
        email: customers.email,
        firstName: customers.firstName,
        lastName: customers.lastName,
      })
      .from(customerSessions)
      .innerJoin(
        customers,
        eq(customerSessions.customerId, customers.id),
      )
      .where(
        and(
          eq(customerSessions.tokenHash, tokenHash),
          gt(customerSessions.expiresAt, new Date()),
          isNull(customerSessions.revokedAt),
          eq(customers.isActive, true),
        ),
      )
      .limit(1);

    if (!result) {
      throw new UnauthorizedException(
        'Session invalide ou expirée.',
      );
    }

    return result;
  }


  
  async revokeSession(token: string): Promise<void> {
    if (!/^[a-f0-9]{64}$/.test(token)) {
      return;
    }

    const tokenHash = createHash('sha256')
      .update(token)
      .digest('hex');

    await this.db
      .update(customerSessions)
      .set({
        revokedAt: new Date(),
      })
      .where(eq(customerSessions.tokenHash, tokenHash));
  }

}
