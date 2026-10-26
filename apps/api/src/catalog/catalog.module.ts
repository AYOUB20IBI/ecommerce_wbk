
import { Module } from '@nestjs/common';

import {
  AdminAuthModule,
} from '../admin-auth/admin-auth.module';

import {
  SecurityModule,
} from '../security/security.module';

import {
  ProductsController,
} from './products.controller';

import {
  ProductsService,
} from './products.service';

@Module({
  imports: [
    AdminAuthModule,
    SecurityModule,
  ],
  controllers: [
    ProductsController,
  ],
  providers: [
    ProductsService,
  ],
  exports: [
    ProductsService,
  ],
})
export class CatalogModule {}
