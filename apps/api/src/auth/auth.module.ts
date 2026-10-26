
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';

import {
  ThrottlerGuard,
  ThrottlerModule,
} from '@nestjs/throttler';

import { DatabaseModule } from '../database/database.module';
import { SecurityModule } from '../security/security.module';

import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

import {
  CustomerSessionService,
} from './customer-session.service';

import {
  CustomerAuthGuard,
} from './guards/customer-auth.guard';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),

    ThrottlerModule.forRoot([
      {
        ttl: 60_000,
        limit: 100,
      },
    ]),

    DatabaseModule,
    SecurityModule,
  ],

  controllers: [
    AuthController,
  ],

  providers: [
    AuthService,
    CustomerSessionService,
    CustomerAuthGuard,

    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],

  exports: [
    CustomerSessionService,
    CustomerAuthGuard,
  ],
})
export class AuthModule {}
