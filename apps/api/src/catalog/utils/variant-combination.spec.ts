
import { describe, expect, it } from 'vitest';
import { buildCombinationKey } from './variant-combination';

const COLOR_ID = '11111111-1111-4111-8111-111111111111';
const SIZE_ID = '22222222-2222-4222-8222-222222222222';

const BLACK_ID = '33333333-3333-4333-8333-333333333333';
const WHITE_ID = '44444444-4444-4444-8444-444444444444';
const MEDIUM_ID = '55555555-5555-4555-8555-555555555555';

describe('buildCombinationKey', () => {
  it('returns the same key regardless of option order', () => {
    const first = buildCombinationKey([
      { attributeId: COLOR_ID, valueId: BLACK_ID },
      { attributeId: SIZE_ID, valueId: MEDIUM_ID },
    ]);

    const second = buildCombinationKey([
      { attributeId: SIZE_ID, valueId: MEDIUM_ID },
      { attributeId: COLOR_ID, valueId: BLACK_ID },
    ]);

    expect(first).toBe(second);
  });

  it('returns different keys for different options', () => {
    const black = buildCombinationKey([
      { attributeId: COLOR_ID, valueId: BLACK_ID },
      { attributeId: SIZE_ID, valueId: MEDIUM_ID },
    ]);

    const white = buildCombinationKey([
      { attributeId: COLOR_ID, valueId: WHITE_ID },
      { attributeId: SIZE_ID, valueId: MEDIUM_ID },
    ]);

    expect(black).not.toBe(white);
  });

  it('rejects duplicate attributes', () => {
    expect(() =>
      buildCombinationKey([
        { attributeId: COLOR_ID, valueId: BLACK_ID },
        { attributeId: COLOR_ID, valueId: WHITE_ID },
      ]),
    ).toThrow('DUPLICATE_VARIANT_ATTRIBUTE');
  });

  it('rejects empty combinations', () => {
    expect(() => buildCombinationKey([]))
      .toThrow('VARIANT_OPTIONS_REQUIRED');
  });

  it('rejects malformed UUIDs', () => {
    expect(() =>
      buildCombinationKey([
        { attributeId: 'invalid', valueId: BLACK_ID },
      ]),
    ).toThrow();
  });
});
