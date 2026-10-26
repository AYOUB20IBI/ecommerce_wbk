
import 'dotenv/config';

import {
  Inject,
  Injectable,
  Module,
  OnModuleDestroy,
} from '@nestjs/common';

import { Pool } from 'pg';

import {
  AuthModule,
} from '../auth/auth.module';

import {
  SecurityModule,
} from '../security/security.module';

import {
  CartModule,
} from './cart.module';

import {
  CustomerCartService,
} from './customer-cart.service';

import {
  CartMergeController,
  CustomerCartController,
} from './customer-cart.controller';

const CUSTOMER_CART_POOL =
  'CUSTOMER_CART_POOL';

function createCustomerCartPool(): Pool {
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
class CustomerCartPoolCleanup
  implements OnModuleDestroy {
  constructor(
    @Inject(CUSTOMER_CART_POOL)
    private readonly pool: Pool,
  ) {}

  async onModuleDestroy(): Promise<void> {
    await this.pool.end();
  }
}

@Module({
  imports: [
    AuthModule,
    CartModule,
    SecurityModule,
  ],

  controllers: [
    CartMergeController,
    CustomerCartController,
  ],

  providers: [
    {
      provide: CUSTOMER_CART_POOL,
      useFactory: createCustomerCartPool,
    },

    CustomerCartPoolCleanup,
    CustomerCartService,
  ],
})
export class CustomerCartModule {}
