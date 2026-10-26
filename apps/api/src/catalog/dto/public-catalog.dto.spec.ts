import { publicCatalogQuerySchema, publicSlugSchema, publicTaxonomyQuerySchema } from "../public/dto/public-catalog.dto";


describe('Public Catalog Validation', () => {
  it('accepts valid pagination', () => {
    const result = publicCatalogQuerySchema.safeParse({
      page: '1',
      limit: '12',
    });

    expect(result.success).toBe(true);
  });

  it('rejects excessive pagination limit', () => {
    expect(
      publicCatalogQuerySchema.safeParse({
        limit: 1000,
      }).success,
    ).toBe(false);
  });

  it('rejects negative price', () => {
    expect(
      publicCatalogQuerySchema.safeParse({
        minPrice: '-50',
      }).success,
    ).toBe(false);
  });

  it('rejects invalid price range', () => {
    expect(
      publicCatalogQuerySchema.safeParse({
        minPrice: '500',
        maxPrice: '100',
      }).success,
    ).toBe(false);
  });

  it('accepts valid price range', () => {
    expect(
      publicCatalogQuerySchema.safeParse({
        minPrice: '100.00',
        maxPrice: '500.00',
      }).success,
    ).toBe(true);
  });

  it('rejects attribute without value', () => {
    expect(
      publicCatalogQuerySchema.safeParse({
        attributeId:
          '11111111-1111-4111-8111-111111111111',
      }).success,
    ).toBe(false);
  });

  it('rejects value without attribute', () => {
    expect(
      publicCatalogQuerySchema.safeParse({
        valueId:
          '22222222-2222-4222-8222-222222222222',
      }).success,
    ).toBe(false);
  });

  it('accepts attribute and value together', () => {
    expect(
      publicCatalogQuerySchema.safeParse({
        attributeId:
          '11111111-1111-4111-8111-111111111111',
        valueId:
          '22222222-2222-4222-8222-222222222222',
      }).success,
    ).toBe(true);
  });

  it('rejects unsupported sorting', () => {
    expect(
      publicCatalogQuerySchema.safeParse({
        sortBy: 'password',
      }).success,
    ).toBe(false);
  });

  it('rejects unexpected query parameters', () => {
    expect(
      publicCatalogQuerySchema.safeParse({
        includePrivate: 'true',
      }).success,
    ).toBe(false);
  });

  it('accepts a valid public slug', () => {
    expect(
      publicSlugSchema.safeParse(
        'premium-tshirt',
      ).success,
    ).toBe(true);
  });

  it('rejects an invalid slug', () => {
    expect(
      publicSlugSchema.safeParse(
        '../admin/products',
      ).success,
    ).toBe(false);
  });

  it('rejects excessive taxonomy pagination', () => {
    expect(
      publicTaxonomyQuerySchema.safeParse({
        limit: 999,
      }).success,
    ).toBe(false);
  });
});
