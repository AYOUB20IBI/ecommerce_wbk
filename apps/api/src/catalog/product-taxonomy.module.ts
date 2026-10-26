
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
  ProductTaxonomyController,
} from './product-taxonomy.controller';

import {
  ProductTaxonomyService,
} from './product-taxonomy.service';

export const PRODUCT_TAXONOMY_POOL =
  'PRODUCT_TAXONOMY_POOL';

// =========================================
// DATABASE POOL FACTORY
// =========================================

function createProductTaxonomyPool(): Pool {
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

// =========================================
// DATABASE CLEANUP
// =========================================

@Injectable()
class ProductTaxonomyPoolCleanup
  implements OnModuleDestroy {
  constructor(
    @Inject(PRODUCT_TAXONOMY_POOL)
    private readonly pool: Pool,
  ) {}

  async onModuleDestroy(): Promise<void> {
    await this.pool.end();
  }
}

// =========================================
// MODULE
// =========================================

@Module({
  imports: [
    AdminAuthModule,
    SecurityModule,
  ],

  controllers: [
    ProductTaxonomyController,
  ],

  providers: [
    {
      provide: PRODUCT_TAXONOMY_POOL,
      useFactory: createProductTaxonomyPool,
    },

    ProductTaxonomyPoolCleanup,
    ProductTaxonomyService,
  ],

  exports: [
    ProductTaxonomyService,
  ],
})
export class ProductTaxonomyModule {}
