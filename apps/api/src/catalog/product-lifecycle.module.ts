import 'dotenv/config';

import {
  Inject,
  Injectable,
  Module,
  OnModuleDestroy,
} from '@nestjs/common';

import { Pool } from 'pg';

import { AdminAuthModule } from '../admin-auth/admin-auth.module';
import { SecurityModule } from '../security/security.module';

import { ProductLifecycleController } from './product-lifecycle.controller';
import { ProductLifecycleService } from './product-lifecycle.service';
import { ProductBulkTrashController } from './product-bulk-trash.controller';

export const PRODUCT_LIFECYCLE_POOL =
  'PRODUCT_LIFECYCLE_POOL';

function createProductLifecyclePool(): Pool {
  const url = process.env.DATABASE_URL;

  if (!url) {
    throw new Error('DATABASE_URL is missing.');
  }

  return new Pool({
    connectionString: url,
    max: 3,
    connectionTimeoutMillis: 10_000,
    idleTimeoutMillis: 30_000,
    maxLifetimeSeconds: 1800,
  });
}

@Injectable()
class ProductLifecyclePoolCleanup
  implements OnModuleDestroy {
  constructor(
    @Inject(PRODUCT_LIFECYCLE_POOL)
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
    ProductLifecycleController,
    ProductBulkTrashController,
  ],

  providers: [
    {
      provide: PRODUCT_LIFECYCLE_POOL,
      useFactory: createProductLifecyclePool,
    },
    ProductLifecyclePoolCleanup,
    ProductLifecycleService,
  ],

  exports: [
    ProductLifecycleService,
    PRODUCT_LIFECYCLE_POOL,
  ],
})
export class ProductLifecycleModule {}