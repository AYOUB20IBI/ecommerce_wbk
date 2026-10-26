
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
  VariableProductsController,
} from './variable-products.controller';

import {
  VariableProductsService,
} from './variable-products.service';

export const VARIABLE_PRODUCTS_POOL =
  'VARIABLE_PRODUCTS_POOL';

// ==========================================
// POSTGRES CONNECTION POOL
// ==========================================

function createVariableProductsPool(): Pool {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error(
      'DATABASE_URL is missing. Check .env.',
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
// POOL CLEANUP
// ==========================================

@Injectable()
class VariableProductsPoolCleanup
  implements OnModuleDestroy {
  constructor(
    @Inject(VARIABLE_PRODUCTS_POOL)
    private readonly pool: Pool,
  ) {}

  async onModuleDestroy(): Promise<void> {
    await this.pool.end();
  }
}

// ==========================================
// MODULE
// ==========================================

@Module({
  imports: [
    AdminAuthModule,
    SecurityModule,
  ],

  controllers: [
    VariableProductsController,
  ],

  providers: [
    {
      provide: VARIABLE_PRODUCTS_POOL,
      useFactory: createVariableProductsPool,
    },

    VariableProductsPoolCleanup,
    VariableProductsService,
  ],

  exports: [
    VariableProductsService,
  ],
})
export class VariableProductsModule {}
