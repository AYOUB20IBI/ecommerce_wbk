
import {
  BadRequestException,
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';

import type { FastifyRequest } from 'fastify';
import type { Observable } from 'rxjs';

import sanitizeHtml from 'sanitize-html';

const PRODUCT_WRITE_PATH =
  /^\/api\/v1\/admin\/products(?:\/[0-9a-f-]{36}(?:\/variable)?)?\/?$/i;

const SAFE_TAGS = [
  'p',
  'br',
  'strong',
  'b',
  'em',
  'i',
  'u',
  's',
  'h2',
  'h3',
  'h4',
  'ul',
  'ol',
  'li',
  'blockquote',
  'a',
  'pre',
  'code',
  'hr',
];

export function sanitizeProductHtml(input: string): string {
  return sanitizeHtml(input, {
    allowedTags: SAFE_TAGS,
    allowedAttributes: {
      a: ['href', 'title', 'target', 'rel'],
    },
    allowedSchemes: ['https', 'http', 'mailto'],
    allowedSchemesByTag: {
      a: ['https', 'http', 'mailto'],
    },
    allowProtocolRelative: false,
    disallowedTagsMode: 'discard',
    transformTags: {
      a: (_tag, attributes) => {
        const href = attributes.href ?? '';

        // An empty or unsafe link becomes plain text.
        if (
          !/^(https?:\/\/|mailto:)/i.test(href)
        ) {
          return {
            tagName: 'span',
            attribs: {},
          };
        }

        return {
          tagName: 'a',
          attribs: {
            href,
            ...(attributes.title
              ? { title: attributes.title }
              : {}),
            ...(attributes.target === '_blank'
              ? {
                  target: '_blank',
                  rel: 'noopener noreferrer nofollow',
                }
              : {}),
          },
        };
      },
    },
  });
}

function isRecord(
  value: unknown,
): value is Record<string, unknown> {
  return (
    value !== null &&
    typeof value === 'object' &&
    !Array.isArray(value)
  );
}

@Injectable()
export class ProductHtmlSanitizerInterceptor
  implements NestInterceptor {
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<unknown> {
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const request =
      context.switchToHttp().getRequest<FastifyRequest>();

    const method = request.method.toUpperCase();

    if (method !== 'POST' && method !== 'PATCH') {
      return next.handle();
    }

    const pathname = request.url.split('?')[0] ?? '';

    if (!PRODUCT_WRITE_PATH.test(pathname)) {
      return next.handle();
    }

    if (!isRecord(request.body)) {
      return next.handle();
    }

    const body = request.body;

    for (const field of [
      'description',
      'shortDescription',
    ] as const) {
      const value = body[field];

      if (value === null || value === undefined) {
        continue;
      }

      if (typeof value !== 'string') {
        // Leave invalid types for existing Zod validation.
        continue;
      }

      const maxLength =
        field === 'description' ? 100000 : 5000;

      if (value.length > maxLength) {
        throw new BadRequestException({
          success: false,
          message: `${field} exceeds the maximum length.`,
        });
      }

      const sanitized = sanitizeProductHtml(value);

      if (sanitized.length > maxLength) {
        throw new BadRequestException({
          success: false,
          message: `${field} exceeds the allowed size.`,
        });
      }

      body[field] = sanitized;
    }

    return next.handle();
  }
}
