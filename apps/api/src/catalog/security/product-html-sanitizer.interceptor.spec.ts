import { describe, expect, it } from 'vitest';

import {
  sanitizeProductHtml,
} from './product-html-sanitizer.interceptor';

describe('Product HTML sanitizer', () => {
  it('preserves allowed HTML formatting', () => {
    const result = sanitizeProductHtml(
      '<p>Hello <strong>World</strong></p>',
    );

    expect(result).toContain('<p>');
    expect(result).toContain('<strong>World</strong>');
  });

  it('removes script elements and their contents', () => {
    const result = sanitizeProductHtml(
      '<p>Safe</p><script>alert(1)</script>',
    );

    expect(result).toContain('<p>Safe</p>');
    expect(result).not.toContain('<script');
    expect(result).not.toContain('alert(1)');
  });

  it('removes inline event handlers', () => {
    const result = sanitizeProductHtml(
      '<p onclick="alert(1)">Hello</p>',
    );

    expect(result).toContain('Hello');
    expect(result).not.toContain('onclick');
  });

  it('blocks javascript URLs', () => {
    const result = sanitizeProductHtml(
      '<a href="javascript:alert(1)">Click</a>',
    );

    expect(result).not.toContain('javascript:');
    expect(result).not.toContain('href=');
  });

  it('allows HTTPS links', () => {
    const result = sanitizeProductHtml(
      '<a href="https://example.com">Visit</a>',
    );

    expect(result).toContain('href="https://example.com"');
    expect(result).toContain('Visit');
  });

  it('protects external links opened in new tabs', () => {
    const result = sanitizeProductHtml(
      '<a href="https://example.com" target="_blank">Visit</a>',
    );

    expect(result).toContain('noopener');
    expect(result).toContain('noreferrer');
  });

  it('removes iframe and image elements', () => {
    const result = sanitizeProductHtml(
      '<iframe src="https://example.com"></iframe>' +
        '<img src="https://example.com/tracker.png">',
    );

    expect(result).not.toContain('<iframe');
    expect(result).not.toContain('<img');
  });

  it('removes dangerous SVG markup', () => {
    const result = sanitizeProductHtml(
      '<svg onload="alert(1)"><circle /></svg>',
    );

    expect(result).not.toContain('<svg');
    expect(result).not.toContain('onload');
  });

  it('preserves lists and headings', () => {
    const result = sanitizeProductHtml(
      '<h2>Features</h2><ul><li>Fast</li></ul>',
    );

    expect(result).toContain('<h2>Features</h2>');
    expect(result).toContain('<li>Fast</li>');
  });
});