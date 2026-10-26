
import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';

import { Observable, from, mergeMap, of } from 'rxjs';

import type { FastifyRequest } from 'fastify';

import {
  ProductImagesService,
} from './product-images.service';

@Injectable()
export class ProductDetailsImagesInterceptor
  implements NestInterceptor {
  constructor(
    private readonly images: ProductImagesService,
  ) {}

  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<unknown> {
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const request =
      context.switchToHttp().getRequest<FastifyRequest>();

    if (request.method !== 'GET') {
      return next.handle();
    }

    const pathname = request.url.split('?')[0];

    // Only the existing Admin Product Details API.
    // Do not affect list, gallery, variations or
    // public storefront endpoints.
    const match = pathname.match(
      /^\/api\/v1\/admin\/products\/([0-9a-fA-F-]{36})\/?$/,
    );

    if (!match) {
      return next.handle();
    }

    const productId = match[1];

    return next.handle().pipe(
      mergeMap((response: unknown) => {
        if (
          response === null ||
          typeof response !== 'object' ||
          Array.isArray(response)
        ) {
          return of(response);
        }

        // Preserve original response structure.
        const output = response as Record<string, unknown>;

        // If the original controller returns
        // { success, data: { product... } },
        // append images inside data.
        //
        // Otherwise append images directly to
        // the returned product object.
        const hasDataObject =
          output.data !== null &&
          typeof output.data === 'object' &&
          !Array.isArray(output.data);

        return from(
          this.images.findAll(productId),
        ).pipe(
          mergeMap((images) => {
            if (hasDataObject) {
              return of({
                ...output,
                data: {
                  ...output.data as Record<string, unknown>,
                  images,
                },
              });
            }

            return of({
              ...output,
              images,
            });
          }),
        );
      }),
    );
  }
}
