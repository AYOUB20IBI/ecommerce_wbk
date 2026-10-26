
import {
  BadRequestException,
  Controller,
  Get,
  Param,
  Query,
} from '@nestjs/common';

import { z } from 'zod';

import {
  publicCatalogQuerySchema,
  publicSlugSchema,
  publicTaxonomyQuerySchema,
} from './dto/public-catalog.dto';

import {
  PublicCatalogService,
} from './public-catalog.service';

function validate<T extends z.ZodType>(
  schema: T,
  data: unknown,
): z.output<T> {
  const result = schema.safeParse(data);

  if (result.success) {
    return result.data;
  }

  const errors: Record<string, string[]> = {};

  for (const issue of result.error.issues) {
    const field = issue.path.join('.') || 'query';

    (errors[field] ??= []).push(issue.message);
  }

  throw new BadRequestException({
    success: false,
    message:
      'Les paramètres fournis sont invalides.',
    errors,
  });
}

// ========================================
// PUBLIC PRODUCTS
// ========================================

@Controller('products')
export class PublicProductsController {
  constructor(
    private readonly catalog: PublicCatalogService,
  ) {}

  @Get()
  async findAll(@Query() query: unknown) {
    const input = validate(
      publicCatalogQuerySchema,
      query,
    );

    return {
      success: true,
      message:
        'Produits récupérés avec succès.',
      data: await this.catalog.findAll(input),
    };
  }

  // Keep this route before :slug
  @Get('featured')
  async featured(@Query() query: unknown) {
    const input = validate(
      publicCatalogQuerySchema,
      query,
    );

    return {
      success: true,
      message:
        'Produits mis en avant récupérés.',
      data: await this.catalog.findAll(
        input,
        true,
      ),
    };
  }

  @Get(':slug')
  async findOne(@Param('slug') slug: string) {
    const validSlug = validate(
      publicSlugSchema,
      slug,
    );

    return {
      success: true,
      message:
        'Produit récupéré avec succès.',
      data: await this.catalog.findBySlug(
        validSlug,
      ),
    };
  }
}

// ========================================
// PUBLIC CATEGORIES
// ========================================

@Controller('categories')
export class PublicCategoriesController {
  constructor(
    private readonly catalog: PublicCatalogService,
  ) {}

  @Get()
  async findAll(@Query() query: unknown) {
    const input = validate(
      publicTaxonomyQuerySchema,
      query,
    );

    return {
      success: true,
      message:
        'Catégories récupérées avec succès.',
      data: await this.catalog.findCategories(
        input,
      ),
    };
  }
}

// ========================================
// PUBLIC BRANDS
// ========================================

@Controller('brands')
export class PublicBrandsController {
  constructor(
    private readonly catalog: PublicCatalogService,
  ) {}

  @Get()
  async findAll(@Query() query: unknown) {
    const input = validate(
      publicTaxonomyQuerySchema,
      query,
    );

    return {
      success: true,
      message:
        'Marques récupérées avec succès.',
      data: await this.catalog.findBrands(
        input,
      ),
    };
  }
}
