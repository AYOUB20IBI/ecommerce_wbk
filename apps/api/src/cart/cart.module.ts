
import 'dotenv/config';

import {
  Inject,
  Injectable,
  Module,
  OnModuleDestroy,
} from '@nestjs/common';

import { Pool } from 'pg';

import {
  CartController,
} from './cart.controller';

import {
  CartService,
} from './cart.service';

export const CART_POOL = 'CART_POOL';

function createCartPool(): Pool {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error(
      'DATABASE_URL is missing.',
    );
  }

  return new Pool({
    connectionString: databaseUrl,
    max: 5,
    connectionTimeoutMillis: 10_000,
    idleTimeoutMillis: 30_000,
    maxLifetimeSeconds: 1800,
  });
}

@Injectable()
class CartPoolCleanup
  implements OnModuleDestroy {
  constructor(
    @Inject(CART_POOL)
    private readonly pool: Pool,
  ) {}

  async onModuleDestroy(): Promise<void> {
    await this.pool.end();
  }
}

@Module({
  controllers: [
    CartController,
  ],

  providers: [
    {
      provide: CART_POOL,
      useFactory: createCartPool,
    },

    CartPoolCleanup,
    CartService,
  ],

  exports: [
    CartService,
  ],
})
export class CartModule {}
