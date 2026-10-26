
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './auth/auth.module';
import { AdminAuthModule } from './admin-auth/admin-auth.module';
import { MediaModule } from './media/media.module';
import { CatalogModule } from './catalog/catalog.module';
import { TaxonomyModule } from './catalog/taxonomy/taxonomy.module';
import { ProductTaxonomyModule } from './catalog/product-taxonomy.module';
import { VariableProductsModule } from './catalog/variable-products.module';
import { ProductLifecycleModule } from './catalog/product-lifecycle.module';
import { ProductPurgeModule } from './catalog/product-purge.module';
import { ProductImagesModule } from './catalog/product-images.module';
import { BulkProductImagesModule } from './catalog/bulk-product-images.module';
import { AdvancedProductListModule } from './catalog/advanced-product-list.module';
import { PublicCatalogModule } from './catalog/public/public-catalog.module';
import { CartModule } from './cart/cart.module';
import { CustomerCartModule } from './cart/customer-cart.module';
import { CartCleanupModule } from './cart/cleanup/cart-cleanup.module';
import { CartValidationModule } from './cart/validation/cart-validation.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    DatabaseModule,
    AuthModule,
    AdminAuthModule,
    MediaModule,
    CatalogModule,
    TaxonomyModule,
    ProductTaxonomyModule,
    VariableProductsModule ,
    ProductLifecycleModule,
    ProductPurgeModule,
    ProductImagesModule,
    BulkProductImagesModule,
    AdvancedProductListModule,
    PublicCatalogModule,
    CartModule,
    CustomerCartModule,
    CartCleanupModule,
    CartValidationModule
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
