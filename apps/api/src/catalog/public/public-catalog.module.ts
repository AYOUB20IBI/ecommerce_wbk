
import 'dotenv/config';

import {
  Inject,
  Injectable,
  Module,
  OnModuleDestroy,
} from '@nestjs/common';

import { Pool } from 'pg';

import {
  PublicProductsController,
  PublicCategoriesController,
  PublicBrandsController,
} from './public-catalog.controller';

import {
  PublicCatalogService,
} from './public-catalog.service';

export const PUBLIC_CATALOG_POOL =
  'PUBLIC_CATALOG_POOL';

function createPublicCatalogPool(): Pool {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error(
      'DATABASE_URL is missing.',
    );
  }

  return new Pool({
    connectionString: databaseUrl,
    max: 5,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
    maxLifetimeSeconds: 1800,
  });
}

@Injectable()
class PublicCatalogPoolCleanup
  implements OnModuleDestroy {
  constructor(
    @Inject(PUBLIC_CATALOG_POOL)
    private readonly pool: Pool,
  ) {}

  async onModuleDestroy(): Promise<void> {
    await this.pool.end();
  }
}

@Module({
  controllers: [
    PublicProductsController,
    PublicCategoriesController,
    PublicBrandsController,
  ],

  providers: [
    {
      provide: PUBLIC_CATALOG_POOL,
      useFactory: createPublicCatalogPool,
    },

    PublicCatalogPoolCleanup,
    PublicCatalogService,
  ],

  exports: [
    PublicCatalogService,
  ],
})
export class PublicCatalogModule {}
