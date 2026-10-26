
import {
  Injectable,
  Inject,
  UnauthorizedException,
} from '@nestjs/common';
import { drizzle } from 'drizzle-orm/node-postgres';
import { eq } from 'drizzle-orm';
import * as argon2 from 'argon2';

import { DATABASE } from '../database/database.provider';
import { adminUsers } from '../database/schema/auth.schema';
import { AdminLoginDto } from './dto/admin-login.dto';

@Injectable()
export class AdminAuthService {
  constructor(
    @Inject(DATABASE)
    private readonly db: ReturnType<typeof drizzle>,
  ) {}

  
    private readonly dummyHashPromise = argon2.hash(
    'never-a-real-admin-password',
    {
        type: argon2.argon2id,
        memoryCost: 65536,
        timeCost: 3,
        parallelism: 1,
    },
    );


  async validateCredentials(input: AdminLoginDto) {
    const email = input.email.trim().toLowerCase();

    const [admin] = await this.db
      .select({
        id: adminUsers.id,
        email: adminUsers.email,
        firstName: adminUsers.firstName,
        lastName: adminUsers.lastName,
        passwordHash: adminUsers.passwordHash,
        isActive: adminUsers.isActive,
      })
      .from(adminUsers)
      .where(eq(adminUsers.email, email))
      .limit(1);

    // Valid encoded Argon2id hash, computed once.
    const dummyHash = await this.dummyHashPromise;

    const passwordValid = await argon2
      .verify(
        admin?.passwordHash ?? dummyHash,
        input.password,
      )
      .catch(() => false);

    if (!admin || !passwordValid || !admin.isActive) {
      throw new UnauthorizedException(
        'Email ou mot de passe incorrect.',
      );
    }

    return {
      id: admin.id,
      email: admin.email,
      firstName: admin.firstName,
      lastName: admin.lastName,
    };
  }
}
