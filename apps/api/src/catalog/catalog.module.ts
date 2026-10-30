
import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';

import { AdminAuthModule } from '../admin-auth/admin-auth.module';
import { SecurityModule } from '../security/security.module';

import { ProductLifecycleModule } from './product-lifecycle.module';
import { ProductListTaxonomiesController } from './product-list-taxonomies.controller';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';

import {
  ProductHtmlSanitizerInterceptor,
} from './security/product-html-sanitizer.interceptor';

@Module({
  imports: [
    AdminAuthModule,
    SecurityModule,
    ProductLifecycleModule,
  ],
  controllers: [
    ProductsController,
    ProductListTaxonomiesController,
  ],
  providers: [
    ProductsService,
    {
      provide: APP_INTERCEPTOR,
      useClass: ProductHtmlSanitizerInterceptor,
    },
  ],
  exports: [
    ProductsService,
  ],
})
export class CatalogModule {}
