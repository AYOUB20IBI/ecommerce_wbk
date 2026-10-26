
import 'dotenv/config';

import {
  Inject,
  Injectable,
  Module,
  OnModuleDestroy,
} from '@nestjs/common';

import { Pool } from 'pg';

import { AdminAuthModule } from '../../admin-auth/admin-auth.module';
import { SecurityModule } from '../../security/security.module';

import { BrandsController } from './brands.controller';
import { CategoriesController } from './categories.controller';
import { TagsController } from './tags.controller';

import { TaxonomyService } from './taxonomy.service';

// ============================================
// DATABASE POOL TOKEN
// ============================================

export const TAXONOMY_PG_POOL = 'TAXONOMY_PG_POOL';

// ============================================
// DATABASE CONNECTION FACTORY
// ============================================

function createTaxonomyPool(): Pool {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error(
      'DATABASE_URL is missing. Check your .env file.',
    );
  }

  return new Pool({
    connectionString: databaseUrl,

    // Maximum simultaneous connections
    max: 5,

    // Close idle connections after 30 seconds
    idleTimeoutMillis: 30_000,

    // Fail connection attempts after 10 seconds
    connectionTimeoutMillis: 10_000,

    // Connection lifetime
    maxLifetimeSeconds: 1800,

    // Required to avoid unbounded waiting
    allowExitOnIdle: false,
  });
}

// ============================================
// DATABASE POOL CLEANUP
// ============================================

@Injectable()
class TaxonomyPoolCleanup implements OnModuleDestroy {
  constructor(
    @Inject(TAXONOMY_PG_POOL)
    private readonly pool: Pool,
  ) {}

  async onModuleDestroy(): Promise<void> {
    await this.pool.end();
  }
}

// ============================================
// TAXONOMY MODULE
// ============================================

@Module({
  imports: [
    AdminAuthModule,
    SecurityModule,
  ],

  controllers: [
    BrandsController,
    CategoriesController,
    TagsController,
  ],

  providers: [
    {
      provide: TAXONOMY_PG_POOL,
      useFactory: createTaxonomyPool,
    },

    TaxonomyPoolCleanup,
    TaxonomyService,
  ],

  exports: [
    TaxonomyService,
  ],
})
export class TaxonomyModule {}
