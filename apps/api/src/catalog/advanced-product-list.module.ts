
import 'dotenv/config';

import {
  Inject,
  Injectable,
  Module,
  OnModuleDestroy,
} from '@nestjs/common';

import { APP_INTERCEPTOR } from '@nestjs/core';
import { Pool } from 'pg';

import {
  AdvancedProductListInterceptor,
} from './advanced-product-list.interceptor';

const ADVANCED_PRODUCT_LIST_POOL =
  'ADVANCED_PRODUCT_LIST_POOL';

function createAdvancedListPool(): Pool {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error(
      'DATABASE_URL is missing.',
    );
  }

  return new Pool({
    connectionString: databaseUrl,
    max: 3,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
    maxLifetimeSeconds: 1800,
  });
}

@Injectable()
class AdvancedListPoolCleanup
  implements OnModuleDestroy {
  constructor(
    @Inject(ADVANCED_PRODUCT_LIST_POOL)
    private readonly pool: Pool,
  ) {}

  async onModuleDestroy(): Promise<void> {
    await this.pool.end();
  }
}

@Module({
  providers: [
    {
      provide: ADVANCED_PRODUCT_LIST_POOL,
      useFactory: createAdvancedListPool,
    },

    AdvancedListPoolCleanup,

    {
      provide: APP_INTERCEPTOR,
      useClass: AdvancedProductListInterceptor,
    },
  ],
})
export class AdvancedProductListModule {}
