
import {
  createProductSchema,
  createSimpleProductSchema,
  createVariableProductSchema,
  productListSchema,
  updateProductSchema,
} from './product.dto';

describe('Product DTO Security', () => {
  const validSimpleProduct = {
    name: 'Test Product',
    slug: 'test-product',
    type: 'simple' as const,
    status: 'published' as const,
    isFeatured: false,
    variant: {
      sku: 'TEST-001',
      ean: null,
      regularPrice: '200.00',
      salePrice: '150.00',
      stockQuantity: 10,
      manageStock: true,
      isActive: true,
    },
  };

  describe('Simple Product', () => {
    it('accepts a valid product', () => {
      const result =
        createSimpleProductSchema.safeParse(
          validSimpleProduct,
        );

      expect(result.success).toBe(true);
    });

    it('rejects negative stock', () => {
      const result =
        createSimpleProductSchema.safeParse({
          ...validSimpleProduct,
          variant: {
            ...validSimpleProduct.variant,
            stockQuantity: -1,
          },
        });

      expect(result.success).toBe(false);
    });

    it('rejects sale price higher than normal price', () => {
      const result =
        createSimpleProductSchema.safeParse({
          ...validSimpleProduct,
          variant: {
            ...validSimpleProduct.variant,
            salePrice: '250.00',
          },
        });

      expect(result.success).toBe(false);
    });

    it('rejects published product without price', () => {
      const result =
        createSimpleProductSchema.safeParse({
          ...validSimpleProduct,
          variant: {
            ...validSimpleProduct.variant,
            regularPrice: null,
            salePrice: null,
          },
        });

      expect(result.success).toBe(false);
    });

    it('rejects inactive published variation', () => {
      const result =
        createSimpleProductSchema.safeParse({
          ...validSimpleProduct,
          variant: {
            ...validSimpleProduct.variant,
            isActive: false,
          },
        });

      expect(result.success).toBe(false);
    });

    it('rejects unknown fields', () => {
      const result =
        createSimpleProductSchema.safeParse({
          ...validSimpleProduct,
          adminOverride: true,
        });

      expect(result.success).toBe(false);
    });

    it('rejects invalid slug', () => {
      const result =
        createSimpleProductSchema.safeParse({
          ...validSimpleProduct,
          slug: 'invalid slug!',
        });

      expect(result.success).toBe(false);
    });
  });

  describe('Variable Product', () => {
    const attributeId =
      '11111111-1111-4111-8111-111111111111';

    const valueId =
      '22222222-2222-4222-8222-222222222222';

    const validVariable = {
      name: 'Variable Test',
      slug: 'variable-test',
      type: 'variable' as const,
      status: 'published' as const,
      isFeatured: false,
      attributes: [
        {
          attributeId,
          valueIds: [valueId],
          visible: true,
          usedForVariations: true as const,
        },
      ],
      variants: [
        {
          sku: 'VAR-001',
          ean: null,
          regularPrice: '100.00',
          salePrice: null,
          stockQuantity: 5,
          manageStock: true,
          isActive: true,
          isDefault: true,
          options: [
            { attributeId, valueId },
          ],
        },
      ],
    };

    it('accepts a valid variable product', () => {
      expect(
        createVariableProductSchema.safeParse(
          validVariable,
        ).success,
      ).toBe(true);
    });

    it('rejects duplicate attribute IDs', () => {
      const result =
        createVariableProductSchema.safeParse({
          ...validVariable,
          attributes: [
            validVariable.attributes[0],
            validVariable.attributes[0],
          ],
        });

      expect(result.success).toBe(false);
    });

    it('rejects duplicate combinations', () => {
      const result =
        createVariableProductSchema.safeParse({
          ...validVariable,
          variants: [
            validVariable.variants[0],
            {
              ...validVariable.variants[0],
              sku: 'VAR-002',
              isDefault: false,
            },
          ],
        });

      expect(result.success).toBe(false);
    });

    it('requires exactly one default variant', () => {
      const result =
        createVariableProductSchema.safeParse({
          ...validVariable,
          variants: [
            {
              ...validVariable.variants[0],
              isDefault: false,
            },
          ],
        });

      expect(result.success).toBe(false);
    });

    it('rejects a value not allowed by its attribute', () => {
      const result =
        createVariableProductSchema.safeParse({
          ...validVariable,
          variants: [
            {
              ...validVariable.variants[0],
              options: [
                {
                  attributeId,
                  valueId:
                    '33333333-3333-4333-8333-333333333333',
                },
              ],
            },
          ],
        });

      expect(result.success).toBe(false);
    });
  });

  describe('Update Security', () => {
    it('rejects an empty update', () => {
      expect(
        updateProductSchema.safeParse({}).success,
      ).toBe(false);
    });

    it('rejects unexpected fields', () => {
      expect(
        updateProductSchema.safeParse({
          createdBy:
            '11111111-1111-4111-8111-111111111111',
        }).success,
      ).toBe(false);
    });

    it('accepts a valid name update', () => {
      expect(
        updateProductSchema.safeParse({
          name: 'Updated Product',
        }).success,
      ).toBe(true);
    });
  });

  describe('List Validation', () => {
    it('rejects invalid pagination', () => {
      expect(
        productListSchema.safeParse({
          page: -1,
        }).success,
      ).toBe(false);
    });

    it('rejects excessive limit', () => {
      expect(
        productListSchema.safeParse({
          limit: 1000,
        }).success,
      ).toBe(false);
    });

    it('rejects unsupported sort fields', () => {
      expect(
        productListSchema.safeParse({
          sortBy: 'DROP TABLE products',
        }).success,
      ).toBe(false);
    });

    it('accepts valid pagination', () => {
      expect(
        productListSchema.safeParse({
          page: '2',
          limit: '20',
        }).success,
      ).toBe(true);
    });
  });

  describe('Create Union', () => {
    it('rejects invalid product type', () => {
      expect(
        createProductSchema.safeParse({
          ...validSimpleProduct,
          type: 'digital',
        }).success,
      ).toBe(false);
    });
  });
});
