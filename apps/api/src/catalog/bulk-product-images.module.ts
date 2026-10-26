
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
  AdminAuthModule,
} from '../admin-auth/admin-auth.module';

import {
  SecurityModule,
} from '../security/security.module';

import {
  ProductImagesModule,
} from './product-images.module';

import {
  BulkProductImagesController,
} from './bulk-product-images.controller';

import {
  BulkProductImagesService,
} from './bulk-product-images.service';

import {
  ProductDetailsImagesInterceptor,
} from './product-details-images.interceptor';

const BULK_PRODUCT_IMAGES_POOL =
  'BULK_PRODUCT_IMAGES_POOL';

function createBulkPool(): Pool {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error('DATABASE_URL is missing.');
  }

  return new Pool({
    connectionString: databaseUrl,
    max: 2,
    connectionTimeoutMillis: 10000,
    idleTimeoutMillis: 30000,
    maxLifetimeSeconds: 1800,
  });
}

@Injectable()
class BulkPoolCleanup implements OnModuleDestroy {
  constructor(
    @Inject(BULK_PRODUCT_IMAGES_POOL)
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
    ProductImagesModule,
  ],

  controllers: [
    BulkProductImagesController,
  ],

  providers: [
    {
      provide: BULK_PRODUCT_IMAGES_POOL,
      useFactory: createBulkPool,
    },

    BulkPoolCleanup,
    BulkProductImagesService,

    {
      provide: APP_INTERCEPTOR,
      useClass: ProductDetailsImagesInterceptor,
    },
  ],

  exports: [
    BulkProductImagesService,
  ],
})
export class BulkProductImagesModule {}
