
import 'dotenv/config';

import {
  Inject,
  Injectable,
  Module,
  OnModuleDestroy,
} from '@nestjs/common';

import { ScheduleModule } from '@nestjs/schedule';
import { Pool } from 'pg';

import { AdminAuthModule } from '../../admin-auth/admin-auth.module';
import { SecurityModule } from '../../security/security.module';

import {
  CartCleanupController,
} from './cart-cleanup.controller';

import {
  CartCleanupService,
} from './cart-cleanup.service';

const CART_CLEANUP_POOL = 'CART_CLEANUP_POOL';

function createCleanupPool(): Pool {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error(
      'DATABASE_URL is missing.',
    );
  }

  return new Pool({
    connectionString: databaseUrl,
    max: 2,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
    maxLifetimeSeconds: 1800,
  });
}

@Injectable()
class CartCleanupPoolShutdown
  implements OnModuleDestroy {
  constructor(
    @Inject(CART_CLEANUP_POOL)
    private readonly pool: Pool,
  ) {}

  async onModuleDestroy(): Promise<void> {
    await this.pool.end();
  }
}

@Module({
  imports: [
    ScheduleModule.forRoot(),
    AdminAuthModule,
    SecurityModule,
  ],

  controllers: [
    CartCleanupController,
  ],

  providers: [
    {
      provide: CART_CLEANUP_POOL,
      useFactory: createCleanupPool,
    },

    CartCleanupPoolShutdown,
    CartCleanupService,
  ],
})
export class CartCleanupModule {}
