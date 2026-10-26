
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
} from '../../auth/auth.module';

import {
  GuestCartValidationController,
  CustomerCartValidationController,
} from './cart-validation.controller';

import {
  CartValidationService,
} from './cart-validation.service';

const CART_VALIDATION_POOL =
  'CART_VALIDATION_POOL';

function createValidationPool(): Pool {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error(
      'DATABASE_URL is missing.',
    );
  }

  return new Pool({
    connectionString: databaseUrl,
    max: 3,
    connectionTimeoutMillis: 10_000,
    idleTimeoutMillis: 30_000,
    maxLifetimeSeconds: 1800,
  });
}

@Injectable()
class CartValidationPoolCleanup
  implements OnModuleDestroy {
  constructor(
    @Inject(CART_VALIDATION_POOL)
    private readonly pool: Pool,
  ) {}

  async onModuleDestroy(): Promise<void> {
    await this.pool.end();
  }
}

@Module({
  imports: [
    AuthModule,
  ],

  controllers: [
    GuestCartValidationController,
    CustomerCartValidationController,
  ],

  providers: [
    {
      provide: CART_VALIDATION_POOL,
      useFactory: createValidationPool,
    },

    CartValidationPoolCleanup,
    CartValidationService,
  ],

  exports: [
    CartValidationService,
  ],
})
export class CartValidationModule {}
