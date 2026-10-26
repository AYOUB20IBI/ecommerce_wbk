
import 'dotenv/config';

import {
  Inject,
  Injectable,
  Module,
  OnModuleDestroy,
} from '@nestjs/common';

import { Pool } from 'pg';

import {
  AdminAuthModule,
} from '../admin-auth/admin-auth.module';

import {
  SecurityModule,
} from '../security/security.module';

import {
  ProductPurgeController,
} from './product-purge.controller';

import {
  ProductPurgeService,
} from './product-purge.service';

export const PRODUCT_PURGE_POOL =
  'PRODUCT_PURGE_POOL';

function createProductPurgePool(): Pool {
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
class ProductPurgePoolCleanup
  implements OnModuleDestroy {
  constructor(
    @Inject(PRODUCT_PURGE_POOL)
    private readonly pool: Pool,
  ) {}

  async onModuleDestroy(): Promise<void> {
    await this.pool.end();
  }
}

@Module({
  imports: [
    AdminAuthModule,
    SecurityModule,
  ],

  controllers: [
    ProductPurgeController,
  ],

  providers: [
    {
      provide: PRODUCT_PURGE_POOL,
      useFactory: createProductPurgePool,
    },

    ProductPurgePoolCleanup,
    ProductPurgeService,
  ],

  exports: [
    ProductPurgeService,
  ],
})
export class ProductPurgeModule {}
