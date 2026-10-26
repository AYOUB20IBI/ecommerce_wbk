
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
  ProductImagesController,
} from './product-images.controller';

import {
  ProductImagesService,
} from './product-images.service';

export const PRODUCT_IMAGES_POOL =
  'PRODUCT_IMAGES_POOL';

// ==========================================
// CONNECTION POOL
// ==========================================

function createProductImagesPool(): Pool {
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

// ==========================================
// CLEANUP
// ==========================================

@Injectable()
class ProductImagesPoolCleanup
  implements OnModuleDestroy {
  constructor(
    @Inject(PRODUCT_IMAGES_POOL)
    private readonly pool: Pool,
  ) {}

  async onModuleDestroy(): Promise<void> {
    await this.pool.end();
  }
}

// ==========================================
// NESTJS MODULE
// ==========================================

@Module({
  imports: [
    AdminAuthModule,
    SecurityModule,
  ],

  controllers: [
    ProductImagesController,
  ],

  providers: [
    {
      provide: PRODUCT_IMAGES_POOL,
      useFactory: createProductImagesPool,
    },

    ProductImagesPoolCleanup,
    ProductImagesService,
  ],

  exports: [
    ProductImagesService,
  ],
})
export class ProductImagesModule {}
