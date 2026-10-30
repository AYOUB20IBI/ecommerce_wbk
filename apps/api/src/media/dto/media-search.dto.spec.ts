
import { describe, expect, it } from 'vitest';

import { mediaSearchSchema } from './media-search.dto';

describe('Media Search Validation', () => {
  it('uses safe default values', () => {
    const result = mediaSearchSchema.parse({});

    expect(result).toEqual({
      page: 1,
      limit: 24,
      search: '',
      type: 'all',
    });
  });

  it('accepts valid pagination and filters', () => {
    const result = mediaSearchSchema.parse({
      page: '2',
      limit: '24',
      search: 'invoice',
      type: 'pdf',
    });

    expect(result.page).toBe(2);
    expect(result.limit).toBe(24);
    expect(result.search).toBe('invoice');
    expect(result.type).toBe('pdf');
  });

  it.each([
    'all',
    'image',
    'document',
    'pdf',
    'txt',
    'csv',
  ])('accepts %s filter', (type) => {
    expect(
      mediaSearchSchema.safeParse({ type }).success,
    ).toBe(true);
  });

  it.each([
    'application',
    'video',
    'exe',
    'unknown',
  ])('rejects unsupported filter %s', (type) => {
    expect(
      mediaSearchSchema.safeParse({ type }).success,
    ).toBe(false);
  });

  it('rejects page zero', () => {
    expect(
      mediaSearchSchema.safeParse({
        page: 0,
      }).success,
    ).toBe(false);
  });

  it('rejects negative page', () => {
    expect(
      mediaSearchSchema.safeParse({
        page: -1,
      }).success,
    ).toBe(false);
  });

  it('rejects a limit greater than 100', () => {
    expect(
      mediaSearchSchema.safeParse({
        limit: 101,
      }).success,
    ).toBe(false);
  });

  it('rejects non-integer pagination', () => {
    expect(
      mediaSearchSchema.safeParse({
        page: 1.5,
      }).success,
    ).toBe(false);
  });

  it('rejects overly long search terms', () => {
    expect(
      mediaSearchSchema.safeParse({
        search: 'a'.repeat(151),
      }).success,
    ).toBe(false);
  });

  it('trims search strings', () => {
    const result = mediaSearchSchema.parse({
      search: '  product image  ',
    });

    expect(result.search).toBe('product image');
  });

  it('rejects unexpected query parameters', () => {
    expect(
      mediaSearchSchema.safeParse({
        page: 1,
        admin: true,
      }).success,
    ).toBe(false);
  });
});
